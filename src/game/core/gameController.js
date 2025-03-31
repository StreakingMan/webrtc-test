import { KEYS_CONFIG, INITIAL_POSITIONS, PHYSICS, PLAYER_COLORS, COLLISION_CATEGORIES } from '../config/gameConfig';
import { isOnGround, Body, Events, World, Body as MatterBody } from '../physics/physicsEngine';
import { updateEffects, createJumpEffect, createCollectEffect, createNegativeEffect } from '../effects/gameEffects';
import { spawnCollectible, generatePlatforms, generateDefaultPlatforms } from '../objects/gameObjects';
import NetworkManager from '../network/networkManager';

export default class GameController {
    constructor(gameState, engine, world, runner) {
        this.gameState = gameState;
        this.engine = engine;
        this.world = world;
        this.runner = runner;
        this.canvas = null;
        this.ctx = null;
        this.keys = { ...KEYS_CONFIG };
        this.networkManager = null;
        this.ground = null;
        this.isGameInitialized = false;
        this.callbacks = {};
    }

    initialize(canvas, ground) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ground = ground;
        
        // 初始化网络
        this.networkManager = new NetworkManager(
            this.gameState, 
            this.world, 
            this.generatePlatforms.bind(this),
            this.resetPositions.bind(this)
        );
        
        // 设置回调
        this.setupNetworkCallbacks();
        
        // 初始化碰撞检测
        this.setupCollisionDetection();
        
        // 初始化键盘控制
        this.setupKeyboardControls();
        
        // 检查URL是否包含对方ID
        this.networkManager.initialize();
        this.networkManager.checkUrlForId();
        
        // 为单人游戏生成默认平台
        generateDefaultPlatforms(this.gameState, this.world);
        
