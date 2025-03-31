<template>
  <div class="mt-5 flex flex-col items-center">
    <div v-if="isConnecting" class="flex gap-2.5 mb-2.5">
      <input 
        type="text" 
        v-model="peerId" 
        placeholder="输入对方ID" 
        class="p-2 border border-gray-300 rounded text-sm w-[200px] focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      <button 
        @click="connectToPeer" 
        class="px-4 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors"
      >
        连接
      </button>
    </div>
    
    <div v-else class="flex gap-2.5 mb-2.5 relative">
      <button 
        @click="toggleConnectPanel" 
        class="px-4 py-2 bg-green-500 text-white rounded text-sm shadow hover:bg-green-600 transition-colors"
      >
        连接到朋友
      </button>
      
      <button 
        @click="shareLink" 
        class="px-4 py-2 bg-green-500 text-white rounded text-sm shadow hover:bg-green-600 transition-colors"
      >
        分享链接
      </button>
      
      <div v-if="shareSuccess" class="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black bg-opacity-70 text-white text-xs py-1 px-2 rounded">
        链接已复制!
      </div>
    </div>
    
    <div class="text-gray-600 text-xs mt-1.5 text-center">
      操作说明：← → 左右移动，↑ 或 空格跳跃
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface GameController {
  getShareLink?: () => string;
}

// 定义Props，使用泛型接口
const props = defineProps<{
  gameControllerRef?: GameController;
}>();

// 定义事件
const emit = defineEmits<{
  (e: 'connect-to-peer', peerId: string): void;
}>();

const isConnecting = ref<boolean>(false);
const peerId = ref<string>('');
const shareSuccess = ref<boolean>(false);

// 切换连接面板
function toggleConnectPanel(): void {
  isConnecting.value = !isConnecting.value;
}

// 连接到对方
function connectToPeer(): void {
  if (!peerId.value.trim()) return;
  
  emit('connect-to-peer', peerId.value.trim());
  isConnecting.value = false;
  peerId.value = '';
}

// 分享链接
function shareLink(): void {
  const link = props.gameControllerRef?.getShareLink?.();
  
  if (link) {
    navigator.clipboard.writeText(link).then(() => {
      shareSuccess.value = true;
      setTimeout(() => {
        shareSuccess.value = false;
      }, 2000);
    }).catch(err => {
      console.error('复制失败:', err);
    });
  }
}
</script> 