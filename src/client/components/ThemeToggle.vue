<template>
  <button
    @click="themeStore.toggle()"
    class="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
  >
    <span class="text-base">{{ themeStore.isDark ? '☀️' : '🌙' }}</span>
    <span>{{ themeStore.isDark ? '切换亮色' : '切换暗色' }}</span>
  </button>
</template>

<script setup lang="ts">
import { useThemeStore } from '../stores/theme'
const themeStore = useThemeStore()
</script>
