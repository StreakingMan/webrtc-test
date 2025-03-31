import Phaser from 'phaser';
import { COLLISION_CATEGORIES } from '../config/phaserConfig';

export default class Player extends Phaser.Physics.Matter.Sprite {
  constructor(scene, x, y, texture, isLocal = false) {
    // Matter.js配置
    const options = {
      friction: 0.05,
      frictionAir: 0.01,
      restitution: 0.2,
      label: isLocal ? 'localPlayer' : 'remotePlayer',
      collisionFilter: {
        category: COLLISION_CATEGORIES.PLAYER,
        mask: COLLISION_CATEGORIES.PLAYER | COLLISION_CATEGORIES.PLATFORM | COLLISION_CATEGORIES.BOUNDARY
      }
    };
    
    super(scene.matter.world, x, y, texture, 0, options);
    
    // 添加到场景
    scene.add.existing(this);
    
    // 设置碰撞属性
    this.setFixedRotation();
    
    // 设置玩家属性
    this.isLocal = isLocal;
    this.isJumping = false;
    this.jumpCount = 0;
    
    // 设置物理属性的尺寸
    this.setRectangle(28, 28);
    
    // 添加本地玩家标识
    if (isLocal) {
      this.localIndicator = scene.add.text(x, y + 20, '我', {
        fontSize: '14px',
        fontStyle: 'bold',
        fill: '#000',
        stroke: '#fff',
        strokeThickness: 4,
        align: 'center'
      });
      this.localIndicator.setOrigin(0.5, 0.5);
    }
    
    // 添加分数显示
    this.scoreText = scene.add.text(x, y - 25, '0', {
      fontSize: '16px',
      fontStyle: 'bold',
      fill: '#000',
      stroke: '#fff',
      strokeThickness: 3,
      align: 'center'
    });
    this.scoreText.setOrigin(0.5, 0.5);
    
    // 每帧更新分数和标识位置
    scene.events.on('update', this.updateTextPosition, this);
    scene.events.on('shutdown', this.destroy, this);
  }
  
  updateTextPosition() {
    // 更新分数显示位置
    if (this.scoreText) {
      this.scoreText.x = this.x;
      this.scoreText.y = this.y - 25;
      
      // 更新分数文本
      if (this.isLocal) {
        this.scoreText.setText(this.scene.gameState.local.score.toString());
      } else {
        this.scoreText.setText(this.scene.gameState.remote.score.toString());
      }
    }
    
    // 更新本地标识位置
    if (this.localIndicator) {
      this.localIndicator.x = this.x;
      this.localIndicator.y = this.y + 25;
    }
  }
  
  // 检查玩家是否站在地面上
  isOnGround() {
    const body = this.body;
    // 创建一个向下的射线来检测与地面的碰撞
    const ray = this.scene.matter.world.raycast(
      body.position,
      {x: body.position.x, y: body.position.y + 20},
      ['platform', 'ground']
    );
    return ray.length > 0;
  }
  
  destroy() {
    // 清理文本对象
    if (this.scoreText) {
      this.scoreText.destroy();
      this.scoreText = null;
    }
    
    if (this.localIndicator) {
      this.localIndicator.destroy();
      this.localIndicator = null;
    }
    
    // 移除事件
    if (this.scene) {
      this.scene.events.off('update', this.updateTextPosition, this);
    }
    
    // 调用父类销毁方法
    super.destroy();
  }
} 