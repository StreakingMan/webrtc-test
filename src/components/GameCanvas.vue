<template>
  <div class="w-full h-full flex items-center justify-center">
    <canvas ref="gameCanvas" width="400" height="400" class="border border-gray-300 rounded shadow-md" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { initPhysicsEngine, createRunner, createBoundaries } from '../game/physics/physicsEngine';
import { renderEffects } from '../game/effects/gameEffects';
import { initialGameState } from '../game/config/gameConfig';
import GameController from '../game/core/gameController';

// 定义物体的接口
interface PhysicsBody {
  position: { x: number; y: number };
  vertices: Array<{ x: number; y: number }>;
}

// 收集物的接口
interface Collectible {
  body: PhysicsBody;
  color: string;
}

// 游戏状态接口
interface GameState {
  local: {
    body: PhysicsBody | null;
    color: string;
    score: number;
    isHost: boolean;
  };
  remote: {
    body: PhysicsBody | null;
    color: string;
    score: number;
  };
  platforms: PhysicsBody[];
  collectibles: Collectible[];
  boundaries?: {
    ground: PhysicsBody;
    leftWall?: PhysicsBody;
    rightWall?: PhysicsBody;
    ceiling?: PhysicsBody;
  };
}

interface Props {
  statusHandler?: (status: string) => void;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'status-update', status: string): void;
  (e: 'score-update', scores: { localScore: number; remoteScore: number }): void;
  (e: 'game-over', data: { message: string; winner: string | null }): void;
  (e: 'rematch-request'): void;
}>();

const gameCanvas = ref<HTMLCanvasElement | null>(null);
const ctx = ref<CanvasRenderingContext2D | null>(null);
const gameState = ref<GameState>({ ...initialGameState } as unknown as GameState);
const gameController = ref<any>(null);
const animationFrameId = ref<number | null>(null);

// 初始化游戏
onMounted(() => {
  if (!gameCanvas.value) return;
  
  ctx.value = gameCanvas.value.getContext('2d');
  
  // 初始化物理引擎
  const { engine, world } = initPhysicsEngine();
  const runner = createRunner(engine);
  
  // 创建边界
  const boundaries = createBoundaries();
  world.add(world, [
    boundaries.ground, 
    boundaries.leftWall, 
    boundaries.rightWall, 
    boundaries.ceiling
  ]);
  
  // 创建游戏控制器
  gameController.value = new GameController(gameState.value, engine, world, runner);
  
  // 初始化游戏控制器
  gameController.value.initialize(gameCanvas.value, boundaries.ground);
  
  // 设置事件回调
  gameController.value.on('onStatusUpdate', handleStatusUpdate);
  gameController.value.on('onScoreUpdate', handleScoreUpdate);
  gameController.value.on('onGameOver', handleGameOver);
  gameController.value.on('onRematchRequest', handleRematchRequest);
  gameController.value.on('onGameReset', handleGameReset);
  
  // 开始游戏循环
  startGameLoop();
});

// 清理
onBeforeUnmount(() => {
  stopGameLoop();
});

// 开始游戏循环
function startGameLoop(): void {
  if (!ctx.value || !gameCanvas.value) return;
  
  // 清除画布
  ctx.value.clearRect(0, 0, gameCanvas.value.width, gameCanvas.value.height);
  
  // 更新游戏状态
  if (gameController.value) {
    gameController.value.update();
  }
  
  // 渲染游戏对象
  renderGame();
  
  // 继续循环
  animationFrameId.value = requestAnimationFrame(startGameLoop);
}

// 停止游戏循环
function stopGameLoop(): void {
  if (animationFrameId.value) {
    cancelAnimationFrame(animationFrameId.value);
    animationFrameId.value = null;
  }
}

// 渲染游戏
function renderGame(): void {
  if (!ctx.value || !gameCanvas.value) return;
  
  // 清空画布
  ctx.value.clearRect(0, 0, gameCanvas.value.width, gameCanvas.value.height);
  
  // 渲染特效
  renderEffects(ctx.value, gameState.value);
  
  // 渲染所有物体
  renderPhysicsBodies();
  
  // 渲染玩家标识和得分
  renderPlayerIndicators();
}

