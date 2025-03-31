import Phaser from 'phaser';
import GameScene from '../scenes/GameScene';

// Phaser游戏配置
export const gameConfig = {
  type: Phaser.AUTO,
  width: 400,
  height: 400,
  physics: {
    default: 'matter',
    matter: {
      gravity: { y: 1.2 },
      debug: false
    }
  },
  scene: [GameScene],
  parent: 'game-container',
  backgroundColor: '#f0f0f0',
  pixelArt: false,
  roundPixels: true
};

// 游戏状态配置
export const initialGameState = {
  local: {
    color: '#FF6B6B', // 红色
    isHost: false,
    body: null,
    isJumping: false,
    jumpCount: 0,
    score: 0,
    isReady: false,
    hasWon: false
  },
  remote: {
    color: '#4ECDC4', // 青色
    body: null,
    isJumping: false,
    isConnected: false,
    jumpCount: 0,
    targetPosition: null,
    targetVelocity: null,
    score: 0,
    isReady: false,
    hasWon: false
  },
  platforms: [],
  gameStarted: false,
  collectibles: [],
  lastCollectibleSpawn: 0,
  isConnected: false,
  gameOver: false,
  winner: null,
  rematchRequested: false,
  lastPlatformRegen: 0,
  platformRegenInterval: 5000
};

// 游戏按键配置
export const KEYS_CONFIG = {
  LEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight',
  UP: 'ArrowUp',
  SPACE: 'SPACE'
};

// 物理参数 (已调整为Matter.js适用的值)
export const PHYSICS = {
  playerSpeed: 20,          // 已包含0.1的乘数
  playerJumpVelocity: -40,  // 已包含0.1的乘数
  secondJumpVelocity: -35   // 已包含0.1的乘数
};

// 玩家初始位置
export const INITIAL_POSITIONS = {
  local: { x: 100, y: 300 },
  remote: { x: 300, y: 300 }
};

// 玩家颜色配置
export const PLAYER_COLORS = {
  player1: '#FF6B6B',  // 温暖的珊瑚红
  player2: '#4ECDC4',  // 清新的青绿色
  indicator: '#FFE66D'  // 明亮的黄色
};

// 可收集物品配置
export const COLLECTIBLE_CONFIG = {
  colors: ['#FF6B6B', '#4ECDC4'],
  spawnInterval: 2000,
  maxCount: 5,
  fallSpeed: 10           // 已包含0.1的乘数
};

// 平台配置
export const PLATFORM_CONFIG = {
  count: 3,
  minWidth: 60,
  maxWidth: 180,
  height: 10,
  minY: 150,
  maxY: 300,
  color: '#95A5A6',
  minDistance: 80
};

// 碰撞类别
export const COLLISION_CATEGORIES = {
  BOUNDARY: 0x0001,
  PLAYER: 0x0002,
  PLATFORM: 0x0004,
  COLLECTIBLE: 0x0008
}; 