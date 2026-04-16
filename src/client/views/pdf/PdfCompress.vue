<template>
  <div class="card">
    <h1 class="text-xl font-bold mb-1">PDF 压缩</h1>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">通过调整 DPI 和图像质量减小文件体积，自动选择最优算法</p>

    <DropZone
      v-if="!file"
      accept=".pdf,application/pdf"
      icon="📄"
      text="点击选择或拖拽 PDF 文件"
      hint="最大支持 200 MB"
      @files="onFiles"
    />

    <FileItem
      v-else
      :name="file.name"
      :meta="fmtSize(file.size)"
      @remove="clearFile"
    />

    <div class="mt-5">
      <div class="section-title">质量预设</div>
      <div class="flex gap-2 flex-wrap mb-4">
        <button
          v-for="p in presets"
          :key="p.dpi"
          class="flex-1 min-w-16 py-2 px-1 border-2 rounded-lg text-center cursor-pointer transition-all text-xs"
          :class="activePreset === p.dpi
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-primary-400'"
          @click="applyPreset(p)"
        >
          <div class="font-semibold text-gray-800 dark:text-gray-200">{{ p.name }}</div>
          <div class="text-gray-400 mt-0.5">{{ p.dpi }} DPI</div>
        </button>
      </div>

      <div class="mb-3">
        <div class="flex justify-between mb-1.5">
          <span class="text-sm text-gray-700 dark:text-gray-300 font-medium">分辨率（DPI）</span>
          <span class="text-xs font-bold text-primary-500 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-md">{{ dpi }} DPI</span>
        </div>
        <input type="range" min="72" max="300" step="1" v-model.number="dpi" @input="activePreset = null" />
      </div>

      <div class="mb-3">
        <div class="flex justify-between mb-1.5">
          <span class="text-sm text-gray-700 dark:text-gray-300 font-medium">图像质量（JPEG）</span>
          <span class="text-xs font-bold text-primary-500 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-md">{{ quality }}%</span>
        </div>
        <input type="range" min="10" max="95" step="1" v-model.number="quality" @input="activePreset = null" />
      </div>

      <div class="flex items-center justify-between py-2">
        <span class="text-sm text-gray-600 dark:text-gray-400">移除元数据</span>
        <label class="relative w-9 h-5 cursor-pointer">
          <input type="checkbox" class="sr-only peer" v-model="removeMeta" />
          <span class="toggle-track peer-checked:bg-primary-500"></span>
          <span class="absolute w-3.5 h-3.5 bg-white rounded-full left-0.5 top-0.5 transition-transform peer-checked:translate-x-4"></span>
        </label>
      </div>
    </div>

    <button class="btn btn-primary" :disabled="!file || loading" @click="compress">
      {{ loading ? '压缩中...' : file ? '开始压缩' : '选择文件后开始压缩' }}
    </button>

    <ProgressBar :show="loading" :progress="progress" :text="progressText" />

    <ResultBox :show="!!result" :type="resultType" :title="resultTitle">
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
        <div class="text-center mb-3">
          <span
            class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full"
            :class="result.method === 'stream' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'"
          >
            {{ result.method === 'stream' ? '🔵 对象流压缩' : `🟣 DPI 渲染 (${result.dpi} DPI · ${Math.round(result.jpegQuality * 100)}%)` }}
          </span>
        </div>
        <button class="btn btn-success" @click="downloadFile(result.file)">⬇ 下载压缩文件</button>
      </template>
      <template v-else-if="result">
        <p class="text-sm text-red-700 dark:text-red-400">{{ result.error }}</p>
      </template>
    </ResultBox>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import DropZone from '../../components/DropZone.vue'
import FileItem from '../../components/FileItem.vue'
import ProgressBar from '../../components/ProgressBar.vue'
import ResultBox from '../../components/ResultBox.vue'
import { downloadFile, fmtSize } from '../../utils/download'
import { useToast } from '../../composables/useToast'

const { show: showToast } = useToast()

const file = ref<File | null>(null)
const dpi = ref(150)
const quality = ref(80)
const removeMeta = ref(true)
const activePreset = ref<number | null>(150)
const loading = ref(false)
const progress = ref(0)
const progressText = ref('')
const result = ref<any>(null)

const presets = [
  { name: '极小',   dpi: 72,  q: 50 },
  { name: '低质量', dpi: 100, q: 65 },
  { name: '中等',   dpi: 150, q: 80 },
  { name: '高质量', dpi: 200, q: 88 },
  { name: '打印',   dpi: 300, q: 95 },
]

const resultType = computed(() => {
  if (!result.value) return 'ok'
  if (!result.value.success) return 'fail'
  return result.value.compressedSize < result.value.originalSize ? 'ok' : 'warn'
})
const resultTitle = computed(() => {
  if (!result.value) return ''
  if (!result.value.success) return '失败'
  return result.value.compressedSize < result.value.originalSize ? '压缩成功！' : '已处理（原文件已是最优）'
})

function applyPreset(p: { dpi: number; q: number }) {
  dpi.value = p.dpi
  quality.value = p.q
  activePreset.value = p.dpi
}

function onFiles(files: File[]) {
  const f = files[0]
  if (f.type !== 'application/pdf') { showToast('请选择 PDF 文件'); return }
  file.value = f
  result.value = null
}

function clearFile() {
  file.value = null
  result.value = null
}

async function compress() {
  if (!file.value) return
  loading.value = true
  progress.value = 0
  progressText.value = '正在上传...'
  result.value = null

  const fd = new FormData()
  fd.append('pdf', file.value)
  fd.append('dpi', String(dpi.value))
  fd.append('jpegQuality', String(quality.value / 100))
  fd.append('removeMetadata', String(removeMeta.value))

  const timer = setInterval(() => {
    if (progress.value < 85) progress.value += 2
  }, 100)
  progressText.value = `渲染页面 (${dpi.value} DPI)...`

  try {
    const data = await fetch('/api/compress', { method: 'POST', body: fd }).then(r => r.json())
    progress.value = 100
    progressText.value = '完成'
    result.value = data
  } catch {
    showToast('网络错误，请重试')
  } finally {
    clearInterval(timer)
    loading.value = false
  }
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
