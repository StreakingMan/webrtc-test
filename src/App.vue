<template>
  <div class="app-container">
    <GameStatus 
      :status="statusMessage" 
      :scores="scores" 
    />
    
    <PhaserGameCanvas 
      ref="gameCanvasRef"
      @status-update="handleStatusUpdate"
      @score-update="handleScoreUpdate"
      @game-over="handleGameOver"
      @rematch-request="handleRematchRequest"
      @game-reset="handleGameReset"
    />
    
    <GameControls 
      :gameControllerRef="gameCanvasRef"
      @connect-to-peer="handleConnectToPeer"
    />
    
    <GameOver 
      :show="showGameOver"
      :message="gameOverMessage"
      :rematchRequested="rematchRequested"
      @request-rematch="requestRematch"
    />
    
    <div v-if="showRematchRequest" class="rematch-request">
      <div class="rematch-message">对方请求重新挑战，是否接受？</div>
      <div class="rematch-buttons">
        <button @click="acceptRematch" class="accept-button">接受</button>
        <button @click="rejectRematch" class="reject-button">拒绝</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import PhaserGameCanvas from './components/PhaserGameCanvas.vue';
import GameControls from './components/GameControls.vue';
import GameStatus from './components/GameStatus.vue';
import GameOver from './components/GameOver.vue';

// 状态
const statusMessage = ref('等待连接...');
const scores = ref({
  localScore: 0,
  remoteScore: 0
});

// 游戏结束
const showGameOver = ref(false);
const gameOverMessage = ref('');
const rematchRequested = ref(false);

// 重新挑战请求
const showRematchRequest = ref(false);

// 引用
const gameCanvasRef = ref(null);

// 处理状态更新
function handleStatusUpdate(status) {
  statusMessage.value = status;
}

// 处理分数更新
function handleScoreUpdate(newScores) {
  scores.value = newScores;
}

// 处理游戏结束
function handleGameOver(data) {
  gameOverMessage.value = data.message;
  showGameOver.value = true;
  rematchRequested.value = false;
}

// 处理重新挑战请求
function handleRematchRequest() {
  showRematchRequest.value = true;
}

// 接受重新挑战
function acceptRematch() {
  gameCanvasRef.value?.acceptRematch();
  showRematchRequest.value = false;
  showGameOver.value = false;
}

// 拒绝重新挑战
function rejectRematch() {
  showRematchRequest.value = false;
  rematchRequested.value = false;
}

// 请求重新挑战
function requestRematch() {
  if (gameCanvasRef.value?.requestRematch()) {
    rematchRequested.value = true;
  }
}

// 处理游戏重置
function handleGameReset() {
  showGameOver.value = false;
  rematchRequested.value = false;
}

// 处理连接到对方
function handleConnectToPeer(peerId) {
  gameCanvasRef.value?.connectToPeer(peerId);
}
</script>

<style>
body {
  margin: 0;
  padding: 0;
  font-family: Arial, sans-serif;
  background-color: #f8f8f8;
}

.app-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.rematch-request {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: white;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  z-index: 1001;
  text-align: center;
}

.rematch-message {
  font-size: 18px;
  margin-bottom: 15px;
}

.rematch-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.accept-button, .reject-button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.accept-button {
  background-color: #4CAF50;
  color: white;
}

.reject-button {
  background-color: #f44336;
  color: white;
}
</style>