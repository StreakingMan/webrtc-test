import { Peer } from 'peerjs';
import { createPlayer } from '../objects/gameObjects';
import { INITIAL_POSITIONS, PLAYER_COLORS, COLLISION_CATEGORIES } from '../config/phaserConfig';

export default class NetworkManager {
    constructor(gameState, scene, generatePlatforms, resetPositions) {
        this.gameState = gameState;
        this.scene = scene;
        this.generatePlatforms = generatePlatforms;
        this.resetPositions = resetPositions;
        this.peer = null;
        this.connection = null;
        this.callbacks = {};
    }

    // 初始化 PeerJS
    initialize() {
        this.peer = new Peer({
            debug: 2
        });

        this.setupPeerEvents();
        return this.peer;
    }

    // 设置对等连接事件
    setupPeerEvents() {
        this.peer.on('open', (id) => {
            this.onPeerOpen(id);
        });

        this.peer.on('connection', (conn) => {
            this.onPeerConnection(conn);
        });
    }

    // 处理 peer open 事件
    onPeerOpen(id) {
        this.updateStatusDisplay('已连接到服务器，等待对方加入...');
        
        // 设置为主机
        this.gameState.local.isHost = true;
        this.gameState.local.color = PLAYER_COLORS.player1;
        this.gameState.remote.color = PLAYER_COLORS.player2;
        
        // 创建主机玩家
        if (!this.gameState.local.body) {
            console.log('主机：创建本地玩家');
            this.gameState.local.body = createPlayer(
                INITIAL_POSITIONS.local.x,
                INITIAL_POSITIONS.local.y,
                PLAYER_COLORS.player1
            );
            
            if (this.scene && this.scene.matter) {
                this.scene.matter.world.add(this.gameState.local.body);
            }
        }
        
        // 主机初始生成平台，使游戏可以单人游玩
        console.log('主机：生成初始平台');
        this.generatePlatforms();
        
        // 初始化lastPlatformRegen，避免连接后立即重新生成
        this.gameState.lastPlatformRegen = Date.now();

        if (this.callbacks.onOpen) {
            this.callbacks.onOpen(id);
        }
    }

    // 处理 peer connection 事件
    onPeerConnection(conn) {
        console.log('主机：收到新的连接请求');
        this.connection = conn;
        this.setupConnection();
        this.updateStatusDisplay('对方已连接！');
        
        // 设置连接状态
        this.gameState.isConnected = true;
        this.gameState.gameStarted = true;
        
        // 主机发送初始游戏状态
        if (this.gameState.local.isHost && this.connection && this.connection.open) {
            console.log('主机：准备发送初始化数据');
            
            // 确保主机的玩家已创建
            if (!this.gameState.local.body) {
                console.log('主机：创建本地玩家');
                this.gameState.local.body = createPlayer(
                    INITIAL_POSITIONS.local.x,
                    INITIAL_POSITIONS.local.y,
                    PLAYER_COLORS.player1
                );
                
                if (this.scene && this.scene.matter) {
                    this.scene.matter.world.add(this.gameState.local.body);
                }
            }

            // 创建远程玩家
            if (!this.gameState.remote.body) {
                console.log('主机：创建远程玩家');
                this.gameState.remote.body = createPlayer(
                    INITIAL_POSITIONS.remote.x,
                    INITIAL_POSITIONS.remote.y,
                    PLAYER_COLORS.player2
                );
                
                if (this.scene && this.scene.matter) {
                    this.scene.matter.world.add(this.gameState.remote.body);
                }
            }
            
            // 改为先发送准备信号，确保客户端已准备好接收数据
            setTimeout(() => {
                console.log('主机：发送准备信号');
                this.connection.send({
                    type: 'prepareForInitialState'
                });
                
                // 等待客户端回应准备好后再生成平台并发送数据
            }, 300);
        }

        if (this.callbacks.onConnection) {
            this.callbacks.onConnection(conn);
        }
    }