        this.isGameInitialized = true;
    }

    // 设置网络回调
    setupNetworkCallbacks() {
        this.networkManager.on('onStatusUpdate', (text) => {
            if (this.callbacks.onStatusUpdate) {
                this.callbacks.onStatusUpdate(text);
            }
        });
        
        this.networkManager.on('onScoreUpdate', () => {
            if (this.callbacks.onScoreUpdate) {
                this.callbacks.onScoreUpdate();
            }
        });
        
        this.networkManager.on('onGameOver', (message) => {
            if (this.callbacks.onGameOver) {
                this.callbacks.onGameOver(message);
            }
        });
        
        this.networkManager.on('onRematchRequest', () => {
            if (this.callbacks.onRematchRequest) {
                this.callbacks.onRematchRequest();
            }
        });
        
        this.networkManager.on('onRematchAccepted', () => {
            this.resetGame();
        });
        
        this.networkManager.on('onCollectibleCreated', (collectibleData) => {
            this.handleRemoteCollectibleCreated(collectibleData);
        });
        
        this.networkManager.on('onCollectibleCollected', (timestamp, score) => {
            this.handleRemoteCollectibleCollected(timestamp, score);
        });
        
        this.networkManager.on('onCollectibleRemoved', (timestamp) => {
            this.handleRemoteCollectibleRemoved(timestamp);
        });
    }

    // 设置碰撞检测
    setupCollisionDetection() {
        Events.on(this.engine, 'collisionStart', (event) => {
            event.pairs.forEach((pair) => {
                // 检查是否涉及掉落物
                let collectibleBody = null;
                let playerBody = null;

                // 确定哪个是掉落物，哪个是玩家
                if (pair.bodyA.collisionFilter.category === COLLISION_CATEGORIES.COLLECTIBLE) {
                    collectibleBody = pair.bodyA;
                    if (pair.bodyB === this.gameState.local.body) {
                        playerBody = pair.bodyB;
                    }
                } else if (pair.bodyB.collisionFilter.category === COLLISION_CATEGORIES.COLLECTIBLE) {
                    collectibleBody = pair.bodyB;
                    if (pair.bodyA === this.gameState.local.body) {
                        playerBody = pair.bodyA;
                    }
                }

                // 如果找到了掉落物和本地玩家的碰撞
                if (collectibleBody && playerBody) {
                    this.handleCollectibleCollision(collectibleBody);
                }
            });
        });
    }

    // 处理掉落物碰撞
    handleCollectibleCollision(collectibleBody) {
        // 找到对应的掉落物对象
        const collectible = this.gameState.collectibles.find(c => c.body === collectibleBody);
        
        if (collectible) {
            // 创建收集特效
            createCollectEffect(
                collectible.body.position.x,
                collectible.body.position.y,
                collectible.color,
                this.gameState
            );

            // 只在扣分时创建负面特效
            if (collectible.color !== this.gameState.local.color) {
                createNegativeEffect(
                    collectible.body.position.x,
                    collectible.body.position.y,
                    this.gameState
                );
            }

            // 移除掉落物
            World.remove(this.world, collectible.body);
            this.gameState.collectibles = this.gameState.collectibles.filter(c => c.body !== collectible.body);
            
            // 根据颜色判断加分还是扣分
            if (collectible.color === this.gameState.local.color) {
                // 颜色相同，加一分
                this.gameState.local.score += 1;
            } else {
                // 颜色不同，扣一分
                this.gameState.local.score = Math.max(0, this.gameState.local.score - 1); // 防止得分为负数
            }

            // 通知对方掉落物被收集
            this.networkManager.sendCollectibleCollected(collectible.timestamp);
            
            // 更新分数显示
            if (this.callbacks.onScoreUpdate) {
                this.callbacks.onScoreUpdate();
            }
            
            // 检查胜利条件
            this.checkWinCondition();
        }
    }

    // 处理远程掉落物创建
    async handleRemoteCollectibleCreated(collectibleData) {
        const { createCollectibleFromData } = await import('../objects/gameObjects');
        const collectible = createCollectibleFromData(collectibleData);
        if (collectible) {
            this.gameState.collectibles.push(collectible);
            World.add(this.world, collectible.body);
        }
    }

    // 处理远程掉落物收集
    handleRemoteCollectibleCollected(timestamp, score) {
        const collectible = this.gameState.collectibles.find(c => c.timestamp === timestamp);
        if (collectible) {
            // 创建收集特效
            createCollectEffect(
                collectible.body.position.x,
                collectible.body.position.y,
                collectible.color,
                this.gameState
            );
            
            World.remove(this.world, collectible.body);
            this.gameState.collectibles = this.gameState.collectibles.filter(c => c.timestamp !== timestamp);
            
            // 更新对方得分
            this.gameState.remote.score = score;
            
            // 更新分数显示
            if (this.callbacks.onScoreUpdate) {
                this.callbacks.onScoreUpdate();
            }
        }
    }

    // 处理远程掉落物移除
    handleRemoteCollectibleRemoved(timestamp) {
        const collectible = this.gameState.collectibles.find(c => c.timestamp === timestamp);
        if (collectible) {
            World.remove(this.world, collectible.body);
            this.gameState.collectibles = this.gameState.collectibles.filter(c => c.timestamp !== timestamp);
        }
    }

    // 设置键盘控制
    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                this.keys[e.key] = true;
            } else if (e.key === 'ArrowUp' || e.key === ' ') {
                if (!this.keys[e.key].pressed) {
                    this.keys[e.key].justPressed = true;
                }
                this.keys[e.key].pressed = true;
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                this.keys[e.key] = false;
            } else if (e.key === 'ArrowUp' || e.key === ' ') {
                this.keys[e.key].pressed = false;
                this.keys[e.key].justPressed = false;
            }
        });
    }

    // 更新游戏状态
    update() {
        if (!this.isGameInitialized) return;
        
        // 更新跳跃冷却
        if (this.gameState.local.jumpCooldown > 0) {
            this.gameState.local.jumpCooldown--;
        }

        // 更新玩家移动
        this.updatePlayerMovement();

        // 发送位置数据
        this.networkManager.sendPositionUpdate();

        // 更新远程玩家插值
        this.networkManager.updateRemotePlayerPosition();

        // 更新特效
        updateEffects(this.gameState);

        // 生成掉落物
        if (this.gameState.gameStarted && this.gameState.isConnected) {
            const result = spawnCollectible(this.gameState, this.world, this.canvas.width);
            if (result) {
                // 发送掉落物创建消息
                this.networkManager.sendCollectibleCreated(result.collectibleData);
            }
        }

        // 清理超出边界的掉落物
        this.cleanupOutOfBoundsCollectibles();

        // 检查是否需要重新生成平台
        this.checkPlatformRegeneration();
    }

    // 更新玩家移动
    updatePlayerMovement() {
        if (!this.gameState.local.body) {
            return;
        }

        const velocity = this.gameState.local.body.velocity;
        let force = { x: 0, y: 0 };

        // 检查是否在地面上
        const onGround = isOnGround(this.gameState.local.body, this.ground, this.gameState.platforms);
        
        // 在地面上时重置跳跃次数
        if (onGround) {
            this.gameState.local.jumpCount = 0;
        }

        // 处理跳跃
        const jumpKeyJustPressed = this.keys.ArrowUp.justPressed || this.keys[' '].justPressed;
        if (jumpKeyJustPressed && this.gameState.local.jumpCooldown <= 0) {
            if (onGround || (!onGround && this.gameState.local.jumpCount < 2)) {
                const jumpVelocity = this.gameState.local.jumpCount === 0 ? -9 : -7;
                MatterBody.setVelocity(this.gameState.local.body, { 
                    x: velocity.x, 
                    y: jumpVelocity
                });
                
                this.gameState.local.isJumping = true;
                this.gameState.local.jumpCooldown = PHYSICS.jumpCooldown;
                this.gameState.local.jumpCount++;

                // 创建跳跃特效
                createJumpEffect(this.gameState, this.gameState.local.jumpCount);
            }
        }

        // 重置justPressed状态
        this.keys.ArrowUp.justPressed = false;
        this.keys[' '].justPressed = false;

        // 处理左右移动
        if (this.keys.ArrowLeft) {
            force.x = -PHYSICS.moveForce;
        }
        if (this.keys.ArrowRight) {
            force.x = PHYSICS.moveForce;
        }

        if (force.x !== 0) {
            MatterBody.applyForce(this.gameState.local.body, 
                this.gameState.local.body.position, 
                force
            );
            
            // 限制最大水平速度
            const maxSpeed = 3;
            if (Math.abs(this.gameState.local.body.velocity.x) > maxSpeed) {
                MatterBody.setVelocity(this.gameState.local.body, {
                    x: Math.sign(this.gameState.local.body.velocity.x) * maxSpeed,
                    y: this.gameState.local.body.velocity.y
                });
            }
        } else {
            // 当没有按键时，添加更强的减速
            if (Math.abs(velocity.x) > 0.1) {
                MatterBody.setVelocity(this.gameState.local.body, {
                    x: velocity.x * 0.92,
                    y: velocity.y
                });
            }
        }
    }

    // 清理超出边界的掉落物
    cleanupOutOfBoundsCollectibles() {
        for (let i = this.gameState.collectibles.length - 1; i >= 0; i--) {
            const collectible = this.gameState.collectibles[i];
            if (collectible.body.position.y > this.canvas.height + 50) {  // 超出底部边界
                World.remove(this.world, collectible.body);
                this.gameState.collectibles.splice(i, 1);

                // 通知对方移除掉落物
                this.networkManager.sendCollectibleRemoved(collectible.timestamp);
            }
        }
    }

    // 检查平台重生成
    checkPlatformRegeneration() {
        if (this.gameState.isConnected && !this.gameState.gameOver) {
            const now = Date.now();
            if (now - this.gameState.lastPlatformRegen >= this.gameState.platformRegenInterval) {
                // 只有主机重新生成平台
                if (this.gameState.local.isHost) {
                    console.log('时间到，重新生成平台');
                    this.generatePlatforms(); // 主机模式生成平台，会自动发送数据给客户端
                    this.gameState.lastPlatformRegen = now;
                }
            }
        }
    }

    // 生成平台
    generatePlatforms(platformData = null) {
        return generatePlatforms(this.gameState, this.world, this.networkManager.connection, platformData);
    }

    // 重置位置
    resetPositions() {
        MatterBody.setPosition(this.gameState.local.body, INITIAL_POSITIONS.local);
        MatterBody.setVelocity(this.gameState.local.body, { x: 0, y: 0 });
        this.gameState.local.isJumping = false;
        this.gameState.local.jumpCooldown = 0;
        this.gameState.local.jumpCount = 0;  // 重置跳跃次数

        if (this.gameState.remote.body) {
            MatterBody.setPosition(this.gameState.remote.body, INITIAL_POSITIONS.remote);
            MatterBody.setVelocity(this.gameState.remote.body, { x: 0, y: 0 });
            this.gameState.remote.isJumping = false;
            this.gameState.remote.jumpCount = 0;  // 重置跳跃次数
        }

        // 重新生成平台
        this.generatePlatforms();
    }

    // 检查胜利条件
    checkWinCondition() {
        if (this.gameState.local.score >= 20 && !this.gameState.local.hasWon) {
            this.gameState.local.hasWon = true;
            this.gameState.gameOver = true;
            this.gameState.winner = 'local';
            
            // 发送胜利消息
            this.networkManager.sendGameOver('local');
            
            if (this.callbacks.onGameOver) {
                this.callbacks.onGameOver('你赢了！');
            }
        } else if (this.gameState.remote.score >= 20 && !this.gameState.remote.hasWon) {
            this.gameState.remote.hasWon = true;
            this.gameState.gameOver = true;
            this.gameState.winner = 'remote';
            if (this.callbacks.onGameOver) {
                this.callbacks.onGameOver('对方赢了！');
            }
        }
    }

    // 重置游戏
    resetGame() {
        // 重置游戏状态
        this.gameState.local.score = 0;
        this.gameState.remote.score = 0;
        this.gameState.local.hasWon = false;
        this.gameState.remote.hasWon = false;
        this.gameState.gameOver = false;
        this.gameState.winner = null;
        this.gameState.rematchRequested = false;
        
        // 重置玩家位置
        this.resetPositions();
        
        // 重新生成平台
        this.generatePlatforms();
        
        // 清除所有掉落物
        this.gameState.collectibles.forEach(collectible => {
            World.remove(this.world, collectible.body);
        });
        this.gameState.collectibles = [];
        
        // 通知UI更新
        if (this.callbacks.onGameReset) {
            this.callbacks.onGameReset();
        }
    }

    // 注册回调函数
    on(event, callback) {
        this.callbacks[event] = callback;
    }

    // 连接到对方
    connectToPeer(peerId) {
        this.networkManager.connectToPeer(peerId);
    }

    // 请求重新挑战
    requestRematch() {
        this.gameState.rematchRequested = true;
        this.networkManager.sendRematchRequest();
        return true;
    }

    // 接受重新挑战
    acceptRematch() {
        this.resetGame();
        this.networkManager.sendRematchAccepted();
    }

    // 获取分享链接
    getShareLink() {
        return this.networkManager.getShareLink();
    }
} 