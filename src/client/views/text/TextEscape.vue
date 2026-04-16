<template>
  <div class="card">
    <h1 class="text-xl font-bold mb-1">文本转义</h1>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">Unicode / Base64 / URL 编码双向互转</p>

    <!-- Tabs -->
    <div class="flex border-b-2 border-gray-200 dark:border-gray-700 mb-6">
      <button v-for="t in tabs" :key="t.value" class="tab-btn" :class="{ active: tab === t.value }" @click="tab = t.value">{{ t.label }}</button>
    </div>

    <template v-if="tab === 'unicode'">
      <label class="form-label">原始文本</label>
      <textarea v-model="unicodeInput" class="form-input h-24 resize-none mb-2" placeholder="输入文本..." />
      <div class="flex gap-2 mb-3">
        <button class="btn btn-gray flex-1" @click="unicodeEncode">编码 →</button>
        <button class="btn btn-gray flex-1" @click="unicodeDecode">← 解码</button>
      </div>
      <label class="form-label">Unicode 转义</label>
      <textarea v-model="unicodeOutput" class="form-input font-mono h-24 resize-none mb-2" placeholder="\\u4e2d\\u6587..." />
      <button class="btn btn-gray w-full text-xs" @click="copyText(unicodeOutput)">复制结果</button>
    </template>

    <template v-if="tab === 'base64'">
      <label class="form-label">原始文本（UTF-8）</label>
      <textarea v-model="b64Input" class="form-input h-24 resize-none mb-2" placeholder="输入文本..." />
      <div class="flex gap-2 mb-3">
        <button class="btn btn-gray flex-1" @click="b64Encode">编码 →</button>
        <button class="btn btn-gray flex-1" @click="b64Decode">← 解码</button>
      </div>
      <label class="form-label">Base64</label>
      <textarea v-model="b64Output" class="form-input font-mono h-24 resize-none mb-2" placeholder="Base64 字符串..." />
      <button class="btn btn-gray w-full text-xs" @click="copyText(b64Output)">复制结果</button>
    </template>

    <template v-if="tab === 'url'">
      <label class="form-label">原始文本</label>
      <textarea v-model="urlInput" class="form-input h-24 resize-none mb-2" placeholder="输入文本或 URL..." />
      <div class="flex gap-2 mb-3">
        <button class="btn btn-gray flex-1" @click="urlEncode">编码 →</button>
        <button class="btn btn-gray flex-1" @click="urlDecode">← 解码</button>
      </div>
      <label class="form-label">URL 编码</label>
      <textarea v-model="urlOutput" class="form-input font-mono h-24 resize-none mb-2" placeholder="%E4%B8%AD%E6%96%87..." />
      <button class="btn btn-gray w-full text-xs" @click="copyText(urlOutput)">复制结果</button>
    </template>

    <div v-if="errMsg" class="mt-3 text-xs text-red-500">{{ errMsg }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useToast } from '../../composables/useToast'

const { show: showToast } = useToast()
const tab = ref('unicode')
const tabs = [
  { value: 'unicode', label: 'Unicode' },
  { value: 'base64',  label: 'Base64' },
  { value: 'url',     label: 'URL 编码' },
]
const errMsg = ref('')

// Unicode
const unicodeInput = ref('')
const unicodeOutput = ref('')
function unicodeEncode() {
  errMsg.value = ''
  unicodeOutput.value = [...unicodeInput.value].map(c => {
    const cp = c.codePointAt(0)!
    return cp > 127 ? `\\u${cp.toString(16).padStart(4, '0')}` : c
  }).join('')
}
function unicodeDecode() {
  errMsg.value = ''
  try {
    unicodeInput.value = unicodeOutput.value.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  } catch { errMsg.value = '解码失败，请检查格式' }
}

// Base64
const b64Input = ref('')
const b64Output = ref('')
function b64Encode() {
  errMsg.value = ''
  try { b64Output.value = btoa(unescape(encodeURIComponent(b64Input.value))) }
  catch { errMsg.value = '编码失败' }
}
function b64Decode() {
  errMsg.value = ''
  try { b64Input.value = decodeURIComponent(escape(atob(b64Output.value))) }
  catch { errMsg.value = '解码失败，请检查 Base64 格式' }
}

// URL
const urlInput = ref('')
const urlOutput = ref('')
function urlEncode() { errMsg.value = ''; urlOutput.value = encodeURIComponent(urlInput.value) }
function urlDecode() {
  errMsg.value = ''
  try { urlInput.value = decodeURIComponent(urlOutput.value) }
  catch { errMsg.value = '解码失败，请检查 URL 编码格式' }
}

function copyText(val: string) {
  navigator.clipboard.writeText(val)
  showToast('已复制到剪贴板')
}
</script>
