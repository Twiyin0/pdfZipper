<template>
  <div class="card">
    <h1 class="text-xl font-bold mb-1">JSON 格式化</h1>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">美化、压缩、Key 排序、实时校验</p>

    <div class="flex gap-2 flex-wrap mb-3">
      <button v-for="op in ops" :key="op.value" class="px-3 py-1.5 border-2 rounded-lg text-xs font-semibold transition-all"
        :class="'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary-400 hover:text-primary-600'"
        @click="applyOp(op.value)">{{ op.label }}</button>
      <div class="flex items-center gap-1.5 ml-auto">
        <span class="text-xs text-gray-500">缩进</span>
        <select v-model="indent" class="form-input py-1 text-xs w-20">
          <option value="2">2 空格</option>
          <option value="4">4 空格</option>
          <option value="tab">Tab</option>
        </select>
      </div>
    </div>

    <textarea
      v-model="input"
      class="form-input font-mono text-xs h-64 resize-y mb-2"
      placeholder='{"key": "value"}'
      @input="validate"
    />

    <div class="flex items-center gap-2 mb-4">
      <span class="text-xs" :class="valid === null ? 'text-gray-400' : valid ? 'text-emerald-600' : 'text-red-500'">
        {{ valid === null ? '等待输入...' : valid ? '✓ JSON 有效' : `✗ ${errMsg}` }}
      </span>
      <button class="btn btn-gray ml-auto px-3 py-1 text-xs" @click="copyText(input)">复制</button>
      <button class="btn btn-gray px-3 py-1 text-xs" @click="input = ''; valid = null">清空</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useToast } from '../../composables/useToast'

const { show: showToast } = useToast()
const input = ref('')
const indent = ref('2')
const valid = ref<boolean | null>(null)
const errMsg = ref('')

const ops = [
  { value: 'beautify', label: '美化' },
  { value: 'minify',   label: '压缩' },
  { value: 'sort',     label: 'Key 排序' },
]

function validate() {
  if (!input.value.trim()) { valid.value = null; return }
  try { JSON.parse(input.value); valid.value = true; errMsg.value = '' }
  catch (e: unknown) { valid.value = false; errMsg.value = (e as Error).message }
}

function getIndent() {
  if (indent.value === 'tab') return '\t'
  return parseInt(indent.value)
}

function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeys)
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.keys(obj as Record<string, unknown>).sort().map(k => [k, sortKeys((obj as Record<string, unknown>)[k])])
    )
  }
  return obj
}

function applyOp(op: string) {
  try {
    const parsed = JSON.parse(input.value)
    if (op === 'beautify') input.value = JSON.stringify(parsed, null, getIndent())
    else if (op === 'minify') input.value = JSON.stringify(parsed)
    else if (op === 'sort') input.value = JSON.stringify(sortKeys(parsed), null, getIndent())
    valid.value = true; errMsg.value = ''
  } catch (e: unknown) {
    valid.value = false; errMsg.value = (e as Error).message
  }
}

function copyText(val: string) {
  navigator.clipboard.writeText(val)
  showToast('已复制到剪贴板')
}
</script>
