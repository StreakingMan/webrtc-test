<template>
  <div class="flex justify-center items-center relative w-[400px] h-[400px]" ref="gameContainer"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import Phaser from 'phaser';
import { gameConfig } from '../game/config/phaserConfig';

interface StatusUpdate {
  (status: string): void;
}

interface ScoreUpdate {
  (scores: { localScore: number; remoteScore: number }): void;
}

interface GameOver {
  (data: { message: string; winner: string | null }): void;
}

interface GameCallbacks {
  onStatusUpdate: StatusUpdate;
  onScoreUpdate: ScoreUpdate;
  onGameOver: GameOver;
  onRematchRequest: () => void;
  onGameReset: () => void;
}

// 定义Props，此处为空对象
const props = defineProps<{}>(); 

// 定义事件
const emit = defineEmits<{
  (e: 'status-update', status: string): void;
  (e: 'score-update', scores: { localScore: number; remoteScore: number }): void;
  (e: 'game-over', data: { message: string; winner: string | null }): void;
  (e: 'rematch-request'): void;
  (e: 'game-reset'): void;
}>();

const gameContainer = ref<HTMLElement | null>(null);
let game: Phaser.Game | null = null;
let gameScene: any = null;

// 初始化游戏
onMounted(() => {
  if (!gameContainer.value) return;
  
  // 创建Phaser游戏实例
  const config: Phaser.Types.Core.GameConfig = {
    ...gameConfig,
    parent: gameContainer.value,
  };
  
  game = new Phaser.Game(config);
  
  // 等待场景创建完成
  game.events.once('ready', () => {
    // 获取游戏场景
    gameScene = game?.scene.getScene('GameScene');
    
    // 设置事件回调
    gameScene.registerCallbacks({
      onStatusUpdate: handleStatusUpdate,
      onScoreUpdate: handleScoreUpdate,
      onGameOver: handleGameOver,
      onRematchRequest: handleRematchRequest,
      onGameReset: handleGameReset
    });
  });
});

// 清理
onBeforeUnmount(() => {
  if (game) {
    game.destroy(true);
    game = null;
    gameScene = null;
  }
});

// 状态更新处理
function handleStatusUpdate(status: string): void {
  emit('status-update', status);
}

// 分数更新处理
function handleScoreUpdate(scores: { localScore: number; remoteScore: number }): void {
  emit('score-update', scores);
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
  emit('game-reset');
}

// 暴露方法给父组件
defineExpose({
  connectToPeer: (peerId: string): void => gameScene?.connectToPeer(peerId),
  requestRematch: (): boolean => gameScene?.requestRematch() || false,
  acceptRematch: (): void => gameScene?.acceptRematch(),
  getShareLink: (): string => gameScene?.getShareLink() || ''
});
</script> 