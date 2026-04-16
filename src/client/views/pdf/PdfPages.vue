<template>
  <div class="card">
    <h1 class="text-xl font-bold mb-1">PDF 页面管理</h1>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">删除或提取 PDF 中的指定页面</p>

    <DropZone v-if="!file" accept=".pdf,application/pdf" icon="📑" text="点击选择或拖拽 PDF 文件" hint="最大支持 200 MB" @files="onFiles" />
    <FileItem v-else :name="file.name" :meta="`${fmtSize(file.size)}${totalPages ? ' · ' + totalPages + ' 页' : ''}`" @remove="clearFile" />

    <div class="mt-5">
      <div class="section-title">操作类型</div>
      <div class="flex gap-2 mb-4">
        <button
          v-for="op in ops"
          :key="op.value"
          class="flex-1 py-2 border-2 rounded-lg text-sm font-semibold transition-all"
          :class="operation === op.value
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
            : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary-400'"
          @click="operation = op.value"
        >{{ op.label }}</button>
      </div>

      <div>
        <label class="form-label">{{ operation === 'remove' ? '要删除的页码' : '要提取的页码' }}</label>
        <input v-model="pages" class="form-input" :placeholder="totalPages ? (operation === 'remove' ? `例如：1, 3, 5-8（共 ${totalPages} 页）` : `例如：1-3, 5, 7-9（共 ${totalPages} 页）`) : (operation === 'remove' ? '例如：1, 3, 5-8（1-based）' : '例如：1-3, 5, 7-9（1-based）')" />
        <p class="text-xs text-gray-400 mt-1">支持范围格式，如 1-3, 5, 7-9。支持中文标点：，｜－</p>
      </div>
    </div>

    <button class="btn btn-primary" :disabled="!file || !pages.trim() || loading" @click="process">
      {{ loading ? '处理中...' : operation === 'remove' ? '删除页面' : '提取页面' }}
    </button>

    <ProgressBar :show="loading" :progress="progress" :text="progressText" />

    <ResultBox :show="!!result" :type="result?.success ? 'ok' : 'fail'" :title="result?.success ? '处理成功！' : '失败'">
      <template v-if="result?.success">
        <div class="grid grid-cols-3 gap-2 mb-3">
          <div class="stat-box">
            <div class="text-base font-bold text-gray-800 dark:text-gray-200">{{ result.originalPages }}</div>
            <div class="text-xs text-gray-400 mt-0.5">原始页数</div>
          </div>
          <div class="stat-box">
            <div class="text-base font-bold text-emerald-600">{{ result.remainingPages ?? result.extractedPages }}</div>
            <div class="text-xs text-gray-400 mt-0.5">{{ operation === 'remove' ? '剩余页数' : '提取页数' }}</div>
          </div>
          <div class="stat-box">
            <div class="text-base font-bold text-gray-800 dark:text-gray-200">{{ fmtSize(result.size) }}</div>
            <div class="text-xs text-gray-400 mt-0.5">文件大小</div>
          </div>
        </div>
        <button class="btn btn-success" @click="downloadFile(result.file)">⬇ 下载文件</button>
      </template>
      <template v-else-if="result">
        <p class="text-sm text-red-700 dark:text-red-400">{{ result.error }}</p>
      </template>
    </ResultBox>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import DropZone from '../../components/DropZone.vue'
import FileItem from '../../components/FileItem.vue'
import ProgressBar from '../../components/ProgressBar.vue'
import ResultBox from '../../components/ResultBox.vue'
import { downloadFile, fmtSize } from '../../utils/download'
import { useToast } from '../../composables/useToast'

const { show: showToast } = useToast()
const file = ref<File | null>(null)
const totalPages = ref(0)
const operation = ref('remove')
const pages = ref('')
const loading = ref(false)
const progress = ref(0)
const progressText = ref('')
const result = ref<any>(null)

const ops = [
  { value: 'remove',  label: '删除页面' },
  { value: 'extract', label: '提取页面' },
]

function onFiles(files: File[]) {
  const f = files[0]
  if (f.type !== 'application/pdf') { showToast('请选择 PDF 文件'); return }
  file.value = f; result.value = null; totalPages.value = 0
  const fd = new FormData(); fd.append('pdf', f)
  fetch('/api/pdf-info', { method: 'POST', body: fd })
    .then(r => r.json()).then(d => { if (d.success) totalPages.value = d.pageCount }).catch(() => {})
}
function clearFile() { file.value = null; result.value = null; totalPages.value = 0 }

async function process() {
  if (!file.value || !pages.value.trim()) return
  loading.value = true; progress.value = 0; progressText.value = '正在处理...'
  result.value = null
  const fd = new FormData()
  fd.append('pdf', file.value)
  fd.append('pages', pages.value)
  const endpoint = operation.value === 'remove' ? '/api/remove-pages' : '/api/extract-pages'
  const timer = setInterval(() => { if (progress.value < 85) progress.value += 5 }, 100)
  try {
    result.value = await fetch(endpoint, { method: 'POST', body: fd }).then(r => r.json())
    progress.value = 100
  } catch { showToast('网络错误，请重试') }
  finally { clearInterval(timer); loading.value = false }
}

onMounted(() => {
  document.addEventListener('paste', (e) => {
    if ((e.target as HTMLElement).matches('textarea, input[type="text"]')) return
    const item = [...(e.clipboardData?.items ?? [])].find(i => i.kind === 'file' && i.type === 'application/pdf')
    if (!item) return
    const f = item.getAsFile()
    if (f) { onFiles([f]); showToast(`📋 已粘贴：${f.name}`) }
  })
})
</script>