    // 连接到对方
    connectToPeer(peerId) {
        console.log('正在连接到对方:', peerId);
        
        // 确保 peer 已经初始化完成
        if (!this.peer.id) {
            console.log('等待 peer 初始化完成...');
            this.peer.on('open', () => {
                console.log('peer 初始化完成，开始连接');
                this.connection = this.peer.connect(peerId);
                this.setupConnection();
            });
        } else {
            console.log('peer 已初始化，直接连接');
            this.connection = this.peer.connect(peerId);
            this.setupConnection();
        }
        
        // 清除本地状态
        if (this.gameState.local.body) {
            this.scene.matter.world.remove(this.gameState.local.body);
            this.gameState.local.body = null;
        }
        
        // 清除远程玩家状态
        if (this.gameState.remote.body) {
            this.scene.matter.world.remove(this.gameState.remote.body);
            this.gameState.remote.body = null;
        }
        
        // 清除平台
        this.gameState.platforms.forEach(platform => {
            this.scene.matter.world.remove(platform);
        });
        this.gameState.platforms = [];
        
        // 清除掉落物
        this.gameState.collectibles.forEach(collectible => {
            this.scene.matter.world.remove(collectible.body);
        });
        this.gameState.collectibles = [];
        
        // 重置游戏状态
        this.gameState.local.isHost = false;
        this.gameState.local.score = 0;
        this.gameState.remote.score = 0;
        this.gameState.gameStarted = false;
        this.gameState.lastCollectibleSpawn = 0;
        this.gameState.lastReceivedPlatformSeed = null; // 重置平台种子记录
    }

    // 设置连接
    setupConnection() {
        if (!this.connection) {
            console.error('连接对象不存在');
            return;
        }

        this.connection.on('open', () => {
            this.onConnectionOpen();
        });

        this.connection.on('data', (data) => {
            this.onConnectionData(data);
        });

        this.connection.on('close', () => {
            this.onConnectionClose();
        });

        this.connection.on('error', (err) => {
            console.error('连接错误:', err);
        });
    }

    // 处理连接打开事件
    onConnectionOpen() {
        console.log('连接已打开');
        this.updateStatusDisplay('连接成功！');
        this.gameState.remote.isConnected = true;
        this.gameState.isConnected = true;
        
        // 非主机初始化
        if (!this.gameState.local.isHost) {
            console.log('客户端：发送初始状态请求');
            // 清除现有状态，但保留平台直到收到主机的平台数据
            if (this.gameState.local.body) {
                this.scene.matter.world.remove(this.gameState.local.body);
                this.gameState.local.body = null;
            }
            if (this.gameState.remote.body) {
                this.scene.matter.world.remove(this.gameState.remote.body);
                this.gameState.remote.body = null;
            }
            
            // 请求初始状态
            if (this.connection.open) {
                this.connection.send({
                    type: 'requestInitialState'
                });
            }
        }
        
        // 重置平台重生成时间
        this.gameState.lastPlatformRegen = Date.now();

        if (this.callbacks.onConnectionOpen) {
            this.callbacks.onConnectionOpen();
        }
    }

