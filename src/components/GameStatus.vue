<template>
  <div class="mb-4 text-center">
    <div class="text-base font-bold mb-2.5 text-gray-700">{{ statusMessage }}</div>
    
    <div v-if="showScores" class="flex justify-center gap-5">
      <div class="flex flex-col items-center">
        <span class="text-xs text-gray-500">我的得分:</span>
        <span class="text-lg font-bold text-gray-700">{{ localScore }}</span>
      </div>
      <div class="flex flex-col items-center">
        <span class="text-xs text-gray-500">对方得分:</span>
        <span class="text-lg font-bold text-gray-700">{{ remoteScore }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface ScoresProps {
  localScore: number;
  remoteScore: number;
}

const props = defineProps<{
  status?: string;
  scores?: ScoresProps;
}>();

// 提供默认值
const defaultProps = {
  status: '等待连接...',
  scores: { localScore: 0, remoteScore: 0 }
};

const statusMessage = computed(() => props.status || defaultProps.status);
const localScore = computed(() => props.scores?.localScore ?? defaultProps.scores.localScore);
const remoteScore = computed(() => props.scores?.remoteScore ?? defaultProps.scores.remoteScore);
const showScores = computed(() => 
  typeof props.scores?.localScore === 'number' && 
  typeof props.scores?.remoteScore === 'number'
);
</script> 