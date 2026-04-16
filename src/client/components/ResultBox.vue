<template>
  <div v-if="show" class="result-box">
    <div class="px-4 py-3 flex items-center gap-2.5" :class="headerClass">
      <span class="text-xl">{{ icon }}</span>
      <span class="text-sm font-semibold" :class="titleClass">{{ title }}</span>
    </div>
    <div class="p-4">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  show: boolean
  type: 'ok' | 'warn' | 'fail'
  title: string
}>()

const icon = computed(() => ({ ok: '✅', warn: 'ℹ️', fail: '❌' }[props.type]))
const headerClass = computed(() => ({
  ok:   'result-header-ok',
  warn: 'result-header-warn',
  fail: 'result-header-fail',
}[props.type]))
const titleClass = computed(() => ({
  ok:   'text-emerald-800 dark:text-emerald-300',
  warn: 'text-amber-800 dark:text-amber-300',
  fail: 'text-red-800 dark:text-red-300',
}[props.type]))
</script>
