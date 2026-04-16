<template>
  <div class="card">
    <h1 class="text-xl font-bold mb-1">图片格式转换</h1>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">JPG ↔ PNG ↔ WebP ↔ AVIF，图片 ↔ Base64</p>

    <!-- Tabs -->
    <div class="flex border-b-2 border-gray-200 dark:border-gray-700 mb-6">
      <button v-for="t in tabs" :key="t.value" class="tab-btn" :class="{ active: tab === t.value }" @click="tab = t.value">{{ t.label }}</button>
    </div>

    <!-- Format conversion tab -->
    <template v-if="tab === 'fmt'">
      <DropZone v-if="!file" accept="image/*" icon="🔁" text="点击选择或拖拽图片" hint="最大支持 50 MB" @files="onFiles" />
      <FileItem v-else :name="file.name" :meta="fmtSize(file.size)" icon="🖼️" @remove="clearFile" />

      <div class="mt-5">
        <div class="section-title">目标格式</div>
        <div class="flex gap-2 flex-wrap mb-4">
          <button
            v-for="f in formats"
            :key="f.value"
            class="flex-1 min-w-14 py-2 border-2 rounded-lg text-sm font-semibold transition-all"
            :class="targetFmt === f.value
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
              : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary-400'"
            @click="targetFmt = f.value"
          >{{ f.label }}</button>
        </div>

        <div v-if="targetFmt !== 'png'" class="mb-3">
          <div class="flex justify-between mb-1.5">
            <span class="text-sm text-gray-700 dark:text-gray-300 font-medium">质量</span>
            <span class="text-xs font-bold text-primary-500 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-md">{{ quality }}%</span>
          </div>
          <input type="range" min="1" max="100" step="1" v-model.number="quality" />
        </div>
      </div>

      <button class="btn btn-primary" :disabled="!file || loading" @click="convertFmt">
        {{ loading ? '转换中...' : file ? `转换为 ${targetFmt.toUpperCase()}` : '选择文件后开始转换' }}
      </button>

      <ProgressBar :show="loading" :progress="progress" :text="progressText" />

      <ResultBox :show="!!result" :type="result?.success ? 'ok' : 'fail'" :title="result?.success ? '转换成功！' : '失败'">
        <template v-if="result?.success">
          <div class="grid grid-cols-2 gap-2 mb-3">
            <div class="stat-box">
              <div class="text-base font-bold text-gray-800 dark:text-gray-200">{{ fmtSize(result.originalSize) }}</div>
              <div class="text-xs text-gray-400 mt-0.5">原始大小</div>
            </div>
            <div class="stat-box">
              <div class="text-base font-bold text-emerald-600">{{ fmtSize(result.convertedSize) }}</div>
              <div class="text-xs text-gray-400 mt-0.5">转换后</div>
            </div>
          </div>
          <button class="btn btn-success" @click="downloadFile(result.file)">⬇ 下载 {{ result.ext.toUpperCase() }}</button>
        </template>
        <template v-else-if="result">
          <p class="text-sm text-red-700 dark:text-red-400">{{ result.error }}</p>
        </template>
      </ResultBox>
    </template>

    <!-- Base64 encode tab -->
    <template v-if="tab === 'enc'">
      <DropZone v-if="!encFile" accept="image/*" icon="🔤" text="点击选择或拖拽图片" hint="图片转 Base64" @files="onEncFiles" />
      <FileItem v-else :name="encFile.name" :meta="fmtSize(encFile.size)" icon="🖼️" @remove="encFile = null; encResult = ''" />

      <button class="btn btn-primary" :disabled="!encFile" @click="encodeBase64">转为 Base64</button>

      <div v-if="encResult" class="mt-4">
        <label class="form-label">Base64 Data URL</label>
        <textarea class="form-input font-mono text-xs h-28 resize-none" readonly :value="encResult" />
        <div class="flex gap-2 mt-2">
          <button class="btn btn-gray flex-1" @click="copyBase64">复制</button>
        </div>
      </div>
    </template>

    <!-- Base64 decode tab -->
    <template v-if="tab === 'dec'">
      <label class="form-label">粘贴 Base64 Data URL</label>
      <textarea v-model="decInput" class="form-input font-mono text-xs h-28 resize-none mb-4" placeholder="data:image/png;base64,..." />

      <button class="btn btn-primary" :disabled="!decInput.trim() || loading" @click="decodeBase64">
        {{ loading ? '解码中...' : '解码并下载' }}
      </button>

      <ProgressBar :show="loading" :progress="progress" :text="progressText" />

      <ResultBox :show="!!decResult" :type="decResult?.success ? 'ok' : 'fail'" :title="decResult?.success ? '解码成功！' : '失败'">
        <template v-if="decResult?.success">
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">{{ decResult.ext.toUpperCase() }} · {{ fmtSize(decResult.size) }}</p>
          <button class="btn btn-success" @click="downloadFile(decResult.file)">⬇ 下载图片</button>
        </template>
        <template v-else-if="decResult">
          <p class="text-sm text-red-700 dark:text-red-400">{{ decResult.error }}</p>
        </template>
      </ResultBox>
    </template>
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
const tab = ref('fmt')
const tabs = [
  { value: 'fmt', label: '格式转换' },
  { value: 'enc', label: '图片→Base64' },
  { value: 'dec', label: 'Base64→图片' },
]
const formats = [
  { value: 'jpeg', label: 'JPEG' },
  { value: 'png',  label: 'PNG' },
  { value: 'webp', label: 'WebP' },
  { value: 'avif', label: 'AVIF' },
]

