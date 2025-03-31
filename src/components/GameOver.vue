<template>
  <div v-if="show" class="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50">
    <div class="bg-white p-8 rounded-lg shadow-lg text-center max-w-[90%] w-[300px]">
      <div class="text-2xl font-bold mb-5 text-gray-800">{{ gameOverMessage }}</div>
      
      <div class="flex justify-center">
        <button 
          @click="requestRematch" 
          :disabled="rematchRequested" 
          class="px-5 py-2.5 bg-green-500 text-white rounded transition-colors"
          :class="{ 'bg-yellow-500': rematchRequested, 'hover:bg-green-600': !rematchRequested, 'opacity-70 cursor-not-allowed': rematchRequested }"
        >
          {{ rematchButtonText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  show?: boolean;
  message?: string;
  rematchRequested?: boolean;
}>();

// 提供默认值
const defaultProps = {
  show: false,
  message: '游戏结束',
  rematchRequested: false
};

const emit = defineEmits<{
  (e: 'request-rematch'): void;
}>();

const gameOverMessage = computed(() => props.message || defaultProps.message);
const rematchButtonText = computed(() => {
  return props.rematchRequested ? '等待对方接受...' : '发起重新挑战';
});

function requestRematch(): void {
  if (!props.rematchRequested) {
    emit('request-rematch');
  }
}
</script> 