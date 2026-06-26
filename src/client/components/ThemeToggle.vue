<template>
  <button
    @click="themeStore.toggle()"
    class="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
  >
    <SvgIcon :name="themeStore.isDark ? 'sun' : 'moon'" size="1rem" />
    <span>{{ themeStore.isDark ? '切换亮色' : '切换暗色' }}</span>
  </button>
</template>

<script setup lang="ts">
import { useThemeStore } from '../stores/theme'
import SvgIcon from './SvgIcon.vue'

const themeStore = useThemeStore()
</script>
