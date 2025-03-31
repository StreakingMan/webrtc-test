import Phaser from 'phaser';
import { COLLISION_CATEGORIES } from '../config/phaserConfig';

export default class Platform extends Phaser.GameObjects.Rectangle {
  constructor(scene, x, y, width, height, color, isGround = false) {
    super(scene, x, y, width, height, color);
    
    // 添加到场景
    scene.add.existing(this);
    
    // 设置Matter.js物理属性
    const options = {
      isStatic: true,
      friction: 0.2,
      frictionStatic: 0.5,
      restitution: 0,
      label: isGround ? 'ground' : 'platform',
      collisionFilter: {
        category: COLLISION_CATEGORIES.PLATFORM,
        mask: COLLISION_CATEGORIES.PLAYER | COLLISION_CATEGORIES.COLLECTIBLE
      }
    };
    
    // 创建物理矩形
    this.body = scene.matter.add.rectangle(x, y, width, height, options);
    
    // 存储尺寸信息
    this.displayWidth = width;
    this.displayHeight = height;
    
    // 标记是否为地面
    this.isGround = isGround;
    
    // 如果是地面，设置特殊样式
    if (isGround) {
      this.setFillStyle(0x1a2634); // 深灰色
    }
  }
  
  // 销毁平台时的清理工作
  destroy() {
    // 从世界中移除物理体
    if (this.body && this.scene) {
      this.scene.matter.world.remove(this.body);
    }
    
    super.destroy();
  }
} 