import { Peer } from 'peerjs';
import Matter from 'matter-js';

// Matter.js 模块
const { Engine, Render, World, Bodies, Body, Runner, Events, Query } = Matter;

// 游戏状态
const gameState = {
    local: {
        color: '#ff0000',
        isHost: false,     // 添加主机标识
        body: null,
        isJumping: false,
        jumpCooldown: 0,
        jumpCount: 0,    // 添加跳跃次数计数
        effects: {
            trail: [],
            jumpParticles: []
        },
        score: 0,  // 添加得分
        lastPositionUpdate: null,
        isReady: false  // 添加准备状态
    },
    remote: {
        color: '#0000ff',
        body: null,
        isJumping: false,
        isConnected: false,
        jumpCount: 0,    // 添加跳跃次数计数
        lastUpdate: null,
        targetPosition: null,
        targetVelocity: null,
        targetAngle: null,
        targetAngularVelocity: null,
        effects: {
            trail: [],
            jumpParticles: []
        },
        score: 0,  // 添加得分
        isReady: false  // 添加准备状态
    },
    platforms: [],  // 存储平台数组
    gameStarted: false,  // 修改为false，等待连接后再开始
    collectibles: [],  // 存储掉落物体
    lastCollectibleSpawn: 0,  // 上次生成掉落物的时间
    isConnected: false  // 添加连接状态标志
};

// 平台配置
const PLATFORM_CONFIG = {
    minCount: 2,        // 最小平台数量
    maxCount: 4,        // 最大平台数量
    minWidth: 80,       // 最小宽度
    maxWidth: 120,      // 最大宽度
    height: 10,         // 平台高度
    minY: 120,          // 最低高度
    maxY: 300,          // 最高高度
    color: '#4CAF50',   // 平台颜色
    minDistance: 80     // 平台之间的最小距离
};

// 初始位置
const INITIAL_POSITIONS = {
    local: { x: 100, y: 300 },
    remote: { x: 300, y: 300 }
};

// 物理参数
const PHYSICS = {
    jumpForce: -0.15,
    moveForce: 0.008,    // 降低移动力度
    friction: 0.001,
    jumpCooldown: 5
};

// 修改玩家颜色配置
const PLAYER_COLORS = {
    player1: '#ff0000',
    player2: '#0000ff',
    indicator: '#FFD700'  // 玩家标识的颜色
};

// 修改掉落物配置
const COLLECTIBLE_CONFIG = {
    types: ['circle', 'triangle', 'rectangle'],
    size: 20,
    spawnInterval: 2000,  // 每2秒生成一个
    fallSpeed: 2,
    colors: [PLAYER_COLORS.player1, PLAYER_COLORS.player2],  // 与玩家颜色对应
    maxCount: 5  // 场上最大掉落物数量
};

// 初始化画布
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 初始化 Matter.js
const engine = Engine.create();
engine.gravity.y = 0.4;  // 降低重力加速度
const world = engine.world;

// 设置碰撞检测
Matter.Resolver._restingThresh = 0.001;  // 降低休眠阈值，使碰撞更敏感

// 定义碰撞类别
const COLLISION_CATEGORIES = {
    BOUNDARY: 0x0001,
    PLAYER: 0x0002,
    PLATFORM: 0x0004,
    COLLECTIBLE: 0x0008  // 添加掉落物的碰撞类别
};

// 创建物理物体
function createPlayer(x, y, color) {
    return Bodies.rectangle(x, y, 30, 30, {
        restitution: 0.1,
        friction: PHYSICS.friction,
        density: 0.003,
        frictionAir: 0.003,
        frictionStatic: 0.005,
        collisionFilter: {
            category: COLLISION_CATEGORIES.PLAYER,
            mask: COLLISION_CATEGORIES.BOUNDARY | COLLISION_CATEGORIES.PLATFORM | COLLISION_CATEGORIES.COLLECTIBLE | COLLISION_CATEGORIES.PLAYER  // 添加与其他玩家的碰撞
        },
        render: {
            fillStyle: color
        }
    });
}

// 创建边界
const ground = Bodies.rectangle(200, 380, 400, 40, { 
    isStatic: true,
    friction: 0.001,     // 降低地面摩擦力
    frictionStatic: 0.005, // 降低地面静摩擦力
    collisionFilter: {
        category: COLLISION_CATEGORIES.BOUNDARY,
        mask: COLLISION_CATEGORIES.PLAYER
    }
});
const leftWall = Bodies.rectangle(0, 200, 40, 400, { 
    isStatic: true,
    friction: 0.001,
    collisionFilter: {
        category: COLLISION_CATEGORIES.BOUNDARY,
        mask: COLLISION_CATEGORIES.PLAYER
    }
});
const rightWall = Bodies.rectangle(400, 200, 40, 400, { 
    isStatic: true,
    friction: 0.001,
    collisionFilter: {
        category: COLLISION_CATEGORIES.BOUNDARY,
        mask: COLLISION_CATEGORIES.PLAYER
    }
});
const ceiling = Bodies.rectangle(200, 0, 400, 40, { 
    isStatic: true,
    friction: 0.001,
    collisionFilter: {
        category: COLLISION_CATEGORIES.BOUNDARY,
        mask: COLLISION_CATEGORIES.PLAYER
    }
});

// 添加物体到世界
World.add(world, [ground, leftWall, rightWall, ceiling]);

// 创建运行器
const runner = Runner.create();
Runner.run(runner, engine);