    // 处理连接数据
    onConnectionData(data) {
        console.log('收到数据:', data.type);

        if (data.type === 'requestInitialState') {
            console.log('主机：收到初始状态请求');
            if (this.gameState.local.isHost && this.connection && this.connection.open) {
                console.log('主机：回复准备信号');
                this.connection.send({
                    type: 'prepareForInitialState'
                });
            }
            return;
        }
        
        if (data.type === 'prepareForInitialState') {
            console.log('收到准备信号');
            
            if (this.gameState.local.isHost) {
                // 主机收到客户端准备完成的回应，开始生成平台并发送数据
                console.log('主机：收到客户端准备完成回应，开始生成平台');
                
                // 清除现有平台
                this.gameState.platforms.forEach(platform => {
                    this.scene.matter.world.remove(platform);
                });
                this.gameState.platforms = [];
                
                // 生成平台并获取平台数据
                const platformData = this.generatePlatforms();
                
                // 然后发送初始状态（不包含平台信息，平台信息已通过setExactPlatforms发送）
                setTimeout(() => {
                    console.log('主机：发送初始状态');
                    
                    const initialState = {
                        type: 'initialState',
                        localColor: PLAYER_COLORS.player2,
                        remoteColor: PLAYER_COLORS.player1,
                        localPosition: INITIAL_POSITIONS.remote,
                        remotePosition: {
                            x: this.gameState.local.body.position.x,
                            y: this.gameState.local.body.position.y
                        }
                    };
                    
                    console.log('主机：发送的初始状态:', initialState);
                    this.connection.send(initialState);
                }, 500);
            } else {
                // 客户端收到准备信号，清除现有状态，准备接收新数据
                console.log('客户端：收到准备信号，准备接收数据');
                
                // 清除玩家
                if (this.gameState.local.body) {
                    this.scene.matter.world.remove(this.gameState.local.body);
                    this.gameState.local.body = null;
                }
                if (this.gameState.remote.body) {
                    this.scene.matter.world.remove(this.gameState.remote.body);
                    this.gameState.remote.body = null;
                }
                
                // 回应主机，表示已准备好
                if (this.connection && this.connection.open) {
                    console.log('客户端：回应准备完成');
                    this.connection.send({
                        type: 'prepareForInitialState'
                    });
                }
            }
            return;
        }

        if (data.type === 'position') {
            // 确保远程玩家存在
            if (!this.gameState.remote.body) {
                console.log('创建远程玩家');
                this.gameState.remote.body = createPlayer(
                    data.x,
                    data.y,
                    this.gameState.remote.color
                );
                
                if (this.scene && this.scene.matter) {
                    this.scene.matter.world.add(this.gameState.remote.body);
                }
            }

            // 更新远程玩家状态
            this.gameState.remote.lastUpdate = Date.now();
            this.gameState.remote.targetPosition = { x: data.x, y: data.y };
            this.gameState.remote.targetVelocity = { x: data.vx, y: data.vy };
            this.gameState.remote.targetAngle = data.angle;
            this.gameState.remote.targetAngularVelocity = data.angularVelocity;
            this.gameState.remote.isJumping = data.isJumping;

            // 如果延迟过大，直接更新位置
            const timeDiff = Date.now() - data.timestamp;
            if (timeDiff > 200) {
                this.scene.matter.body.setPosition(this.gameState.remote.body, { x: data.x, y: data.y });
                this.scene.matter.body.setVelocity(this.gameState.remote.body, { x: data.vx, y: data.vy });
                this.scene.matter.body.setAngle(this.gameState.remote.body, data.angle);
                this.scene.matter.body.setAngularVelocity(this.gameState.remote.body, data.angularVelocity);
            }
            return;
        }

        if (data.type === 'initialState') {
            console.log('客户端：收到初始状态:', data);
            
            // 客户端接收并应用初始状态
            if (!this.gameState.local.isHost) {
                try {
                    // 设置颜色
                    this.gameState.local.color = data.localColor;
                    this.gameState.remote.color = data.remoteColor;
                    
                    console.log('客户端：清除并重建平台');
                    // 清除并重新创建平台
                    this.gameState.platforms.forEach(platform => {
                        this.scene.matter.world.remove(platform);
                    });
                    this.gameState.platforms = [];
                    
                    // 设置平台种子与主机一致
                    if (data.platformSeed) {
                        this.gameState.lastReceivedPlatformSeed = data.platformSeed;
                        console.log('客户端：设置平台种子:', data.platformSeed);
                    }
                    
                    // 创建平台
                    if (data.platforms) {
                        data.platforms.forEach(platformData => {
                            console.log('客户端：创建平台:', platformData);
                            const platform = createPlatform(
                                platformData.x,
                                platformData.y,
                                platformData.width
                            );
                            this.gameState.platforms.push(platform);
                            
                            if (this.scene && this.scene.matter) {
                                this.scene.matter.world.add(platform);
                            }
                        });
                    }

                    console.log('客户端：创建玩家');
                    // 创建本地玩家（客户端）
                    if (this.gameState.local.body) {
                        this.scene.matter.world.remove(this.gameState.local.body);
                    }
                    this.gameState.local.body = createPlayer(
                        data.localPosition.x,
                        data.localPosition.y,
                        data.localColor
                    );
                    
                    if (this.scene && this.scene.matter) {
                        this.scene.matter.world.add(this.gameState.local.body);
                    }

                    // 创建远程玩家（主机）
                    if (this.gameState.remote.body) {
                        this.scene.matter.world.remove(this.gameState.remote.body);
                    }
                    this.gameState.remote.body = createPlayer(
                        data.remotePosition.x,
                        data.remotePosition.y,
                        data.remoteColor
                    );
                    
                    if (this.scene && this.scene.matter) {
                        this.scene.matter.world.add(this.gameState.remote.body);
                    }

                    // 重置平台重生成时间，与主机保持同步
                    this.gameState.lastPlatformRegen = Date.now();

                    // 通知主机初始化完成
                    console.log('客户端：通知主机初始化完成');
                    this.connection.send({
                        type: 'initComplete',
                        platformsCount: this.gameState.platforms.length  // 发送平台数量作为确认
                    });
                } catch (error) {
                    console.error('客户端：应用初始状态时出错:', error);
                }
            }
            return;
        }

        if (data.type === 'score') {
            this.gameState.remote.score = data.score;
            if (this.callbacks.onScoreUpdate) {
                this.callbacks.onScoreUpdate();
            }
            return;
        }

        if (data.type === 'collectibleCreated') {
            // 处理掉落物创建消息
            if (this.callbacks.onCollectibleCreated) {
                this.callbacks.onCollectibleCreated(data.collectible);
            }
            return;
        }

        if (data.type === 'collectibleCollected') {
            // 处理掉落物被收集消息
            if (this.callbacks.onCollectibleCollected) {
                this.callbacks.onCollectibleCollected(data.timestamp, data.score);
            }
            return;
        }

        if (data.type === 'collectibleRemoved') {
            // 处理掉落物被移除消息
            if (this.callbacks.onCollectibleRemoved) {
                this.callbacks.onCollectibleRemoved(data.timestamp);
            }
            return;
        }

        if (data.type === 'gameOver') {
            this.gameState.gameOver = true;
            this.gameState.winner = data.winner;
            if (data.winner === 'remote') {
                if (this.callbacks.onGameOver) {
                    this.callbacks.onGameOver('对方赢了！');
                }
            }
            return;
        }

        if (data.type === 'rematchRequest') {
            if (this.callbacks.onRematchRequest) {
                this.callbacks.onRematchRequest();
            }
            return;
        }

        if (data.type === 'rematchAccepted') {
            if (this.callbacks.onRematchAccepted) {
                this.callbacks.onRematchAccepted();
            }
            return;
        }

        if (data.type === 'setExactPlatforms') {
            console.log('收到精确平台数据:', data);
            
            // 如果是重复的消息，忽略
            if (this.gameState.lastReceivedPlatformSeed === data.seed && 
                this.gameState.lastReceivedPlatformTimestamp === data.timestamp) {
                console.log('忽略重复的平台数据');
                return;
            }
            
            // 记录接收的种子和时间戳
            this.gameState.lastReceivedPlatformSeed = data.seed;
            this.gameState.lastReceivedPlatformTimestamp = data.timestamp;
            
            // 使用客户端模式生成平台
            this.generatePlatforms(data.platforms);
            
            // 重置平台重生成时间
            this.gameState.lastPlatformRegen = Date.now();
            
            // 发送确认消息
            if (this.connection && this.connection.open) {
                this.connection.send({
                    type: 'platformsReady',
                    seed: data.seed,
                    timestamp: data.timestamp,
                    count: this.gameState.platforms.length
                });
            }
            
            return;
        }
        
        if (data.type === 'platformsReady') {
            console.log('客户端已准备好平台，数量:', data.count);
            
            // 验证平台数量
            if (data.count !== this.gameState.platforms.length) {
                console.warn('平台数量不匹配!', '主机:', this.gameState.platforms.length, '客户端:', data.count);
                
                // 如果数量不匹配，重新发送平台数据
                if (this.gameState.local.isHost && this.connection && this.connection.open) {
                    console.log('重新发送平台数据');
                    const platformData = this.gameState.platforms.map(platform => ({
                        x: platform.position.x,
                        y: platform.position.y,
                        width: platform.bounds.max.x - platform.bounds.min.x
                    }));
                    
                    this.connection.send({
                        type: 'setExactPlatforms',
                        seed: this.gameState.lastPlatformSeed,
                        timestamp: Date.now(),
                        platforms: platformData
                    });
                }
            }
            
            return;
        }

        // 添加初始化完成处理
        if (data.type === 'initComplete') {
            console.log('主机：收到客户端初始化完成消息，平台数:', data.platformsCount);
            console.log('客户端平台数量:', data.platformsCount, '主机平台数量:', this.gameState.platforms.length);
            return;
        }
    }

