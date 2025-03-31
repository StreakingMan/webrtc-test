import Phaser from 'phaser';
import { 
  initialGameState, 
  PHYSICS, 
  INITIAL_POSITIONS, 
  KEYS_CONFIG,
  COLLECTIBLE_CONFIG,
  PLATFORM_CONFIG,
  COLLISION_CATEGORIES
} from '../config/phaserConfig';
import Player from '../objects/Player';
import Platform from '../objects/Platform';
import Collectible from '../objects/Collectible';
import NetworkManager from '../network/networkManager';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    
    // 游戏状态
    this.gameState = JSON.parse(JSON.stringify(initialGameState));
    
    // 网络管理器
    this.networkManager = null;
    
    // 游戏对象
    this.localPlayer = null;
    this.remotePlayer = null;
    this.platforms = [];
    this.collectibles = [];
    
    // 键盘控制
    this.cursors = null;
    
    // 计时器
    this.collectibleTimer = null;
    this.platformRegenerationTimer = null;
    
    // 游戏回调
    this.callbacks = {};
  }

  init() {
    // 初始化游戏状态
    this.gameState = JSON.parse(JSON.stringify(initialGameState));
  }

  preload() {
    // 不需要预加载外部资源，使用动态生成的纹理
    
    // 动态创建简单形状贴图
    this.createTextures();
  }

  create() {
    // 使用Matter.js方式设置世界边界
    const width = 400;
    const height = 400;
    
    // 创建世界边界（四面墙）
    this.matter.world.setBounds(0, 0, width, height, 32);
    
    // 创建键盘控制
    this.cursors = this.input.keyboard.createCursorKeys();
    
    // 创建玩家
    this.createPlayers();
    
    // 创建平台
    this.createPlatforms();
    
    // 初始化网络管理器
    this.initNetworkManager();
    
    // 设置碰撞
    this.setupCollisions();
    
    // 设置定时器
    this.setupTimers();
    
    // 初始化完成，通知状态更新
    this.emitStatusUpdate('等待连接...');
  }

  update() {
    if (!this.localPlayer) return;
    
    // 更新玩家移动
    this.updatePlayerMovement();
    
    // 发送位置数据
    if (this.networkManager) {
      this.networkManager.sendPositionUpdate();
    }
    
    // 更新远程玩家位置
    this.updateRemotePlayerPosition();
    
    // Matter.js中不需要手动更新碰撞，已由物理引擎处理
  }

  createTextures() {
    // 创建方块纹理（本地玩家）
    this.generateRectTexture('localPlayerTexture', this.gameState.local.color);
    
    // 创建方块纹理（远程玩家）
    this.generateRectTexture('remotePlayerTexture', this.gameState.remote.color);
    
    // 创建平台纹理
    this.generateRectTexture('platformTexture', PLATFORM_CONFIG.color);
    
    // 创建收集物纹理
    for (let i = 0; i < COLLECTIBLE_CONFIG.colors.length; i++) {
      this.generateRectTexture(`collectibleTexture${i}`, COLLECTIBLE_CONFIG.colors[i]);
    }
  }

  generateRectTexture(key, color) {
    // 生成一个简单的矩形纹理
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(this.hexToDecimal(color), 1);
    graphics.fillRect(0, 0, 30, 30); // 30x30的方块
    graphics.generateTexture(key, 30, 30);
    graphics.destroy();
  }

  hexToDecimal(hex) {
    return parseInt(hex.replace('#', ''), 16);
  }

  createPlayers() {
    // 创建本地玩家
    this.localPlayer = new Player(
      this,
      INITIAL_POSITIONS.local.x,
      INITIAL_POSITIONS.local.y,
      'localPlayerTexture',
      true
    );
    
    // 存储到游戏状态
    this.gameState.local.body = this.localPlayer;
    
    // 禁用重力，等待连接
    this.localPlayer.setIgnoreGravity(true);
  }

  createPlatforms() {
    // 创建地面
    const ground = new Platform(
      this,
      200,
      390,
      400,
      20,
      'platformTexture',
      true
    );
    
    // 添加到平台数组
    this.platforms.push(ground);
    
    // 生成初始平台
    this.generateRandomPlatforms();
  }

  generateRandomPlatforms(platformData = null) {
    // 清除现有平台（地面除外）
    for (let i = 1; i < this.platforms.length; i++) {
      this.platforms[i].destroy();
    }
    this.platforms = [this.platforms[0]]; // 只保留地面
    
    // 如果有平台数据，直接使用
    if (platformData) {
      platformData.forEach(platform => {
        const newPlatform = new Platform(
          this,
          platform.x,
          platform.y,
          platform.width,
          platform.height,
          'platformTexture'
        );
        this.platforms.push(newPlatform);
      });
      return;
    }
    
    // 随机生成平台
    for (let i = 0; i < PLATFORM_CONFIG.count; i++) {
      const width = Phaser.Math.Between(PLATFORM_CONFIG.minWidth, PLATFORM_CONFIG.maxWidth);
      const x = Phaser.Math.Between(width/2, 400 - width/2);
      const y = Phaser.Math.Between(PLATFORM_CONFIG.minY, PLATFORM_CONFIG.maxY);
      
      // 检查是否与其他平台重叠
      let overlapping = false;
      for (let j = 0; j < this.platforms.length; j++) {
        const platform = this.platforms[j];
        const dx = Math.abs(platform.x - x);
        const dy = Math.abs(platform.y - y);
        if (dx < (width/2 + platform.width/2) && dy < (PLATFORM_CONFIG.height/2 + platform.height/2)) {
          overlapping = true;
          break;
        }
      }
      
      if (!overlapping) {
        const newPlatform = new Platform(
          this,
          x,
          y,
          width,
          PLATFORM_CONFIG.height,
          'platformTexture'
        );
        this.platforms.push(newPlatform);
      }
    }
    
    // 如果是主机，发送平台数据
    if (this.gameState.local.isHost && this.networkManager) {
      const platformsData = this.platforms.slice(1).map(platform => ({
        x: platform.x,
        y: platform.y,
        width: platform.width,
        height: platform.height
      }));
      this.networkManager.sendPlatformData(platformsData);
    }
  }

  initNetworkManager() {
    // 初始化网络管理器
    this.networkManager = new NetworkManager(
      this.gameState,
      this, // 传递当前场景，用于访问Phaser内置的Matter.js物理引擎
      this.generateRandomPlatforms.bind(this),
      this.resetPositions.bind(this)
    );
    
    // 设置回调
    this.setupNetworkCallbacks();
    
    // 初始化网络管理器
    this.networkManager.initialize();
    this.networkManager.checkUrlForId();
  }

  setupNetworkCallbacks() {
    // 状态更新
    this.networkManager.on('onStatusUpdate', (text) => {
      this.emitStatusUpdate(text);
    });
    
    // 分数更新
    this.networkManager.on('onScoreUpdate', () => {
      this.emitScoreUpdate();
    });
    
    // 游戏结束
    this.networkManager.on('onGameOver', (message) => {
      this.emitGameOver(message);
    });
    
    // 重新挑战请求
    this.networkManager.on('onRematchRequest', () => {
      this.emitRematchRequest();
    });
    
    // 接受重新挑战
    this.networkManager.on('onRematchAccepted', () => {
      this.resetGame();
    });
    
    // 对方连接时创建远程玩家
    this.networkManager.on('onPeerConnected', () => {
      this.createRemotePlayer();
      
      // 启用重力
      if (this.localPlayer) {
        this.localPlayer.setIgnoreGravity(false);
      }
      
      // 启动游戏
      this.startGame();
    });
    
    // 收集物创建
    this.networkManager.on('onCollectibleCreated', (collectibleData) => {
      this.handleRemoteCollectibleCreated(collectibleData);
    });
    
    // 收集物收集
    this.networkManager.on('onCollectibleCollected', (timestamp, score) => {
      this.handleRemoteCollectibleCollected(timestamp, score);
    });
  }

  setupCollisions() {
    // Matter.js中，碰撞已经在Player和Platform类中通过碰撞分类和碰撞过滤设置完成
    // 所以这里不需要额外设置碰撞器
    
    // 设置碰撞回调
    this.matter.world.on('collisionstart', (event) => {
      // 处理碰撞事件
      event.pairs.forEach((pair) => {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;
        
        // 玩家与收集物的碰撞
        if ((bodyA.label === 'localPlayer' && bodyB.label === 'collectible') ||
            (bodyA.label === 'collectible' && bodyB.label === 'localPlayer')) {
          
          const collectible = bodyA.label === 'collectible' ? 
            bodyA.gameObject : bodyB.gameObject;
          
          if (collectible && collectible.active) {
            this.collectCollectible(collectible);
          }
        }
      });
    });
  }

  setupTimers() {
    // 收集物生成计时器
    this.collectibleTimer = this.time.addEvent({
      delay: COLLECTIBLE_CONFIG.spawnInterval,
      callback: this.spawnCollectible,
      callbackScope: this,
      loop: true,
      paused: true // 等待游戏开始
    });
    
    // 平台重生成计时器
    this.platformRegenerationTimer = this.time.addEvent({
      delay: this.gameState.platformRegenInterval,
      callback: this.regeneratePlatforms,
      callbackScope: this,
      loop: true,
      paused: true // 等待游戏开始
    });
  }

  startGame() {
    // 启动游戏
    this.gameState.gameStarted = true;
    
    // 启动定时器
    this.collectibleTimer.paused = false;
    this.platformRegenerationTimer.paused = false;
  }

  createRemotePlayer() {
    // 创建远程玩家
    this.remotePlayer = new Player(
      this,
      INITIAL_POSITIONS.remote.x,
      INITIAL_POSITIONS.remote.y,
      'remotePlayerTexture',
      false
    );
    
    // 存储到游戏状态
    this.gameState.remote.body = this.remotePlayer;
    
    // Matter.js中不需要显式添加碰撞，已经在Player类中设置好碰撞分类和过滤器
  }

  updatePlayerMovement() {
    // 重置水平速度
    this.localPlayer.setVelocityX(0);
    
    // 左右移动
    if (this.cursors.left.isDown) {
      this.localPlayer.setVelocityX(-PHYSICS.playerSpeed * 0.1);
    } else if (this.cursors.right.isDown) {
      this.localPlayer.setVelocityX(PHYSICS.playerSpeed * 0.1);
    }
    
    // 跳跃 - 双跳
    const onGround = this.localPlayer.isOnGround();
    
    // 在地面时重置跳跃次数
    if (onGround) {
      this.gameState.local.jumpCount = 0;
    }
    
    // 跳跃按键按下
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.cursors.space)) {
      if (onGround) {
        // 第一段跳跃
        this.localPlayer.setVelocityY(PHYSICS.playerJumpVelocity * 0.1);
        this.gameState.local.jumpCount = 1;
      } else if (this.gameState.local.jumpCount === 1) {
        // 第二段跳跃
        this.localPlayer.setVelocityY(PHYSICS.secondJumpVelocity * 0.1);
        this.gameState.local.jumpCount = 2;
      }
    }
  }

  updateRemotePlayerPosition() {
    if (!this.remotePlayer || !this.gameState.remote.targetPosition) return;
    
    // 简单位置插值
    const speed = 0.3; // 插值速度
    const targetX = this.gameState.remote.targetPosition.x;
    const targetY = this.gameState.remote.targetPosition.y;
    
    // 计算当前位置到目标位置的距离
    const dx = targetX - this.remotePlayer.x;
    const dy = targetY - this.remotePlayer.y;
    
    // 应用插值（Matter.js中需要使用setPosition而不是直接修改x,y）
    this.remotePlayer.setPosition(
      this.remotePlayer.x + dx * speed,
      this.remotePlayer.y + dy * speed
    );
    
    // 如果有速度信息，应用速度
    if (this.gameState.remote.targetVelocity) {
      this.remotePlayer.setVelocity(
        this.gameState.remote.targetVelocity.x * 0.1,
        this.gameState.remote.targetVelocity.y * 0.1
      );
    }
  }

  spawnCollectible() {
    if (!this.gameState.gameStarted || !this.gameState.isConnected || this.collectibles.length >= COLLECTIBLE_CONFIG.maxCount) {
      return;
    }
    
    // 只在主机生成收集物
    if (!this.gameState.local.isHost) {
      return;
    }
    
    // 随机位置
    const x = Phaser.Math.Between(20, 380);
    const y = 0; // 从顶部生成
    
    // 随机颜色（对应本地或远程玩家）
    const colorIndex = Phaser.Math.Between(0, 1);
    const color = COLLECTIBLE_CONFIG.colors[colorIndex];
    const textureKey = `collectibleTexture${colorIndex}`;
    
    // 创建收集物
    const timestamp = Date.now();
    const collectible = new Collectible(
      this,
      x,
      y,
      textureKey,
      color,
      timestamp
    );
    
    // 设置速度
    collectible.setVelocityY(COLLECTIBLE_CONFIG.fallSpeed * 0.1);
    
    // 添加到收集物数组
    this.collectibles.push(collectible);
    
    // Matter.js中不需要显式添加碰撞检测，在Collectible类中已经设置好碰撞分类和过滤器
    // 碰撞事件会在setupCollisions中的collisionstart事件中处理
    
    // 发送收集物创建消息
    const collectibleData = {
      x,
      y,
      color,
      timestamp
    };
    this.networkManager.sendCollectibleCreated(collectibleData);
  }

  collectCollectible(collectible) {
    // 根据颜色判断加分还是扣分
    if (collectible.color === this.gameState.local.color) {
      // 颜色相同，加一分
      this.gameState.local.score += 1;
    } else {
      // 颜色不同，扣一分
      this.gameState.local.score = Math.max(0, this.gameState.local.score - 1);
    }
    
    // 通知对方收集物被收集
    this.networkManager.sendCollectibleCollected(collectible.timestamp);
    
    // 从收集物数组中移除
    this.collectibles = this.collectibles.filter(c => c !== collectible);
    
    // 销毁收集物
    collectible.destroy();
    
    // 更新分数显示
    this.emitScoreUpdate();
    
    // 检查胜利条件
    this.checkWinCondition();
  }

  handleRemoteCollectibleCreated(collectibleData) {
    // 如果收集物已存在，不重复创建
    if (this.collectibles.some(c => c.timestamp === collectibleData.timestamp)) {
      return;
    }
    
    // 获取颜色对应的纹理键
    const colorIndex = COLLECTIBLE_CONFIG.colors.indexOf(collectibleData.color);
    const textureKey = `collectibleTexture${colorIndex}`;
    
    // 创建收集物
    const collectible = new Collectible(
      this,
      collectibleData.x,
      collectibleData.y,
      textureKey,
      collectibleData.color,
      collectibleData.timestamp
    );
    
    // 设置速度
    collectible.setVelocityY(COLLECTIBLE_CONFIG.fallSpeed * 0.1);
    
    // 添加到收集物数组
    this.collectibles.push(collectible);
    
    // Matter.js中不需要显式添加overlap碰撞检测，已经在setupCollisions方法中通过碰撞事件处理
  }

  handleRemoteCollectibleCollected(timestamp, score) {
    // 找到对应的收集物
    const collectible = this.collectibles.find(c => c.timestamp === timestamp);
    
    if (collectible) {
      // 移除收集物
      collectible.destroy();
      this.collectibles = this.collectibles.filter(c => c.timestamp !== timestamp);
      
      // 更新对方得分
      this.gameState.remote.score = score;
      
      // 更新分数显示
      this.emitScoreUpdate();
    }
  }

  regeneratePlatforms() {
    if (!this.gameState.gameStarted || !this.gameState.isConnected || !this.gameState.local.isHost) {
      return;
    }
    
    // 重新生成平台
    this.generateRandomPlatforms();
  }

  resetPositions() {
    // 重置本地玩家位置
    if (this.localPlayer) {
      this.localPlayer.setPosition(INITIAL_POSITIONS.local.x, INITIAL_POSITIONS.local.y);
      this.localPlayer.setVelocity(0, 0);
      this.gameState.local.jumpCount = 0;
    }
    
    // 重置远程玩家位置
    if (this.remotePlayer) {
      this.remotePlayer.setPosition(INITIAL_POSITIONS.remote.x, INITIAL_POSITIONS.remote.y);
      this.remotePlayer.setVelocity(0, 0);
      this.gameState.remote.jumpCount = 0;
    }
  }

  resetGame() {
    // 重置游戏状态
    this.gameState.local.score = 0;
    this.gameState.remote.score = 0;
    this.gameState.local.hasWon = false;
    this.gameState.remote.hasWon = false;
    this.gameState.gameOver = false;
    this.gameState.winner = null;
    
    // 重置玩家位置
    this.resetPositions();
    
    // 重新生成平台
    this.generateRandomPlatforms();
    
    // 清除所有收集物
    this.collectibles.forEach(collectible => {
      collectible.destroy();
    });
    this.collectibles = [];
    
    // 重启定时器
    this.collectibleTimer.paused = false;
    this.platformRegenerationTimer.paused = false;
    
    // 通知UI更新
    this.emitGameReset();
  }

  checkWinCondition() {
    if (this.gameState.local.score >= 20 && !this.gameState.local.hasWon) {
      this.gameState.local.hasWon = true;
      this.gameState.gameOver = true;
      this.gameState.winner = 'local';
      
      // 暂停定时器
      this.collectibleTimer.paused = true;
      this.platformRegenerationTimer.paused = true;
      
      // 发送胜利消息
      this.networkManager.sendGameOver('local');
      
      // 通知UI更新
      this.emitGameOver('你赢了！');
    } else if (this.gameState.remote.score >= 20 && !this.gameState.remote.hasWon) {
      this.gameState.remote.hasWon = true;
      this.gameState.gameOver = true;
      this.gameState.winner = 'remote';
      
      // 暂停定时器
      this.collectibleTimer.paused = true;
      this.platformRegenerationTimer.paused = true;
      
      // 通知UI更新
      this.emitGameOver('对方赢了！');
    }
  }

  // 事件发射器方法
  emitStatusUpdate(status) {
    if (this.callbacks.onStatusUpdate) {
      this.callbacks.onStatusUpdate(status);
    }
  }

  emitScoreUpdate() {
    if (this.callbacks.onScoreUpdate) {
      this.callbacks.onScoreUpdate({
        localScore: this.gameState.local.score,
        remoteScore: this.gameState.remote.score
      });
    }
  }

  emitGameOver(message) {
    if (this.callbacks.onGameOver) {
      this.callbacks.onGameOver({
        message,
        winner: this.gameState.winner
      });
    }
  }

  emitRematchRequest() {
    if (this.callbacks.onRematchRequest) {
      this.callbacks.onRematchRequest();
    }
  }

  emitGameReset() {
    if (this.callbacks.onGameReset) {
      this.callbacks.onGameReset();
    }
  }

  // 公共方法
  registerCallbacks(callbacks) {
    this.callbacks = callbacks;
  }

  connectToPeer(peerId) {
    this.networkManager?.connectToPeer(peerId);
  }

  requestRematch() {
    if (this.networkManager) {
      this.gameState.rematchRequested = true;
      this.networkManager.sendRematchRequest();
      return true;
    }
    return false;
  }

  acceptRematch() {
    this.resetGame();
    this.networkManager?.sendRematchAccepted();
  }

  getShareLink() {
    return this.networkManager?.getShareLink();
  }
} 