// fmt tab
const file = ref<File | null>(null)
const targetFmt = ref('jpeg')
const quality = ref(85)
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

async function convertFmt() {
  if (!file.value) return
  loading.value = true; progress.value = 0; progressText.value = '正在转换...'
  result.value = null
  const fd = new FormData()
  fd.append('image', file.value)
  fd.append('target', targetFmt.value)
  fd.append('quality', String(quality.value))
  const timer = setInterval(() => { if (progress.value < 85) progress.value += 5 }, 100)
  try {
    result.value = await fetch('/api/img-convert', { method: 'POST', body: fd }).then(r => r.json())
    progress.value = 100
  } catch { showToast('网络错误，请重试') }
  finally { clearInterval(timer); loading.value = false }
}

// enc tab
const encFile = ref<File | null>(null)
const encResult = ref('')

function onEncFiles(files: File[]) {
  const f = files[0]
  if (!f.type.startsWith('image/')) { showToast('请选择图片文件'); return }
  encFile.value = f; encResult.value = ''
}

function encodeBase64() {
  if (!encFile.value) return
  const reader = new FileReader()
  reader.onload = () => { encResult.value = reader.result as string }
  reader.readAsDataURL(encFile.value)
}

function copyBase64() {
  navigator.clipboard.writeText(encResult.value)
  showToast('已复制到剪贴板')
}

// dec tab
const decInput = ref('')
const decResult = ref<any>(null)

async function decodeBase64() {
  if (!decInput.value.trim()) return
  loading.value = true; progress.value = 50; progressText.value = '正在解码...'
  decResult.value = null
  try {
    decResult.value = await fetch('/api/img-from-base64', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl: decInput.value.trim() }),
    }).then(r => r.json())
    progress.value = 100
  } catch { showToast('网络错误，请重试') }
  finally { loading.value = false }
}

onMounted(() => {
  document.addEventListener('paste', (e) => {
    if ((e.target as HTMLElement).matches('textarea, input[type="text"]')) return
    const item = [...(e.clipboardData?.items ?? [])].find(i => i.kind === 'file' && i.type.startsWith('image/'))
    if (!item) return
    const f = item.getAsFile()
    if (!f) return
    if (tab.value === 'fmt') { onFiles([f]); showToast('📋 已粘贴截图') }
    else if (tab.value === 'enc') { onEncFiles([f]); showToast('📋 已粘贴截图') }
  })
})
</script>
