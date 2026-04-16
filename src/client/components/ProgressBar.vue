<template>
  <div v-if="show" class="mt-4">
    <div class="bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
      <div
        class="h-full bg-gradient-to-r from-primary-500 to-violet-500 rounded-full transition-all duration-300"
        :style="{ width: progress + '%' }"
      />
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400 text-center mt-1.5">{{ text }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  show: boolean
  progress: number
  text?: string
}>()
</script>