    // 处理连接关闭事件
    onConnectionClose() {
        this.updateStatusDisplay('对方已断开连接！');
        if (this.gameState.remote.body) {
            this.scene.matter.world.remove(this.gameState.remote.body);
            this.gameState.remote.body = null;
        }
        this.gameState.remote.isConnected = false;
        this.gameState.isConnected = false;  // 重置连接状态
        this.gameState.gameStarted = false;  // 停止游戏
        this.updateStatusDisplay('连接已断开，等待新的连接...');
        
        // 清理所有掉落物
        this.gameState.collectibles.forEach(collectible => {
            this.scene.matter.world.remove(collectible.body);
        });
        this.gameState.collectibles = [];

        if (this.callbacks.onConnectionClose) {
            this.callbacks.onConnectionClose();
        }
    }

    // 发送位置更新
    sendPositionUpdate() {
        if (this.connection && this.connection.open && this.gameState.local.body) {
            const currentTime = Date.now();
            // 每16ms（约60fps）发送一次位置更新
            if (!this.gameState.local.lastPositionUpdate || currentTime - this.gameState.local.lastPositionUpdate >= 16) {
                const positionData = {
                    type: 'position',
                    x: this.gameState.local.body.position.x,
                    y: this.gameState.local.body.position.y,
                    vx: this.gameState.local.body.velocity.x,
                    vy: this.gameState.local.body.velocity.y,
                    angle: this.gameState.local.body.angle,
                    angularVelocity: this.gameState.local.body.angularVelocity,
                    isJumping: this.gameState.local.isJumping,
                    timestamp: currentTime
                };
                this.connection.send(positionData);
                this.gameState.local.lastPositionUpdate = currentTime;
            }
        }
    }

