<template>
  <div class="card">
    <h1 class="text-xl font-bold mb-1">二维码工具</h1>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">生成二维码图片 / 上传图片识别内容</p>

    <!-- Tabs -->
    <div class="flex border-b-2 border-gray-200 dark:border-gray-700 mb-6">
      <button v-for="t in tabs" :key="t.value" class="tab-btn" :class="{ active: tab === t.value }" @click="tab = t.value">{{ t.label }}</button>
    </div>

    <!-- Generate tab -->
    <template v-if="tab === 'gen'">
      <label class="form-label">输入内容（文本、网址等）</label>
      <textarea v-model="genContent" class="form-input h-20 resize-none mb-4" placeholder="https://example.com 或任意文本..." />

      <div class="grid grid-cols-3 gap-3 mb-4">
        <div>
          <label class="form-label">输出格式</label>
          <select v-model="genFormat" class="form-input">
            <option value="png">PNG</option>
            <option value="svg">SVG（矢量）</option>
            <option value="jpg">JPEG</option>
          </select>
        </div>
        <div>
          <label class="form-label">尺寸（px）</label>
          <select v-model.number="genSize" class="form-input">
            <option :value="200">200 px</option>
            <option :value="400">400 px</option>
            <option :value="600">600 px</option>
            <option :value="800">800 px</option>
            <option :value="1200">1200 px</option>
          </select>
        </div>
        <div>
          <label class="form-label">容错级别</label>
          <select v-model="genErrorLevel" class="form-input">
            <option value="L">L — 7%</option>
            <option value="M">M — 15%</option>
            <option value="Q">Q — 25%</option>
            <option value="H">H — 30%</option>
          </select>
        </div>
      </div>

      <div class="flex gap-4 mb-4">
        <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <input type="color" v-model="genDark" class="w-8 h-7 border-2 border-gray-200 dark:border-gray-600 rounded cursor-pointer p-0.5" />
          前景色
        </label>
        <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <input type="color" v-model="genLight" class="w-8 h-7 border-2 border-gray-200 dark:border-gray-600 rounded cursor-pointer p-0.5" />
          背景色
        </label>
      </div>

      <!-- Preview -->
      <div class="text-center my-4">
        <div v-if="!genPreview" class="w-40 h-40 bg-gray-100 dark:bg-gray-800 rounded-xl mx-auto flex items-center justify-center text-4xl text-gray-300">🔲</div>
        <img v-else :src="genPreview" class="max-w-48 rounded-xl border border-gray-200 dark:border-gray-700 mx-auto" />
      </div>

      <button class="btn btn-primary" :disabled="!genContent.trim() || genLoading" @click="generate">
        {{ genLoading ? '生成中...' : '生成二维码' }}
      </button>

      <ProgressBar :show="genLoading" :progress="genProgress" text="正在生成..." />

      <div v-if="genFile" class="mt-3">
        <button class="btn btn-success" @click="downloadFile(genFile)">⬇ 下载二维码</button>
      </div>
    </template>

    <!-- Decode tab -->
    <template v-if="tab === 'dec'">
      <DropZone v-if="!decFile" accept="image/*" icon="🔍" text="点击选择或拖拽二维码图片" hint="支持 JPG、PNG、WebP 等" @files="onDecFiles" />
      <FileItem v-else :name="decFile.name" :meta="fmtSize(decFile.size)" icon="🖼️" @remove="decFile = null; decResult = null" />

      <button class="btn btn-primary" :disabled="!decFile || decLoading" @click="decode">
        {{ decLoading ? '识别中...' : decFile ? '开始识别' : '上传图片后识别' }}
      </button>

      <ProgressBar :show="decLoading" :progress="decProgress" text="正在识别..." />

      <div v-if="decResult" class="mt-4">
        <label class="form-label">识别内容</label>
        <div
          class="p-3.5 rounded-xl border-2 text-sm font-mono break-all whitespace-pre-wrap min-h-14"
          :class="decResult.success ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300' : 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'"
        >{{ decResult.success ? decResult.content : decResult.error }}</div>
        <div v-if="decResult.success" class="flex justify-end mt-2">
          <button class="btn btn-gray px-3 py-1 text-xs" @click="copyText(decResult.content)">复制</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import DropZone from '../../components/DropZone.vue'
import FileItem from '../../components/FileItem.vue'
import ProgressBar from '../../components/ProgressBar.vue'
import { downloadFile, fmtSize } from '../../utils/download'
import type { B64File } from '../../utils/download'
import { useToast } from '../../composables/useToast'

const { show: showToast } = useToast()
const tab = ref('gen')
const tabs = [{ value: 'gen', label: '生成二维码' }, { value: 'dec', label: '识别二维码' }]

// Generate
const genContent = ref('')
const genFormat = ref('png')
const genSize = ref(400)
const genErrorLevel = ref('M')
const genDark = ref('#000000')
const genLight = ref('#ffffff')
const genLoading = ref(false)
const genProgress = ref(0)
const genPreview = ref('')
const genFile = ref<B64File | null>(null)

async function generate() {
  if (!genContent.value.trim()) return
  genLoading.value = true; genProgress.value = 0; genFile.value = null
  const timer = setInterval(() => { if (genProgress.value < 80) genProgress.value += 10 }, 50)
  try {
    const data = await fetch('/api/qrcode/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: genContent.value,
        format: genFormat.value,
        size: genSize.value,
        errorLevel: genErrorLevel.value,
        dark: genDark.value,
        light: genLight.value,
      }),
    }).then(r => r.json())
    genProgress.value = 100
    if (data.success) { genPreview.value = data.preview; genFile.value = data.file }
    else showToast(data.error)
  } catch { showToast('网络错误，请重试') }
  finally { clearInterval(timer); genLoading.value = false }
}

// Decode
const decFile = ref<File | null>(null)
const decLoading = ref(false)
const decProgress = ref(0)
const decResult = ref<any>(null)

function onDecFiles(files: File[]) { decFile.value = files[0]; decResult.value = null }

async function decode() {
  if (!decFile.value) return
  decLoading.value = true; decProgress.value = 0; decResult.value = null
  const fd = new FormData(); fd.append('image', decFile.value)
  const timer = setInterval(() => { if (decProgress.value < 80) decProgress.value += 10 }, 50)
  try {
    decResult.value = await fetch('/api/qrcode/decode', { method: 'POST', body: fd }).then(r => r.json())
    decProgress.value = 100
  } catch { showToast('网络错误，请重试') }
  finally { clearInterval(timer); decLoading.value = false }
}

function copyText(val: string) { navigator.clipboard.writeText(val); showToast('已复制到剪贴板') }

onMounted(() => {
  document.addEventListener('paste', (e) => {
    if ((e.target as HTMLElement).matches('textarea, input[type="text"]')) return
    const item = [...(e.clipboardData?.items ?? [])].find(i => i.kind === 'file' && i.type.startsWith('image/'))
    if (!item) return
    const f = item.getAsFile()
    if (f) { tab.value = 'dec'; decFile.value = f; showToast('📋 已粘贴截图') }
  })
})
</script>
