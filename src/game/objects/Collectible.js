import Phaser from 'phaser';
import { COLLISION_CATEGORIES } from '../config/phaserConfig';

export default class Collectible extends Phaser.Physics.Matter.Sprite {
  constructor(scene, x, y, texture, color, timestamp) {
    // Matter.js配置
    const options = {
      friction: 0.05,
      frictionAir: 0.0,
      restitution: 0.5,
      density: 0.001,
      label: 'collectible',
      collisionFilter: {
        category: COLLISION_CATEGORIES.COLLECTIBLE,
        mask: COLLISION_CATEGORIES.PLAYER | COLLISION_CATEGORIES.PLATFORM | COLLISION_CATEGORIES.BOUNDARY
      }
    };
    
    super(scene.matter.world, x, y, texture, 0, options);
    
    // 添加到场景
    scene.add.existing(this);
    
    // 保存属性
    this.color = color;
    this.timestamp = timestamp;
    
    // 设置物理属性
    this.setCircle(10);  
    this.setScale(0.7);
    this.setFixedRotation();
    
    // 禁用与世界边界的碰撞
    this.setIgnoreGravity(false);
    
    // 创建闪烁效果
    this.createTweens();
    
    // 检查物体是否超出世界边界
    scene.events.on('update', this.checkBounds, this);
  }
  
  checkBounds() {
    // 如果物体超出了下边界，则销毁它
    if (this.y > this.scene.game.config.height + 50) {
      // 通知对方移除收集物
      if (this.scene.networkManager) {
        this.scene.networkManager.sendCollectibleRemoved(this.timestamp);
      }
      
      this.destroy();
    }
  }
  
  createTweens() {
    // 添加闪烁动画效果
    this.scene.tweens.add({
      targets: this,
      alpha: { from: 1, to: 0.7 },
      duration: 500,
      ease: 'Power2',
      yoyo: true,
      repeat: -1
    });
    
    // 添加旋转效果
    this.scene.tweens.add({
      targets: this,
      angle: { from: 0, to: 360 },
      duration: 3000,
      repeat: -1
    });
  }
  
  // 被收集时产生的效果
  createCollectEffect() {
    // 创建粒子爆炸效果
    const particles = this.scene.add.particles(this.x, this.y, this.texture.key, {
      speed: { min: 50, max: 150 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.5, end: 0 },
      lifespan: 600,
      quantity: 10,
      gravityY: 300
    });
    
    // 粒子效果完成后自动销毁
    this.scene.time.delayedCall(600, () => {
      particles.destroy();
    });
    
    // 创建闪光效果
    const flash = this.scene.add.sprite(this.x, this.y, this.texture.key);
    flash.setScale(1.5);
    flash.setAlpha(0.7);
    
    // 闪光效果动画
    this.scene.tweens.add({
      targets: flash,
      scale: 2.5,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        flash.destroy();
      }
    });
  }
  
  destroy() {
    // 移除事件监听
    if (this.scene) {
      this.scene.events.off('update', this.checkBounds, this);
    }
    
    // 创建销毁效果
    this.createCollectEffect();
    
    // 销毁对象
    super.destroy();
  }
} 