// 初始化PeerJS
const peer = new Peer({
    debug: 2
});

let connection = null;

// 创建随机平台
function createPlatform(x, y, width) {
    const platform = Bodies.rectangle(x, y, width, PLATFORM_CONFIG.height, {
        isStatic: true,
        render: {
            fillStyle: PLATFORM_CONFIG.color
        },
        friction: 0.001,
        frictionStatic: 0.005,
        restitution: 0,
        collisionFilter: {
            category: COLLISION_CATEGORIES.PLATFORM,
            mask: COLLISION_CATEGORIES.PLAYER | COLLISION_CATEGORIES.COLLECTIBLE  // 允许与玩家和掉落物碰撞
        }
    });
    return platform;
}

// 修改生成平台函数
function generatePlatforms() {
    // 只有主机生成平台
    if (!gameState.local.isHost) return;

    console.log('主机：开始生成平台');

    // 清除现有平台
    gameState.platforms.forEach(platform => {
        World.remove(world, platform);
    });
    gameState.platforms = [];

    // 随机决定平台数量
    const platformCount = Math.floor(Math.random() * 
        (PLATFORM_CONFIG.maxCount - PLATFORM_CONFIG.minCount + 1)) + 
        PLATFORM_CONFIG.minCount;

    // 记录已生成的平台位置
    const platformPositions = [];

    // 生成新平台
    let attempts = 0;
    const maxAttempts = 100;

    while (platformPositions.length < platformCount && attempts < maxAttempts) {
        const width = Math.random() * (PLATFORM_CONFIG.maxWidth - PLATFORM_CONFIG.minWidth) + PLATFORM_CONFIG.minWidth;
        const x = Math.random() * (canvas.width - width - 80) + 40;
        const y = Math.random() * (PLATFORM_CONFIG.maxY - PLATFORM_CONFIG.minY) + PLATFORM_CONFIG.minY;

        let tooClose = false;
        for (const pos of platformPositions) {
            const dx = Math.abs(x - pos.x);
            const dy = Math.abs(y - pos.y);
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < PLATFORM_CONFIG.minDistance) {
                tooClose = true;
                break;
            }
        }

        if (!tooClose) {
            platformPositions.push({ x, y, width });
            const platform = createPlatform(x, y, width);
            gameState.platforms.push(platform);
            World.add(world, platform);
        }

        attempts++;
    }

    console.log('主机：平台生成完成，数量:', platformPositions.length);

    // 主机发送平台数据
    if (connection && connection.open) {
        console.log('主机：发送平台数据到客户端');
        const platformsData = platformPositions.map(pos => ({
            x: pos.x,
            y: pos.y,
            width: pos.width
        }));

        connection.send({
            type: 'platformGenerated',
            platforms: platformsData
        });
    }
}

// 修改检查是否在地面上的函数
function isOnGround(body) {
    // 使用新的碰撞检测API
    const groundCollision = Matter.Query.ray([ground], 
        { x: body.position.x, y: body.position.y }, 
        { x: body.position.x, y: body.position.y + 20 }
    );

    const platformCollisions = gameState.platforms.some(platform => {
        const collision = Matter.Collision.collides(body, platform);
        return collision && collision.collided;
    });

    return groundCollision.length > 0 || platformCollisions;
}

// 重置位置
function resetPositions() {
    Body.setPosition(gameState.local.body, INITIAL_POSITIONS.local);
    Body.setVelocity(gameState.local.body, { x: 0, y: 0 });
    gameState.local.isJumping = false;
    gameState.local.jumpCooldown = 0;
    gameState.local.jumpCount = 0;  // 重置跳跃次数

    if (gameState.remote.body) {
        Body.setPosition(gameState.remote.body, INITIAL_POSITIONS.remote);
        Body.setVelocity(gameState.remote.body, { x: 0, y: 0 });
        gameState.remote.isJumping = false;
        gameState.remote.jumpCount = 0;  // 重置跳跃次数
    }

    // 重新生成平台
    generatePlatforms();
}

