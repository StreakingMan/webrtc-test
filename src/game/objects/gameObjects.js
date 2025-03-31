import { COLLISION_CATEGORIES, PLATFORM_CONFIG, COLLECTIBLE_CONFIG } from '../config/phaserConfig';

// 创建玩家对象 - 这是一个兼容旧版本的工厂函数，现在使用Phaser的类
export function createPlayer(x, y, color, scene) {
    // 如果提供了scene参数，使用Phaser创建物体
    if (scene && scene.matter) {
        return scene.matter.bodies.rectangle(x, y, 30, 30, {
            restitution: 0.1,
            friction: 0.001,
            density: 0.008,
            frictionAir: 0.002,
            frictionStatic: 0.005,
            collisionFilter: {
                category: COLLISION_CATEGORIES.PLAYER,
                mask: COLLISION_CATEGORIES.BOUNDARY | COLLISION_CATEGORIES.PLATFORM | 
                      COLLISION_CATEGORIES.COLLECTIBLE | COLLISION_CATEGORIES.PLAYER
            },
            render: {
                fillStyle: color
            }
        });
    } 
    // 兼容旧代码，返回一个模拟的物体对象供参考
    else {
        console.warn('createPlayer被调用但没有提供scene参数，物理功能将无法工作');
        return {
            position: { x, y },
            render: { fillStyle: color },
            collisionFilter: {
                category: COLLISION_CATEGORIES.PLAYER,
                mask: COLLISION_CATEGORIES.BOUNDARY | COLLISION_CATEGORIES.PLATFORM | 
                      COLLISION_CATEGORIES.COLLECTIBLE | COLLISION_CATEGORIES.PLAYER
            }
        };
    }
}

// 创建平台 - 兼容旧版本的工厂函数
export function createPlatform(x, y, width, scene) {
    // 如果提供了scene参数，使用Phaser创建物体
    if (scene && scene.matter) {
        return scene.matter.bodies.rectangle(x, y, width, PLATFORM_CONFIG.height, {
            isStatic: true,
            render: {
                fillStyle: PLATFORM_CONFIG.color
            },
            friction: 0.001,
            frictionStatic: 0.005,
            restitution: 0,
            collisionFilter: {
                category: COLLISION_CATEGORIES.PLATFORM,
                mask: COLLISION_CATEGORIES.PLAYER | COLLISION_CATEGORIES.COLLECTIBLE
            }
        });
    }
    // 兼容旧代码
    else {
        console.warn('createPlatform被调用但没有提供scene参数，物理功能将无法工作');
        return {
            position: { x, y },
            width: width,
            height: PLATFORM_CONFIG.height,
            isStatic: true,
            collisionFilter: {
                category: COLLISION_CATEGORIES.PLATFORM,
                mask: COLLISION_CATEGORIES.PLAYER | COLLISION_CATEGORIES.COLLECTIBLE
            }
        };
    }
}

// 创建掉落物 - 兼容旧版本的工厂函数
export function createCollectibleFromData(data, scene) {
    try {
        console.log('开始创建掉落物:', data);
        let body;
        const size = COLLECTIBLE_CONFIG.size || 20;
        const commonProperties = {
            isStatic: false,
            isSensor: false,
            render: { fillStyle: data.color },
            label: 'collectible',
            friction: 0.05,
            frictionAir: 0.0005,
            restitution: 0.8,
            density: 0.0005,
            frictionStatic: 0.05,
            collisionFilter: {
                category: COLLISION_CATEGORIES.COLLECTIBLE,
                mask: COLLISION_CATEGORIES.PLATFORM | COLLISION_CATEGORIES.PLAYER | 
                      COLLISION_CATEGORIES.BOUNDARY | COLLISION_CATEGORIES.COLLECTIBLE
            }
        };

        console.log('掉落物碰撞设置:', commonProperties.collisionFilter);

        // 如果提供了scene参数，使用Phaser创建物体
        if (scene && scene.matter) {
            switch (data.type) {
                case 'circle':
                    body = scene.matter.bodies.circle(data.x, data.y, size / 2, commonProperties);
                    break;
                case 'triangle':
                    body = scene.matter.bodies.polygon(data.x, data.y, 3, size / 2, commonProperties);
                    break;
                case 'rectangle':
                default:
                    body = scene.matter.bodies.rectangle(data.x, data.y, size, size, commonProperties);
                    break;
            }

            if (body) {
                console.log('掉落物创建成功:', body);
                // 设置更小的初始下落速度
                scene.matter.body.setVelocity(body, { x: 0, y: COLLECTIBLE_CONFIG.fallSpeed * 0.02 });
                return { body, color: data.color, timestamp: data.timestamp, type: data.type };
            }
        } 
        // 兼容旧代码
        else {
            console.warn('createCollectibleFromData被调用但没有提供scene参数，物理功能将无法工作');
            return { 
                body: { 
                    position: { x: data.x, y: data.y },
                    collisionFilter: commonProperties.collisionFilter
                }, 
                color: data.color, 
                timestamp: data.timestamp, 
                type: data.type 
            };
        }
    } catch (error) {
        console.error('创建掉落物时出错:', error);
    }
    return null;
}