    // 更新远程玩家位置
    updateRemotePlayerPosition() {
        if (this.gameState.remote.body && this.gameState.remote.targetPosition) {
            const timeDiff = Date.now() - this.gameState.remote.lastUpdate;
            const alpha = Math.min(timeDiff / 16, 1); // 使用16ms作为插值时间

            // 位置插值
            const newX = this.gameState.remote.body.position.x + 
                (this.gameState.remote.targetPosition.x - this.gameState.remote.body.position.x) * alpha;
            const newY = this.gameState.remote.body.position.y + 
                (this.gameState.remote.targetPosition.y - this.gameState.remote.body.position.y) * alpha;
            
            // 速度插值
            let newVX = this.gameState.remote.body.velocity.x;
            let newVY = this.gameState.remote.body.velocity.y;
            if (this.gameState.remote.targetVelocity) {
                newVX = this.gameState.remote.body.velocity.x + 
                    (this.gameState.remote.targetVelocity.x - this.gameState.remote.body.velocity.x) * alpha;
                newVY = this.gameState.remote.body.velocity.y + 
                    (this.gameState.remote.targetVelocity.y - this.gameState.remote.body.velocity.y) * alpha;
            }

            // 应用新的位置和速度
            this.scene.matter.body.setPosition(this.gameState.remote.body, { x: newX, y: newY });
            this.scene.matter.body.setVelocity(this.gameState.remote.body, { x: newVX, y: newVY });

            // 角度和角速度插值
            if (this.gameState.remote.targetAngle !== null) {
                const newAngle = this.gameState.remote.body.angle + 
                    (this.gameState.remote.targetAngle - this.gameState.remote.body.angle) * alpha;
                this.scene.matter.body.setAngle(this.gameState.remote.body, newAngle);
            }
            if (this.gameState.remote.targetAngularVelocity !== null) {
                const newAngularVel = this.gameState.remote.body.angularVelocity + 
                    (this.gameState.remote.targetAngularVelocity - this.gameState.remote.body.angularVelocity) * alpha;
                this.scene.matter.body.setAngularVelocity(this.gameState.remote.body, newAngularVel);
            }
        }
    }