// 显示连接提示
function showConnectionNotice(text, duration = 3000) {
    const notice = document.createElement('div');
    notice.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 15px 30px;
        border-radius: 5px;
        font-size: 18px;
        z-index: 1000;
        transition: opacity 0.3s;
    `;
    notice.textContent = text;
    document.body.appendChild(notice);

    setTimeout(() => {
        notice.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(notice);
        }, 300);
    }, duration);
}

// PeerJS 连接事件
peer.on('open', (id) => {
    document.getElementById('myId').textContent = id;
    
    // 添加复制按钮
    const copyButton = document.createElement('button');
    copyButton.textContent = '复制ID';
    copyButton.style.cssText = `
        margin-left: 10px;
        padding: 4px 8px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    `;
    copyButton.onclick = () => {
        navigator.clipboard.writeText(id).then(() => {
            const originalText = copyButton.textContent;
            copyButton.textContent = '已复制！';
            copyButton.style.backgroundColor = '#45a049';
            setTimeout(() => {
                copyButton.textContent = originalText;
                copyButton.style.backgroundColor = '#4CAF50';
            }, 1000);
        }).catch(err => {
            console.error('复制失败:', err);
            copyButton.textContent = '复制失败';
            copyButton.style.backgroundColor = '#f44336';
            setTimeout(() => {
                copyButton.textContent = '复制ID';
                copyButton.style.backgroundColor = '#4CAF50';
            }, 1000);
        });
    };
    
    // 将复制按钮添加到ID显示区域旁边
    const idContainer = document.getElementById('myId').parentNode;
    idContainer.appendChild(copyButton);
    
    document.getElementById('status').textContent = '已连接到服务器，等待对方加入...';
    
    // 设置为主机
    gameState.local.isHost = true;
    gameState.local.color = PLAYER_COLORS.player1;
    gameState.remote.color = PLAYER_COLORS.player2;
    
    // 创建主机玩家
    if (!gameState.local.body) {
        console.log('主机：创建本地玩家');
        gameState.local.body = createPlayer(
            INITIAL_POSITIONS.local.x,
            INITIAL_POSITIONS.local.y,
            PLAYER_COLORS.player1
        );
        World.add(world, gameState.local.body);
    }
    
    // 生成初始平台
    generatePlatforms();
});

peer.on('connection', (conn) => {
    console.log('主机：收到新的连接请求');
    connection = conn;
    setupConnection();
    document.getElementById('status').textContent = '对方已连接！';
    showConnectionNotice('玩家2已加入游戏！');
    
    // 设置连接状态
    gameState.isConnected = true;
    gameState.gameStarted = true;
    
    // 主机发送初始游戏状态
    if (gameState.local.isHost && connection && connection.open) {
        console.log('主机：准备发送初始化数据');
        
        // 重新生成平台
        generatePlatforms();
        
        // 确保主机的玩家已创建
        if (!gameState.local.body) {
            console.log('主机：创建本地玩家');
            gameState.local.body = createPlayer(
                INITIAL_POSITIONS.local.x,
                INITIAL_POSITIONS.local.y,
                PLAYER_COLORS.player1
            );
            World.add(world, gameState.local.body);
        }

        // 创建远程玩家
        if (!gameState.remote.body) {
            console.log('主机：创建远程玩家');
            gameState.remote.body = createPlayer(
                INITIAL_POSITIONS.remote.x,
                INITIAL_POSITIONS.remote.y,
                PLAYER_COLORS.player2
            );
            World.add(world, gameState.remote.body);
        }
        
        // 发送初始状态
        setTimeout(() => {
            console.log('主机：发送初始状态');
            const platformsData = gameState.platforms.map(platform => ({
                x: platform.position.x,
                y: platform.position.y,
                width: platform.bounds.max.x - platform.bounds.min.x
            }));
            
            const initialState = {
                type: 'initialState',
                localColor: PLAYER_COLORS.player2,  // 客户端的颜色
                remoteColor: PLAYER_COLORS.player1, // 主机的颜色
                platforms: platformsData,
                localPosition: INITIAL_POSITIONS.remote,  // 客户端的初始位置
                remotePosition: {  // 主机的当前位置
                    x: gameState.local.body.position.x,
                    y: gameState.local.body.position.y
                }
            };
            
            console.log('主机：发送的初始状态:', initialState);
            connection.send(initialState);
        }, 1000);
    }
});

// 修改连接到对方的函数
window.connectToPeer = () => {
    const peerId = document.getElementById('peerId').value;
    console.log('正在连接到对方:', peerId);
    
    connection = peer.connect(peerId);
    
    // 清除本地状态
    if (gameState.local.body) {
        World.remove(world, gameState.local.body);
        gameState.local.body = null;
    }
    
    // 清除远程玩家状态
    if (gameState.remote.body) {
        World.remove(world, gameState.remote.body);
        gameState.remote.body = null;
    }
    
    // 清除平台
    gameState.platforms.forEach(platform => {
        World.remove(world, platform);
    });
    gameState.platforms = [];
    
    // 清除掉落物
    gameState.collectibles.forEach(collectible => {
        World.remove(world, collectible.body);
    });
    gameState.collectibles = [];
    
    // 重置游戏状态
    gameState.local.isHost = false;
    gameState.local.score = 0;
    gameState.remote.score = 0;
    gameState.gameStarted = false;
    gameState.lastCollectibleSpawn = 0;
    
    setupConnection();
};

// 设置连接
function setupConnection() {
    if (!connection) {
        console.error('连接对象不存在');
        return;
    }

    connection.on('open', () => {
        console.log('连接已打开');
        document.getElementById('status').textContent = '连接成功！';
        showConnectionNotice('成功连接到对方！');
        gameState.remote.isConnected = true;
        gameState.isConnected = true;
        
        // 非主机初始化
        if (!gameState.local.isHost) {
            console.log('客户端：发送初始状态请求');
            // 清除现有状态
            if (gameState.local.body) {
                World.remove(world, gameState.local.body);
                gameState.local.body = null;
            }
            if (gameState.remote.body) {
                World.remove(world, gameState.remote.body);
                gameState.remote.body = null;
            }
            gameState.platforms.forEach(platform => {
                World.remove(world, platform);
            });
            gameState.platforms = [];
            
            // 请求初始状态
            if (connection.open) {
                connection.send({
                    type: 'requestInitialState'
                });
            }
        }
    });

    connection.on('data', (data) => {
        console.log('收到数据:', data.type);

        if (data.type === 'requestInitialState') {
            console.log('主机：收到初始状态请求');
            if (gameState.local.isHost && connection && connection.open) {
                console.log('主机：准备发送初始状态');
                const platformsData = gameState.platforms.map(platform => ({
                    x: platform.position.x,
                    y: platform.position.y,
                    width: platform.bounds.max.x - platform.bounds.min.x
                }));
                
                const initialState = {
                    type: 'initialState',
                    localColor: PLAYER_COLORS.player2,  // 客户端的颜色
                    remoteColor: PLAYER_COLORS.player1, // 主机的颜色
                    platforms: platformsData,
                    localPosition: INITIAL_POSITIONS.remote,  // 客户端的初始位置
                    remotePosition: {  // 主机的当前位置
                        x: gameState.local.body.position.x,
                        y: gameState.local.body.position.y
                    }
                };
                
                console.log('主机：发送初始状态:', initialState);
                connection.send(initialState);
            }
            return;
        }

        if (data.type === 'position') {
            // 确保远程玩家存在
            if (!gameState.remote.body) {
                console.log('创建远程玩家');
                gameState.remote.body = createPlayer(
                    data.x,
                    data.y,
                    gameState.remote.color
                );
                World.add(world, gameState.remote.body);
            }

            // 更新远程玩家状态
            gameState.remote.lastUpdate = Date.now();
            gameState.remote.targetPosition = { x: data.x, y: data.y };
            gameState.remote.targetVelocity = { x: data.vx, y: data.vy };
            gameState.remote.targetAngle = data.angle;
            gameState.remote.targetAngularVelocity = data.angularVelocity;
            gameState.remote.isJumping = data.isJumping;

            // 如果延迟过大，直接更新位置
            const timeDiff = Date.now() - data.timestamp;
            if (timeDiff > 200) {
                Body.setPosition(gameState.remote.body, { x: data.x, y: data.y });
                Body.setVelocity(gameState.remote.body, { x: data.vx, y: data.vy });
                Body.setAngle(gameState.remote.body, data.angle);
                Body.setAngularVelocity(gameState.remote.body, data.angularVelocity);
            }
            return;
        }

        if (data.type === 'initialState') {
            console.log('客户端：收到初始状态:', data);
            
            // 客户端接收并应用初始状态
            if (!gameState.local.isHost) {
                try {
                    // 设置颜色
                    gameState.local.color = data.localColor;
                    gameState.remote.color = data.remoteColor;
                    
                    console.log('客户端：清除并重建平台');
                    // 清除并重新创建平台
                    gameState.platforms.forEach(platform => {
                        World.remove(world, platform);
                    });
                    gameState.platforms = [];
                    
                    // 创建平台
                    data.platforms.forEach(platformData => {
                        console.log('客户端：创建平台:', platformData);
                        const platform = createPlatform(
                            platformData.x,
                            platformData.y,
                            platformData.width
                        );
                        gameState.platforms.push(platform);
                        World.add(world, platform);
                    });

                    console.log('客户端：创建玩家');
                    // 创建本地玩家（客户端）
                    if (gameState.local.body) {
                        World.remove(world, gameState.local.body);
                    }
                    gameState.local.body = createPlayer(
                        data.localPosition.x,
                        data.localPosition.y,
                        data.localColor
                    );
                    World.add(world, gameState.local.body);

                    // 创建远程玩家（主机）
                    if (gameState.remote.body) {
                        World.remove(world, gameState.remote.body);
                    }
                    gameState.remote.body = createPlayer(
                        data.remotePosition.x,
                        data.remotePosition.y,
                        data.remoteColor
                    );
                    World.add(world, gameState.remote.body);

                    // 通知主机初始化完成
                    console.log('客户端：通知主机初始化完成');
                    connection.send({
                        type: 'initComplete'
                    });
                } catch (error) {
                    console.error('客户端：应用初始状态时出错:', error);
                }
            }
            return;
        }

        if (data.type === 'score') {
            gameState.remote.score = data.score;
            updateScoreBoard();
            return;
        }

        if (data.type === 'colors') {
            // 接收颜色同步
            gameState.remote.color = data.localColor;
            gameState.local.color = data.remoteColor;
            return;
        }

        if (data.type === 'platformGenerated') {
            console.log('收到平台生成数据:', data.platforms.length);
            
            // 清除现有平台
            gameState.platforms.forEach(platform => {
                World.remove(world, platform);
            });
            gameState.platforms = [];

            // 根据收到的数据创建新平台
            data.platforms.forEach(platformData => {
                console.log('创建平台:', platformData);
                const platform = createPlatform(
                    platformData.x,
                    platformData.y,
                    platformData.width
                );
                gameState.platforms.push(platform);
                World.add(world, platform);
            });
            
            console.log('平台重建完成，数量:', gameState.platforms.length);
            return;
        }

        if (data.type === 'collectibleCreated') {
            // 同步新生成的掉落物
            const collectible = createCollectibleFromData(data.collectible);
            if (collectible) {
                gameState.collectibles.push(collectible);
                World.add(world, collectible.body);
            }
            return;
        }

        if (data.type === 'collectibleCollected') {
            // 同步掉落物被收集
            const collectible = gameState.collectibles.find(c => c.timestamp === data.timestamp);
            if (collectible) {
                World.remove(world, collectible.body);
                gameState.collectibles = gameState.collectibles.filter(c => c.timestamp !== data.timestamp);
                // 更新对方得分
                gameState.remote.score = data.score;
                updateScoreBoard();
            }
            return;
        }

        if (data.type === 'collectibleRemoved') {
            // 同步掉落物被移除
            const collectible = gameState.collectibles.find(c => c.timestamp === data.timestamp);
            if (collectible) {
                World.remove(world, collectible.body);
                gameState.collectibles = gameState.collectibles.filter(c => c.timestamp !== data.timestamp);
            }
            return;
        }
    });

    connection.on('close', () => {
        showConnectionNotice('对方已断开连接！', 5000);
        if (gameState.remote.body) {
            World.remove(world, gameState.remote.body);
            gameState.remote.body = null;
        }
        gameState.remote.isConnected = false;
        gameState.isConnected = false;  // 重置连接状态
        gameState.gameStarted = false;  // 停止游戏
        document.getElementById('status').textContent = '连接已断开，等待新的连接...';
        
        // 清理所有掉落物
        gameState.collectibles.forEach(collectible => {
            World.remove(world, collectible.body);
        });
        gameState.collectibles = [];
    });

    connection.on('error', (err) => {
        console.error('连接错误:', err);
    });
}

// 修改碰撞检测事件
Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
        console.log('碰撞检测 - bodyA category:', pair.bodyA.collisionFilter.category);
        console.log('碰撞检测 - bodyB category:', pair.bodyB.collisionFilter.category);
        console.log('碰撞检测 - COLLECTIBLE category:', COLLISION_CATEGORIES.COLLECTIBLE);
        console.log('碰撞检测 - 本地玩家body:', gameState.local.body);

        // 检查是否涉及掉落物
        let collectibleBody = null;
        let playerBody = null;

        // 确定哪个是掉落物，哪个是玩家
        if (pair.bodyA.collisionFilter.category === COLLISION_CATEGORIES.COLLECTIBLE) {
            console.log('bodyA 是掉落物');
            collectibleBody = pair.bodyA;
            if (pair.bodyB === gameState.local.body) {
                console.log('bodyB 是本地玩家');
                playerBody = pair.bodyB;
            }
        } else if (pair.bodyB.collisionFilter.category === COLLISION_CATEGORIES.COLLECTIBLE) {
            console.log('bodyB 是掉落物');
            collectibleBody = pair.bodyB;
            if (pair.bodyA === gameState.local.body) {
                console.log('bodyA 是本地玩家');
                playerBody = pair.bodyA;
            }
        }

        // 如果找到了掉落物和本地玩家的碰撞
        if (collectibleBody && playerBody) {
            console.log('找到掉落物和玩家的碰撞');
            
            // 找到对应的掉落物对象
            const collectible = gameState.collectibles.find(c => c.body === collectibleBody);
            console.log('查找到的掉落物:', collectible);
            
            if (collectible) {
                console.log('准备处理掉落物');
                console.log('掉落物颜色:', collectible.color);
                console.log('玩家颜色:', gameState.local.color);
                
                // 移除掉落物
                World.remove(world, collectible.body);
                gameState.collectibles = gameState.collectibles.filter(c => c.body !== collectible.body);
                console.log('移除掉落物后的数量:', gameState.collectibles.length);
                
                // 根据颜色判断加分还是扣分
                if (collectible.color === gameState.local.color) {
                    // 颜色相同，加一分
                    gameState.local.score += 1;
                    console.log('收集相同颜色，加一分，当前得分:', gameState.local.score);
                } else {
                    // 颜色不同，扣一分
                    gameState.local.score = Math.max(0, gameState.local.score - 1); // 防止得分为负数
                    console.log('收集不同颜色，扣一分，当前得分:', gameState.local.score);
                }

                // 通知对方掉落物被收集
                if (connection && connection.open) {
                    console.log('发送掉落物收集消息给对方');
                    connection.send({
                        type: 'collectibleCollected',
                        timestamp: collectible.timestamp,
                        score: gameState.local.score
                    });
                }
            }
        }
    });
});

// 修改掉落物创建函数
function createCollectibleFromData(data) {
    try {
        console.log('开始创建掉落物:', data);
        let body;
        const size = COLLECTIBLE_CONFIG.size;
        const commonProperties = {
            isStatic: false,
            isSensor: false,  // 改为 false，使其能与平台产生物理碰撞
            render: { fillStyle: data.color },
            label: 'collectible',
            friction: 0.001,
            frictionAir: 0.001,
            restitution: 0.3,
            collisionFilter: {
                category: COLLISION_CATEGORIES.COLLECTIBLE,
                mask: COLLISION_CATEGORIES.PLATFORM | COLLISION_CATEGORIES.PLAYER  // 允许与平台和玩家碰撞
            }
        };

        console.log('掉落物碰撞设置:', commonProperties.collisionFilter);

        switch (data.type) {
            case 'circle':
                body = Bodies.circle(data.x, data.y, size / 2, commonProperties);
                break;
            case 'triangle':
                body = Bodies.polygon(data.x, data.y, 3, size / 2, commonProperties);
                break;
            case 'rectangle':
                body = Bodies.rectangle(data.x, data.y, size, size, commonProperties);
                break;
        }

        if (body) {
            console.log('掉落物创建成功:', body);
            Body.setVelocity(body, { x: 0, y: COLLECTIBLE_CONFIG.fallSpeed });
            return { body, color: data.color, timestamp: data.timestamp, type: data.type };
        }
    } catch (error) {
        console.error('创建掉落物时出错:', error);
    }
    return null;
}

// 修改生成掉落物的函数
function spawnCollectible() {
    if (!gameState.local.isHost) {
        console.log('非主机，不生成掉落物');
        return;
    }
    if (!gameState.isConnected) {
        console.log('未连接，不生成掉落物');
        return;
    }
    if (gameState.collectibles.length >= COLLECTIBLE_CONFIG.maxCount) {
        console.log('掉落物数量已达上限:', gameState.collectibles.length);
        return;
    }

    const now = Date.now();
    if (now - gameState.lastCollectibleSpawn < COLLECTIBLE_CONFIG.spawnInterval) {
        return;
    }

    console.log('开始生成新的掉落物');
    const type = COLLECTIBLE_CONFIG.types[Math.floor(Math.random() * COLLECTIBLE_CONFIG.types.length)];
    const color = COLLECTIBLE_CONFIG.colors[Math.floor(Math.random() * COLLECTIBLE_CONFIG.colors.length)];
    const x = Math.random() * (canvas.width - 80) + 40;
    const y = 0;

    const collectibleData = {
        type,
        color,
        x,
        y,
        timestamp: now
    };

    console.log('生成掉落物数据:', collectibleData);
    const collectible = createCollectibleFromData(collectibleData);
    if (collectible) {
        console.log('添加掉落物到游戏世界');
        gameState.collectibles.push(collectible);
        World.add(world, collectible.body);
        gameState.lastCollectibleSpawn = now;

        // 发送生成消息给客户端
        if (connection && connection.open) {
            console.log('发送掉落物生成消息给客户端');
            connection.send({
                type: 'collectibleCreated',
                collectible: collectibleData
            });
        }
    }
}

// 修改键盘控制对象，添加按键状态跟踪
let keys = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: { pressed: false, justPressed: false },
    ' ': { pressed: false, justPressed: false }
};

// 修改键盘按下事件
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        keys[e.key] = true;
    } else if (e.key === 'ArrowUp' || e.key === ' ') {
        if (!keys[e.key].pressed) {
            keys[e.key].justPressed = true;
        }
        keys[e.key].pressed = true;
    }
});

// 修改键盘释放事件
document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        keys[e.key] = false;
    } else if (e.key === 'ArrowUp' || e.key === ' ') {
        keys[e.key].pressed = false;
        keys[e.key].justPressed = false;
    }
});

// 修改更新玩家移动函数
function updatePlayerMovement() {
    if (!gameState.local.body) {
        console.log('无法更新玩家移动：本地玩家不存在');
        return;
    }

    const velocity = gameState.local.body.velocity;
    let force = { x: 0, y: 0 };

    // 检查是否在地面上
    const onGround = isOnGround(gameState.local.body);
    
    // 在地面上时重置跳跃次数
    if (onGround) {
        gameState.local.jumpCount = 0;
    }

    // 处理跳跃
    const jumpKeyJustPressed = keys.ArrowUp.justPressed || keys[' '].justPressed;
    if (jumpKeyJustPressed && gameState.local.jumpCooldown <= 0) {
        console.log('玩家尝试跳跃');
        if (onGround || (!onGround && gameState.local.jumpCount < 2)) {
            const jumpVelocity = gameState.local.jumpCount === 0 ? -6 : -5;
            Body.setVelocity(gameState.local.body, { 
                x: velocity.x, 
                y: jumpVelocity
            });
            console.log('玩家跳跃成功，速度:', jumpVelocity);
            gameState.local.isJumping = true;
            gameState.local.jumpCooldown = PHYSICS.jumpCooldown;
            gameState.local.jumpCount++;
        }
    }

    // 重置justPressed状态
    keys.ArrowUp.justPressed = false;
    keys[' '].justPressed = false;

    // 处理左右移动
    if (keys.ArrowLeft) {
        force.x = -PHYSICS.moveForce;
    }
    if (keys.ArrowRight) {
        force.x = PHYSICS.moveForce;
    }

    if (force.x !== 0) {
        Body.applyForce(gameState.local.body, 
            gameState.local.body.position, 
            force
        );
        console.log('应用移动力:', force);
        
        // 限制最大水平速度
        const maxSpeed = 3;
        if (Math.abs(gameState.local.body.velocity.x) > maxSpeed) {
            Body.setVelocity(gameState.local.body, {
                x: Math.sign(gameState.local.body.velocity.x) * maxSpeed,
                y: gameState.local.body.velocity.y
            });
            console.log('限制水平速度:', gameState.local.body.velocity);
        }
    } else {
        // 当没有按键时，添加更强的减速
        if (Math.abs(velocity.x) > 0.1) {
            Body.setVelocity(gameState.local.body, {
                x: velocity.x * 0.92,
                y: velocity.y
            });
        }
    }
}

// 添加特效更新函数
function updateEffects() {
    // 更新本地玩家轨迹
    if (gameState.local.body) {
        // 添加新的轨迹点
        if (Math.abs(gameState.local.body.velocity.x) > 0.5 || Math.abs(gameState.local.body.velocity.y) > 0.5) {
            gameState.local.effects.trail.push({
                x: gameState.local.body.position.x,
                y: gameState.local.body.position.y,
                life: 15,
                maxLife: 15,
                color: gameState.local.color
            });
        }
    }

    // 更新远程玩家轨迹
    if (gameState.remote.body) {
        if (Math.abs(gameState.remote.body.velocity.x) > 0.5 || Math.abs(gameState.remote.body.velocity.y) > 0.5) {
            gameState.remote.effects.trail.push({
                x: gameState.remote.body.position.x,
                y: gameState.remote.body.position.y,
                life: 15,
                maxLife: 15,
                color: gameState.remote.color
            });
        }
    }

    // 更新轨迹生命周期
    [gameState.local.effects.trail, gameState.remote.effects.trail].forEach(trail => {
        for (let i = trail.length - 1; i >= 0; i--) {
            trail[i].life--;
            if (trail[i].life <= 0) {
                trail.splice(i, 1);
            }
        }
    });

    // 更新跳跃粒子
    [gameState.local.effects.jumpParticles, gameState.remote.effects.jumpParticles].forEach(particles => {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.2; // 粒子重力
            p.life--;
            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }
    });
}

// 添加特效渲染函数
function renderEffects() {
    // 渲染轨迹
    [gameState.local.effects.trail, gameState.remote.effects.trail].forEach(trail => {
        trail.forEach(point => {
            ctx.beginPath();
            ctx.fillStyle = `${point.color}${Math.floor((point.life / point.maxLife) * 255).toString(16).padStart(2, '0')}`;
            ctx.arc(point.x, point.y, 3 * (point.life / point.maxLife), 0, Math.PI * 2);
            ctx.fill();
        });
    });

    // 渲染跳跃粒子
    [gameState.local.effects.jumpParticles, gameState.remote.effects.jumpParticles].forEach((particles, idx) => {
        const baseColor = idx === 0 ? gameState.local.color : gameState.remote.color;
        particles.forEach(p => {
            ctx.beginPath();
            // 二段跳的粒子使用不同的颜色
            const color = p.isSecondJump ? '#FFD700' : baseColor;
            ctx.fillStyle = `${color}${Math.floor((p.life / p.maxLife) * 255).toString(16).padStart(2, '0')}`;
            ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
            ctx.fill();
        });
    });
}

// 修改渲染玩家标识和得分的函数
function renderPlayerIndicator(body, color, score, isLocal) {
    if (!body) return;
    
    const yOffset = -25;
    const size = 15;
    
    // 绘制得分
    ctx.fillStyle = '#000';  // 文字描边颜色
    ctx.strokeStyle = '#fff';  // 文字颜色
    ctx.lineWidth = 3;
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    const scoreY = body.position.y + yOffset - size - 25;  // 将得分显示在标识上方
    const scoreText = score.toString();
    ctx.strokeText(scoreText, body.position.x, scoreY);  // 先绘制描边
    ctx.fillText(scoreText, body.position.x, scoreY);    // 再绘制文字
    
    // 只为本地玩家显示"我"的标识
    if (isLocal) {
        // 绘制三角形（箭头向下）
        ctx.beginPath();
        ctx.moveTo(body.position.x, body.position.y + yOffset);  // 三角形尖端
        ctx.lineTo(body.position.x - size/2, body.position.y + yOffset - size);  // 左边点
        ctx.lineTo(body.position.x + size/2, body.position.y + yOffset - size);  // 右边点
        ctx.closePath();
        
        // 添加描边使三角形更明显
        ctx.fillStyle = PLAYER_COLORS.indicator;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
        
        // 添加"我"的标识
        ctx.fillStyle = '#000';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        const textY = body.position.y + yOffset - size - 8;
        ctx.strokeText('我', body.position.x, textY);
        ctx.fillText('我', body.position.x, textY);
    }
}

// 游戏循环
function gameLoop() {
    // 更新跳跃冷却
    if (gameState.local.jumpCooldown > 0) {
        gameState.local.jumpCooldown--;
    }

    // 更新玩家移动
    updatePlayerMovement();

    // 发送位置数据
    if (connection && connection.open && gameState.local.body) {
        const currentTime = Date.now();
        // 每16ms（约60fps）发送一次位置更新
        if (!gameState.local.lastPositionUpdate || currentTime - gameState.local.lastPositionUpdate >= 16) {
            const positionData = {
                type: 'position',
                x: gameState.local.body.position.x,
                y: gameState.local.body.position.y,
                vx: gameState.local.body.velocity.x,
                vy: gameState.local.body.velocity.y,
                angle: gameState.local.body.angle,
                angularVelocity: gameState.local.body.angularVelocity,
                isJumping: gameState.local.isJumping,
                timestamp: currentTime
            };
            connection.send(positionData);
            gameState.local.lastPositionUpdate = currentTime;
        }
    }

    // 更新远程玩家插值
    if (gameState.remote.body && gameState.remote.targetPosition) {
        const timeDiff = Date.now() - gameState.remote.lastUpdate;
        const alpha = Math.min(timeDiff / 16, 1); // 使用16ms作为插值时间

        // 位置插值
        const newX = gameState.remote.body.position.x + 
            (gameState.remote.targetPosition.x - gameState.remote.body.position.x) * alpha;
        const newY = gameState.remote.body.position.y + 
            (gameState.remote.targetPosition.y - gameState.remote.body.position.y) * alpha;
        
        // 速度插值
        let newVX = gameState.remote.body.velocity.x;
        let newVY = gameState.remote.body.velocity.y;
        if (gameState.remote.targetVelocity) {
            newVX = gameState.remote.body.velocity.x + 
                (gameState.remote.targetVelocity.x - gameState.remote.body.velocity.x) * alpha;
            newVY = gameState.remote.body.velocity.y + 
                (gameState.remote.targetVelocity.y - gameState.remote.body.velocity.y) * alpha;
        }

        // 应用新的位置和速度
        Body.setPosition(gameState.remote.body, { x: newX, y: newY });
        Body.setVelocity(gameState.remote.body, { x: newVX, y: newVY });

        // 角度和角速度插值
        if (gameState.remote.targetAngle !== null) {
            const newAngle = gameState.remote.body.angle + 
                (gameState.remote.targetAngle - gameState.remote.body.angle) * alpha;
            Body.setAngle(gameState.remote.body, newAngle);
        }
        if (gameState.remote.targetAngularVelocity !== null) {
            const newAngularVel = gameState.remote.body.angularVelocity + 
                (gameState.remote.targetAngularVelocity - gameState.remote.body.angularVelocity) * alpha;
            Body.setAngularVelocity(gameState.remote.body, newAngularVel);
        }
    }

    // 更新特效
    updateEffects();

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 渲染特效
    renderEffects();

    // 渲染所有物体
    const bodies = Matter.Composite.allBodies(world);
    bodies.forEach(body => {
        if (body === gameState.local.body) {
            ctx.fillStyle = gameState.local.color;
        } else if (body === gameState.remote.body) {
            ctx.fillStyle = gameState.remote.color;
        } else if (gameState.platforms.includes(body)) {
            ctx.fillStyle = PLATFORM_CONFIG.color;
        } else if (gameState.collectibles.find(c => c.body === body)) {
            const collectible = gameState.collectibles.find(c => c.body === body);
            ctx.fillStyle = collectible.color;
        } else {
            ctx.fillStyle = '#333';
        }

        const vertices = body.vertices;
        ctx.beginPath();
        ctx.moveTo(vertices[0].x, vertices[0].y);
        for (let j = 1; j < vertices.length; j++) {
            ctx.lineTo(vertices[j].x, vertices[j].y);
        }
        ctx.lineTo(vertices[0].x, vertices[0].y);
        ctx.fill();
    });

    // 渲染玩家标识和得分
    if (gameState.local.body) {
        renderPlayerIndicator(gameState.local.body, gameState.local.color, gameState.local.score, true);
    }
    if (gameState.remote.body) {
        renderPlayerIndicator(gameState.remote.body, gameState.remote.color, gameState.remote.score, false);
    }

    // 生成掉落物
    if (gameState.gameStarted && gameState.isConnected) {
        spawnCollectible();
    }

    // 清理超出边界的掉落物
    for (let i = gameState.collectibles.length - 1; i >= 0; i--) {
        const collectible = gameState.collectibles[i];
        if (collectible.body.position.y > canvas.height + 50) {  // 超出底部边界
            World.remove(world, collectible.body);
            gameState.collectibles.splice(i, 1);

            // 通知对方移除掉落物
            if (connection && connection.open) {
                connection.send({
                    type: 'collectibleRemoved',
                    timestamp: collectible.timestamp
                });
            }
        }
    }

    requestAnimationFrame(gameLoop);
}

// 在游戏初始化时生成平台
generatePlatforms();

// 添加操作说明面板
const controlsPanel = document.createElement('div');
controlsPanel.style.cssText = `
    position: fixed;
    top: 60px;
    right: 10px;
    padding: 15px;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    border-radius: 8px;
    font-size: 14px;
    line-height: 1.5;
    z-index: 1000;
`;

controlsPanel.innerHTML = `
    <h3 style="margin: 0 0 10px 0; color: #4CAF50;">操作说明</h3>
    <div style="margin-bottom: 5px;">↑ 或 空格：跳跃</div>
    <div style="margin-bottom: 5px;">← ：向左移动</div>
    <div style="margin-bottom: 5px;">→ ：向右移动</div>
    <div style="margin-top: 10px; font-size: 12px; color: #aaa;">
        提示：可以在平台上跳跃
    </div>
`;

document.body.appendChild(controlsPanel);

// 添加平台重生成按钮
const regenerateButton = document.createElement('button');
regenerateButton.textContent = '重新生成平台';
regenerateButton.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    padding: 8px 16px;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
`;
regenerateButton.onclick = () => {
    // 只有主机可以重新生成平台
    if (gameState.local.isHost) {
        generatePlatforms();
    }
};
document.body.appendChild(regenerateButton);

// 添加准备按钮
function createReadyButton() {
    const readyButton = document.createElement('button');
    readyButton.id = 'readyButton';
    readyButton.textContent = '准备';
    readyButton.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        padding: 8px 16px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    `;
    
    readyButton.onclick = () => {
        if (!gameState.local.isReady) {
            gameState.local.isReady = true;
            readyButton.textContent = '已准备';
            readyButton.style.backgroundColor = '#45a049';
            
            // 发送准备状态
            if (connection && connection.open) {
                connection.send({
                    type: 'ready',
                    value: true
                });
            }
            
            // 检查是否可以开始游戏
            checkGameStart();
        }
    };
    
    document.body.appendChild(readyButton);
}

// 检查游戏是否可以开始
function checkGameStart() {
    console.log('检查游戏开始条件:', {
        localReady: gameState.local.isReady,
        remoteReady: gameState.remote.isReady,
        isHost: gameState.local.isHost
    });
    
    if (gameState.local.isReady && gameState.remote.isReady) {
        // 只有主机开始倒计时
        if (gameState.local.isHost) {
            console.log('双方都已准备，开始倒计时');
            showCountdown();
        }
    }
}

// 启动游戏循环
gameLoop();

// 修改 updateScoreBoard 函数
function updateScoreBoard() {
    // 只保留日志输出
    console.log('更新得分:', gameState.local.score, gameState.remote.score);
} 