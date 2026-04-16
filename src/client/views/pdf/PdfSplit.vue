<template>
  <div class="card">
    <h1 class="text-xl font-bold mb-1">PDF 拆分</h1>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">将 PDF 按页拆分，结果打包为 ZIP 下载</p>

    <DropZone v-if="!file" accept=".pdf,application/pdf" icon="✂️" text="点击选择或拖拽 PDF 文件" hint="最大支持 200 MB" @files="onFiles" />
    <FileItem v-else :name="file.name" :meta="`${fmtSize(file.size)}${totalPages ? ' · ' + totalPages + ' 页' : ''}`" @remove="clearFile" />

    <div class="mt-5">
      <div class="section-title">拆分方式</div>
      <div class="flex gap-2 mb-4">
        <button
          v-for="m in modes"
          :key="m.value"
          class="flex-1 py-2 border-2 rounded-lg text-sm font-semibold transition-all"
          :class="mode === m.value
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
            : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary-400'"
          @click="mode = m.value"
        >{{ m.label }}</button>
      </div>

      <div v-if="mode === 'ranges'" class="mb-2">
        <label class="form-label">页码范围</label>
        <input
          v-model="ranges"
          class="form-input"
          :placeholder="totalPages ? `例如：1-3, 4-5, 7（共 ${totalPages} 页）` : '例如：1-3, 4-5, 7（支持范围和单页）'"
        />
        <p class="text-xs text-gray-400 mt-1">每个范围生成一个 PDF 文件{{ totalPages ? `，共 ${totalPages} 页` : '' }}。支持中文标点：，｜－</p>
      </div>
    </div>

    <button class="btn btn-primary" :disabled="!file || loading" @click="split">
      {{ loading ? '拆分中...' : file ? '开始拆分' : '选择文件后开始拆分' }}
    </button>

    <ProgressBar :show="loading" :progress="progress" :text="progressText" />

    <ResultBox :show="!!result" :type="result?.success ? 'ok' : 'fail'" :title="result?.success ? '拆分成功！' : '失败'">
      <template v-if="result?.success">
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div class="stat-box">
            <div class="text-base font-bold text-emerald-600">{{ result.parts }}</div>
            <div class="text-xs text-gray-400 mt-0.5">拆分份数</div>
          </div>
          <div class="stat-box">
            <div class="text-base font-bold text-gray-800 dark:text-gray-200">{{ result.totalPages }}</div>
            <div class="text-xs text-gray-400 mt-0.5">总页数</div>
          </div>
        </div>
        <button class="btn btn-success" @click="downloadFile(result.file)">⬇ 下载 ZIP</button>
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
const mode = ref('each')
const ranges = ref('')
const loading = ref(false)
const progress = ref(0)
const progressText = ref('')
const result = ref<any>(null)

const modes = [
  { value: 'each', label: '每页一个文件' },
  { value: 'ranges', label: '自定义范围' },
]

function onFiles(files: File[]) {
  const f = files[0]
  if (f.type !== 'application/pdf') { showToast('请选择 PDF 文件'); return }
  file.value = f; result.value = null; totalPages.value = 0
  // Fetch page count from server
  const fd = new FormData()
  fd.append('pdf', f)
  fetch('/api/pdf-info', { method: 'POST', body: fd })
    .then(r => r.json())
    .then(data => { if (data.success) totalPages.value = data.pageCount })
    .catch(() => {})
}
function clearFile() { file.value = null; result.value = null; totalPages.value = 0 }

async function split() {
  if (!file.value) return
  loading.value = true; progress.value = 0; progressText.value = '正在处理...'
  result.value = null
  const fd = new FormData()
  fd.append('pdf', file.value)
  fd.append('mode', mode.value)
  if (mode.value === 'ranges') fd.append('ranges', ranges.value)
  const timer = setInterval(() => { if (progress.value < 85) progress.value += 3 }, 100)
  try {
    result.value = await fetch('/api/split', { method: 'POST', body: fd }).then(r => r.json())
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