    // 注册回调函数
    on(event, callback) {
        this.callbacks[event] = callback;
    }

    // 发送得分更新
    sendScoreUpdate() {
        if (this.connection && this.connection.open) {
            this.connection.send({
                type: 'score',
                score: this.gameState.local.score
            });
        }
    }

    // 发送掉落物创建消息
    sendCollectibleCreated(collectibleData) {
        if (this.connection && this.connection.open) {
            console.log('发送掉落物生成消息给客户端');
            this.connection.send({
                type: 'collectibleCreated',
                collectible: collectibleData
            });
        }
    }

    // 发送掉落物被收集消息
    sendCollectibleCollected(timestamp) {
        if (this.connection && this.connection.open) {
            console.log('发送掉落物收集消息给对方');
            this.connection.send({
                type: 'collectibleCollected',
                timestamp: timestamp,
                score: this.gameState.local.score
            });
        }
    }

    // 发送掉落物被移除消息
    sendCollectibleRemoved(timestamp) {
        if (this.connection && this.connection.open) {
            this.connection.send({
                type: 'collectibleRemoved',
                timestamp: timestamp
            });
        }
    }

    // 发送游戏结束消息
    sendGameOver(winner) {
        if (this.connection && this.connection.open) {
            this.connection.send({
                type: 'gameOver',
                winner: winner
            });
        }
    }

    // 发送重新挑战请求
    sendRematchRequest() {
        if (this.connection && this.connection.open) {
            this.connection.send({
                type: 'rematchRequest'
            });
        }
    }

    // 发送接受重新挑战消息
    sendRematchAccepted() {
        if (this.connection && this.connection.open) {
            this.connection.send({
                type: 'rematchAccepted'
            });
        }
    }

    // 更新状态显示
    updateStatusDisplay(text) {
        if (this.callbacks.onStatusUpdate) {
            this.callbacks.onStatusUpdate(text);
        }
    }

    // 通过URL连接到对方
    checkUrlForId() {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');
        if (id) {
            // 等待 peer 初始化完成后再进行连接
            if (this.peer.id) {
                // peer 已经初始化完成，直接连接
                this.connection = this.peer.connect(id);
                this.setupConnection();
                // 清除URL中的ID参数
                window.history.replaceState({}, '', window.location.pathname);
            } else {
                // peer 还未初始化完成，等待初始化
                this.peer.on('open', () => {
                    this.connection = this.peer.connect(id);
                    this.setupConnection();
                    // 清除URL中的ID参数
                    window.history.replaceState({}, '', window.location.pathname);
                });
            }
        }
    }

    // 获取分享链接
    getShareLink() {
        return `${window.location.origin}${window.location.pathname}?id=${this.peer.id}`;
    }
} 