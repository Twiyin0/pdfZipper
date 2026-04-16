<template>
  <div class="card">
    <h1 class="text-xl font-bold mb-1">图片压缩</h1>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">压缩 JPG/PNG/WebP 图片，保持原始格式</p>

    <DropZone v-if="!file" accept="image/*" icon="🗜️" text="点击选择或拖拽图片" hint="最大支持 50 MB · JPG/PNG/WebP" @files="onFiles" />
    <FileItem v-else :name="file.name" :meta="fmtSize(file.size)" icon="🖼️" @remove="clearFile" />

    <div class="mt-5">
      <div class="mb-3">
        <div class="flex justify-between mb-1.5">
          <span class="text-sm text-gray-700 dark:text-gray-300 font-medium">压缩质量</span>
          <span class="text-xs font-bold text-primary-500 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-md">{{ quality }}%</span>
        </div>
        <input type="range" min="1" max="100" step="1" v-model.number="quality" />
        <div class="flex justify-between text-xs text-gray-400 mt-1">
          <span>1 (最小)</span><span>80 (推荐)</span><span>100 (最高)</span>
        </div>
      </div>
    </div>

    <button class="btn btn-primary" :disabled="!file || loading" @click="compress">
      {{ loading ? '压缩中...' : file ? '开始压缩' : '选择文件后开始压缩' }}
    </button>

    <ProgressBar :show="loading" :progress="progress" :text="progressText" />

    <ResultBox :show="!!result" :type="result?.success ? (result.compressedSize < result.originalSize ? 'ok' : 'warn') : 'fail'" :title="result?.success ? (result.compressedSize < result.originalSize ? '压缩成功！' : '已处理') : '失败'">
      <template v-if="result?.success">
        <div class="grid grid-cols-3 gap-2 mb-3">
          <div class="stat-box">
            <div class="text-base font-bold text-gray-800 dark:text-gray-200">{{ fmtSize(result.originalSize) }}</div>
            <div class="text-xs text-gray-400 mt-0.5">原始大小</div>
          </div>
          <div class="stat-box">
            <div class="text-base font-bold" :class="result.compressedSize < result.originalSize ? 'text-emerald-600' : 'text-red-500'">
              {{ fmtSize(result.compressedSize) }}
            </div>
            <div class="text-xs text-gray-400 mt-0.5">压缩后</div>
          </div>
          <div class="stat-box">
            <div class="text-base font-bold" :class="result.ratio > 0 ? 'text-emerald-600' : 'text-red-500'">
              {{ result.ratio > 0 ? '-' : '+' }}{{ Math.abs(result.ratio) }}%
            </div>
            <div class="text-xs text-gray-400 mt-0.5">{{ result.ratio > 0 ? '节省' : '增加' }}</div>
          </div>
        </div>
        <p class="text-xs text-gray-500 text-center mb-3">{{ result.width }} × {{ result.height }} px · {{ result.ext.toUpperCase() }}</p>
        <button class="btn btn-success" @click="downloadFile(result.file)">⬇ 下载压缩图片</button>
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
const quality = ref(80)
const loading = ref(false)
const progress = ref(0)
const progressText = ref('')
const result = ref<any>(null)

function onFiles(files: File[]) {
  const f = files[0]
  if (!f.type.startsWith('image/')) { showToast('请选择图片文件'); return }
  file.value = f; result.value = null
}
function clearFile() { file.value = null; result.value = null }

async function compress() {
  if (!file.value) return
  loading.value = true; progress.value = 0; progressText.value = '正在压缩...'
  result.value = null
  const fd = new FormData()
  fd.append('image', file.value)
  fd.append('quality', String(quality.value))
  const timer = setInterval(() => { if (progress.value < 85) progress.value += 5 }, 100)
  try {
    result.value = await fetch('/api/img-compress', { method: 'POST', body: fd }).then(r => r.json())
    progress.value = 100
  } catch { showToast('网络错误，请重试') }
  finally { clearInterval(timer); loading.value = false }
}

onMounted(() => {
  document.addEventListener('paste', (e) => {
    if ((e.target as HTMLElement).matches('textarea, input[type="text"]')) return
    const item = [...(e.clipboardData?.items ?? [])].find(i => i.kind === 'file' && i.type.startsWith('image/'))
    if (!item) return
    const f = item.getAsFile()
    if (f) { onFiles([f]); showToast('📋 已粘贴截图') }
  })
})
</script>
