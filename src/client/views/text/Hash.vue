<template>
  <div class="card">
    <h1 class="text-xl font-bold mb-1">哈希散列</h1>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">计算文本或文件的 MD5 / SHA-1 / SHA-256 / SHA-512</p>

    <!-- Tabs -->
    <div class="flex border-b-2 border-gray-200 dark:border-gray-700 mb-6">
      <button v-for="t in tabs" :key="t.value" class="tab-btn" :class="{ active: tab === t.value }" @click="tab = t.value">{{ t.label }}</button>
    </div>

    <template v-if="tab === 'text'">
      <label class="form-label">输入文本</label>
      <textarea v-model="text" class="form-input h-28 resize-none mb-4" placeholder="输入要计算哈希的文本..." />
    </template>

    <template v-if="tab === 'file'">
      <DropZone v-if="!file" icon="📁" text="点击选择或拖拽任意文件" hint="最大支持 500 MB" @files="onFiles" />
      <FileItem v-else :name="file.name" :meta="fmtSize(file.size)" icon="📁" @remove="file = null; result = null" />
    </template>

    <div class="flex gap-3 mt-4 mb-2">
      <div class="flex-1">
        <div class="section-title">输出格式</div>
        <div class="flex gap-2">
          <button v-for="f in fmts" :key="f.value" class="flex-1 py-1.5 border-2 rounded-lg text-xs font-semibold transition-all"
            :class="fmt === f.value ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary-400'"
            @click="fmt = f.value">{{ f.label }}</button>
        </div>
      </div>
      <div v-if="fmt === 'hex'" class="flex items-end pb-0.5">
        <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
          <input type="checkbox" v-model="uppercase" class="rounded" />
          大写
        </label>
      </div>
    </div>

    <button class="btn btn-primary" :disabled="(tab === 'text' ? !text.trim() : !file) || loading" @click="compute">
      {{ loading ? '计算中...' : '计算哈希' }}
    </button>

    <ProgressBar :show="loading" :progress="progress" :text="progressText" />

    <div v-if="result?.success" class="mt-5 space-y-2">
      <div v-for="algo in algos" :key="algo" class="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-bold text-gray-500 uppercase">{{ algo }}</span>
          <button class="text-xs text-primary-500 hover:text-primary-600 font-medium" @click="copy(result.result[algo])">复制</button>
        </div>
        <div class="font-mono text-xs text-gray-800 dark:text-gray-200 break-all">{{ result.result[algo] }}</div>
      </div>
      <p class="text-xs text-gray-400 text-center">{{ result.byteLength.toLocaleString() }} 字节 · {{ result.fmt.toUpperCase() }}{{ result.upper ? ' 大写' : '' }}</p>
    </div>

    <div v-if="result && !result.success" class="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
      <p class="text-sm text-red-700 dark:text-red-400">{{ result.error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import DropZone from '../../components/DropZone.vue'
import FileItem from '../../components/FileItem.vue'
import ProgressBar from '../../components/ProgressBar.vue'
import { fmtSize } from '../../utils/download'
import { useToast } from '../../composables/useToast'

const { show: showToast } = useToast()
const tab = ref('text')
const tabs = [{ value: 'text', label: '文本' }, { value: 'file', label: '文件' }]
const fmts = [{ value: 'hex', label: 'Hex' }, { value: 'base64', label: 'Base64' }]
const algos = ['md5', 'sha1', 'sha256', 'sha512']

const text = ref('')
const file = ref<File | null>(null)
const fmt = ref('hex')
const uppercase = ref(false)
const loading = ref(false)
const progress = ref(0)
const progressText = ref('')
const result = ref<any>(null)

function onFiles(files: File[]) { file.value = files[0]; result.value = null }

async function compute() {
  loading.value = true; progress.value = 30; progressText.value = '正在计算...'
  result.value = null
  try {
    if (tab.value === 'text') {
      result.value = await fetch('/api/hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ text: text.value, format: fmt.value, uppercase: String(uppercase.value) }),
      }).then(r => r.json())
    } else {
      const fd = new FormData()
      fd.append('file', file.value!)
      fd.append('format', fmt.value)
      fd.append('uppercase', String(uppercase.value))
      result.value = await fetch('/api/hash', { method: 'POST', body: fd }).then(r => r.json())
    }
    progress.value = 100
  } catch { showToast('网络错误，请重试') }
  finally { loading.value = false }
}

function copy(val: string) {
  navigator.clipboard.writeText(val)
  showToast('已复制到剪贴板')
}

onMounted(() => {
  document.addEventListener('paste', (e) => {
    if ((e.target as HTMLElement).matches('textarea, input[type="text"]')) return
    const item = [...(e.clipboardData?.items ?? [])].find(i => i.kind === 'file')
    if (!item) return
    const f = item.getAsFile()
    if (f) { tab.value = 'file'; file.value = f; showToast(`📋 已粘贴：${f.name || '文件'}`) }
  })
})
</script>