// 为了兼容性保留，但推荐使用Phaser场景中的方法
export function spawnCollectible(gameState, scene, canvasWidth) {
    if (!gameState.local.isHost) {
        console.log('非主机，不生成掉落物');
        return null;
    }
    if (!gameState.isConnected) {
        console.log('未连接，不生成掉落物');
        return null;
    }
    if (gameState.collectibles.length >= COLLECTIBLE_CONFIG.maxCount) {
        console.log('掉落物数量已达上限:', gameState.collectibles.length);
        return null;
    }

    const now = Date.now();
    if (now - gameState.lastCollectibleSpawn < COLLECTIBLE_CONFIG.spawnInterval) {
        return null;
    }

    console.log('开始生成新的掉落物');
    const types = ['circle', 'triangle', 'rectangle'];
    const type = types[Math.floor(Math.random() * types.length)];
    const color = COLLECTIBLE_CONFIG.colors[Math.floor(Math.random() * COLLECTIBLE_CONFIG.colors.length)];
    const x = Math.random() * (canvasWidth - 80) + 40;
    const y = 0;

    const collectibleData = {
        type,
        color,
        x,
        y,
        timestamp: now
    };

    console.log('生成掉落物数据:', collectibleData);
    const collectible = createCollectibleFromData(collectibleData, scene);
    if (collectible) {
        console.log('添加掉落物到游戏世界');
        gameState.collectibles.push(collectible);
        
        if (scene && scene.matter) {
            scene.matter.world.add(collectible.body);
        }
        
        gameState.lastCollectibleSpawn = now;
        
        return {
            collectible,
            collectibleData
        };
    }
    
    return null;
}

// 为了兼容性保留，但推荐使用Phaser场景中的方法
export function generatePlatforms(gameState, scene, connection, platformData = null) {
    console.log('生成平台，模式:', platformData ? '复制模式' : '主机生成模式');
    
    // 检查是否有有效的scene
    if (!scene || !scene.matter) {
        console.warn('generatePlatforms被调用但没有提供有效的scene参数，物理功能将无法工作');
        return;
    }
    
    // 清除现有平台
    gameState.platforms.forEach(platform => {
        scene.matter.world.remove(platform);
    });
    gameState.platforms = [];
    
    // 如果提供了平台数据，就直接按照数据创建平台（客户端模式）
    if (platformData) {
        console.log('客户端：从主机数据创建平台，数量:', platformData.length);
        platformData.forEach(data => {
            const platform = createPlatform(data.x, data.y, data.width, scene);
            gameState.platforms.push(platform);
            scene.matter.world.add(platform);
        });
        console.log('客户端：平台创建完成，数量:', gameState.platforms.length);
        return;
    }
    
    // 没有提供平台数据，由主机生成新平台
    if (!gameState.local.isHost) {
        console.log('错误：非主机不应该生成平台');
        return;
    }
    
    console.log('主机：开始生成新平台');
    
    // 固定种子的随机生成
    const seed = Date.now();
    gameState.lastPlatformSeed = seed;
    
    console.log('主机：使用种子', seed);
    let rngState = seed;
    function seededRandom() {
        rngState = (rngState * 9301 + 49297) % 233280;
        return rngState / 233280;
    }
    
    // 为简化和确保一致性，使用固定位置但随机宽度
    const positions = [
        { x: 100, y: 200 }, // 左侧平台
        { x: 300, y: 250 }, // 右侧平台
        { x: 200, y: 300 }  // 中间平台
    ];
    
    // 生成平台并记录平台数据
    const newPlatforms = [];
    positions.forEach(pos => {
        const randomValue = seededRandom();
        const width = PLATFORM_CONFIG.minWidth + 
            (PLATFORM_CONFIG.maxWidth - PLATFORM_CONFIG.minWidth) * randomValue;
        
        const platform = createPlatform(pos.x, pos.y, width, scene);
        gameState.platforms.push(platform);
        scene.matter.world.add(platform);
        
        // 记录平台数据
        newPlatforms.push({
            x: pos.x,
            y: pos.y,
            width: width
        });
    });
    
    // 发送平台数据到客户端
    if (connection && connection.open) {
        const platformMessage = {
            type: 'setExactPlatforms',
            seed: seed,
            timestamp: Date.now(),
            platforms: newPlatforms
        };
        
        connection.send(platformMessage);
    }
    
    return newPlatforms;
}

// 生成默认平台
export function generateDefaultPlatforms(gameState, world) {
    console.log('生成默认平台');
    
    // 清除现有平台
    gameState.platforms.forEach(platform => {
        World.remove(world, platform);
    });
    gameState.platforms = [];
    
    // 使用默认布局和固定宽度
    const defaultPositions = [
        { x: 100, y: 200, width: 120 },
        { x: 300, y: 250, width: 120 },
        { x: 200, y: 300, width: 120 }
    ];
    
    defaultPositions.forEach(pos => {
        const platform = createPlatform(pos.x, pos.y, pos.width, scene);
        gameState.platforms.push(platform);
        World.add(world, platform);
    });
    
    console.log('默认平台生成完成，数量:', gameState.platforms.length);
} 