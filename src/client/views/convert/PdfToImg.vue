<template>
  <div class="card">
    <h1 class="text-xl font-bold mb-1">PDF 转图片</h1>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">将 PDF 每页渲染为 JPG，单页直接下载，多页打包 ZIP</p>

    <DropZone v-if="!file" accept=".pdf,application/pdf" icon="📸" text="点击选择或拖拽 PDF 文件" hint="最大支持 200 MB" @files="onFiles" />
    <FileItem v-else :name="file.name" :meta="fmtSize(file.size)" @remove="clearFile" />

    <div class="mt-5">
      <div class="mb-3">
        <div class="flex justify-between mb-1.5">
          <span class="text-sm text-gray-700 dark:text-gray-300 font-medium">输出分辨率（DPI）</span>
          <span class="text-xs font-bold text-primary-500 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-md">{{ dpi }} DPI</span>
        </div>
        <input type="range" min="72" max="300" step="1" v-model.number="dpi" />
        <div class="flex justify-between text-xs text-gray-400 mt-1">
          <span>72 (小)</span><span>150 (中)</span><span>300 (高)</span>
        </div>
      </div>
    </div>

    <button class="btn btn-primary" :disabled="!file || loading" @click="convert">
      {{ loading ? '转换中...' : file ? '开始转换' : '选择文件后开始转换' }}
    </button>

    <ProgressBar :show="loading" :progress="progress" :text="progressText" />

    <ResultBox :show="!!result" :type="result?.success ? 'ok' : 'fail'" :title="result?.success ? '转换成功！' : '失败'">
      <template v-if="result?.success">
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div class="stat-box">
            <div class="text-base font-bold text-emerald-600">{{ result.pageCount }}</div>
            <div class="text-xs text-gray-400 mt-0.5">总页数</div>
          </div>
          <div class="stat-box">
            <div class="text-base font-bold text-gray-800 dark:text-gray-200">{{ result.singleImage ? 'JPG' : 'ZIP' }}</div>
            <div class="text-xs text-gray-400 mt-0.5">输出格式</div>
          </div>
        </div>
        <button class="btn btn-success" @click="downloadFile(result.file)">
          ⬇ 下载 {{ result.singleImage ? 'JPG' : 'ZIP' }}
        </button>
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
const dpi = ref(150)
const loading = ref(false)
const progress = ref(0)
const progressText = ref('')
const result = ref<any>(null)

function onFiles(files: File[]) {
  const f = files[0]
  if (f.type !== 'application/pdf') { showToast('请选择 PDF 文件'); return }
  file.value = f; result.value = null
}
function clearFile() { file.value = null; result.value = null }

async function convert() {
  if (!file.value) return
  loading.value = true; progress.value = 0; progressText.value = `渲染页面 (${dpi.value} DPI)...`
  result.value = null
  const fd = new FormData()
  fd.append('pdf', file.value)
  fd.append('dpi', String(dpi.value))
  const timer = setInterval(() => { if (progress.value < 85) progress.value += 2 }, 150)
  try {
    result.value = await fetch('/api/pdf-to-img', { method: 'POST', body: fd }).then(r => r.json())
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