// 渲染物理物体
function renderPhysicsBodies(): void {
  const world = gameController.value?.engine?.world;
  if (!world || !ctx.value) return;
  
  const bodies = world.bodies;
  
  bodies.forEach((body: PhysicsBody) => {
    if (body === gameState.value.local.body || body === gameState.value.remote.body) {
      // 为玩家角色添加圆角
      const radius = 8; // 圆角半径
      const x = body.position.x;
      const y = body.position.y;
      const width = 30;
      const height = 30;
      
      ctx.value!.beginPath();
      ctx.value!.moveTo(x - width/2 + radius, y - height/2);
      ctx.value!.lineTo(x + width/2 - radius, y - height/2);
      ctx.value!.quadraticCurveTo(x + width/2, y - height/2, x + width/2, y - height/2 + radius);
      ctx.value!.lineTo(x + width/2, y + height/2 - radius);
      ctx.value!.quadraticCurveTo(x + width/2, y + height/2, x + width/2 - radius, y + height/2);
      ctx.value!.lineTo(x - width/2 + radius, y + height/2);
      ctx.value!.quadraticCurveTo(x - width/2, y + height/2, x - width/2, y + height/2 - radius);
      ctx.value!.lineTo(x - width/2, y - height/2 + radius);
      ctx.value!.quadraticCurveTo(x - width/2, y - height/2, x - width/2 + radius, y - height/2);
      ctx.value!.closePath();
      
      ctx.value!.fillStyle = body === gameState.value.local.body ? 
        gameState.value.local.color : gameState.value.remote.color;
      ctx.value!.fill();
    } else if (gameState.value.platforms.includes(body)) {
      ctx.value!.fillStyle = '#95A5A6'; // 平台颜色
      const vertices = body.vertices;
      ctx.value!.beginPath();
      ctx.value!.moveTo(vertices[0].x, vertices[0].y);
      for (let j = 1; j < vertices.length; j++) {
        ctx.value!.lineTo(vertices[j].x, vertices[j].y);
      }
      ctx.value!.lineTo(vertices[0].x, vertices[0].y);
      ctx.value!.fill();
    } else if (gameState.value.collectibles.find(c => c.body === body)) {
      const collectible = gameState.value.collectibles.find(c => c.body === body);
      if (collectible) {
        ctx.value!.fillStyle = collectible.color;
        const vertices = body.vertices;
        ctx.value!.beginPath();
        ctx.value!.moveTo(vertices[0].x, vertices[0].y);
        for (let j = 1; j < vertices.length; j++) {
          ctx.value!.lineTo(vertices[j].x, vertices[j].y);
        }
        ctx.value!.lineTo(vertices[0].x, vertices[0].y);
        ctx.value!.fill();
      }
    } else if (body === gameState.value.boundaries?.ground) {
      // 使用更深的灰色
      ctx.value!.fillStyle = '#1a2634';  // 深灰色
      const vertices = body.vertices;
      ctx.value!.beginPath();
      ctx.value!.moveTo(vertices[0].x, vertices[0].y);
      for (let j = 1; j < vertices.length; j++) {
        ctx.value!.lineTo(vertices[j].x, vertices[j].y);
      }
      ctx.value!.lineTo(vertices[0].x, vertices[0].y);
      ctx.value!.fill();
    }
  });
}

// 渲染玩家标识和得分
function renderPlayerIndicators(): void {
  if (gameState.value.local.body) {
    renderPlayerIndicator(
      gameState.value.local.body, 
      gameState.value.local.color, 
      gameState.value.local.score, 
      true
    );
  }
  
  if (gameState.value.remote.body) {
    renderPlayerIndicator(
      gameState.value.remote.body, 
      gameState.value.remote.color, 
      gameState.value.remote.score, 
      false
    );
  }
}

// 渲染玩家标识
function renderPlayerIndicator(body: PhysicsBody, color: string, score: number, isLocal: boolean): void {
  if (!ctx.value) return;
  
  const x = body.position.x;
  const y = body.position.y - 25;
  
  // 玩家身份标识
  ctx.value.fillStyle = color;
  ctx.value.font = '12px Arial';
  ctx.value.textAlign = 'center';
  ctx.value.fillText(isLocal ? '我方' : '对方', x, y);
}

// 状态更新处理
function handleStatusUpdate(status: string): void {
  emit('status-update', status);
}

// 分数更新处理
function handleScoreUpdate(): void {
  emit('score-update', {
    localScore: gameState.value.local.score,
    remoteScore: gameState.value.remote.score
  });
}

// 游戏结束处理
function handleGameOver(data: { message: string; winner: string | null }): void {
  emit('game-over', data);
}

// 处理重新挑战请求
function handleRematchRequest(): void {
  emit('rematch-request');
}

// 处理游戏重置
function handleGameReset(): void {
  // 重置游戏状态
  stopGameLoop();
  startGameLoop();
}

// 暴露方法给父组件
defineExpose({
  connectToPeer: (peerId: string): void => gameController.value?.connectToPeer(peerId),
  requestRematch: (): boolean => gameController.value?.requestRematch() || false,
  acceptRematch: (): void => gameController.value?.acceptRematch(),
  getShareLink: (): string => gameController.value?.getShareLink() || ''
});
</script> 