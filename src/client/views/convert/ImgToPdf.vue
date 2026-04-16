<template>
  <div class="card">
    <h1 class="text-xl font-bold mb-1">图片转 PDF</h1>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">上传多张图片，拖拽调整顺序，合成一个 PDF</p>

    <DropZone
      accept="image/*"
      multiple
      icon="🖼️"
      text="点击选择或拖拽图片"
      hint="最多 50 张 · 支持 JPG/PNG/WebP 等"
      @files="addImages"
    />

    <div v-if="images.length" class="mt-3 flex flex-col gap-2">
      <FileItem
        v-for="item in images"
        :key="item.id"
        :name="item.file.name"
        :meta="fmtSize(item.file.size)"
        icon="🖼️"
        sortable
        :dragging="dragSrc === item.id"
        :drag-target="dragTarget === item.id"
        @remove="removeImage(item.id)"
        @dragstart="onDragStart(item.id)"
        @dragend="onDragEnd"
        @dragover="onDragOver(item.id)"
        @dragleave="dragTarget = null"
        @drop="onDrop(item.id)"
      />
    </div>

    <div v-if="images.length" class="mt-3">
      <button
        class="w-full py-2 border-2 border-dashed border-primary-200 dark:border-primary-800 rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-500 text-sm font-semibold cursor-pointer hover:border-primary-400 transition-colors relative"
        @click="addMoreInput?.click()"
      >
        <input ref="addMoreInput" type="file" accept="image/*" multiple class="hidden" @change="onAddMore" />
        ＋ 继续添加图片
      </button>
    </div>

    <button class="btn btn-primary" :disabled="!images.length || loading" @click="convert">
      {{ loading ? '转换中...' : images.length ? `转换 ${images.length} 张图片` : '请先添加图片' }}
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
            <div class="text-base font-bold text-gray-800 dark:text-gray-200">{{ fmtSize(result.size) }}</div>
            <div class="text-xs text-gray-400 mt-0.5">文件大小</div>
          </div>
        </div>
        <button class="btn btn-success" @click="downloadFile(result.file)">⬇ 下载 PDF</button>
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
interface ImageEntry { file: File; id: string }
const images = ref<ImageEntry[]>([])
const dragSrc = ref<string | null>(null)
const dragTarget = ref<string | null>(null)
const loading = ref(false)
const progress = ref(0)
const progressText = ref('')
const result = ref<any>(null)
const addMoreInput = ref<HTMLInputElement>()

function uid() { return Math.random().toString(36).slice(2) }

function addImages(files: File[]) {
  for (const f of files) {
    if (!f.type.startsWith('image/')) { showToast(`${f.name} 不是图片，已跳过`); continue }
    if (images.value.length >= 50) { showToast('最多 50 张图片'); break }
    images.value.push({ file: f, id: uid() })
  }
  result.value = null
}

function removeImage(id: string) { images.value = images.value.filter(i => i.id !== id) }
function onAddMore(e: Event) { addImages(Array.from((e.target as HTMLInputElement).files ?? [])); (e.target as HTMLInputElement).value = '' }
function onDragStart(id: string) { dragSrc.value = id }
function onDragEnd() { dragSrc.value = null; dragTarget.value = null }
function onDragOver(id: string) { if (dragSrc.value !== id) dragTarget.value = id }
function onDrop(id: string) {
  if (!dragSrc.value || dragSrc.value === id) return
  const si = images.value.findIndex(i => i.id === dragSrc.value)
  const di = images.value.findIndex(i => i.id === id)
  const [m] = images.value.splice(si, 1)
  images.value.splice(di, 0, m)
  dragTarget.value = null
}

async function convert() {
  if (!images.value.length) return
  loading.value = true; progress.value = 0; progressText.value = '正在上传...'
  result.value = null
  const fd = new FormData()
  images.value.forEach(({ file }) => fd.append('images', file))
  fd.append('order', JSON.stringify(images.value.map((_, i) => i)))
  const timer = setInterval(() => { if (progress.value < 85) progress.value += 3 }, 100)
  progressText.value = '正在生成 PDF...'
  try {
    result.value = await fetch('/api/img-to-pdf', { method: 'POST', body: fd }).then(r => r.json())
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
    if (f) { addImages([f]); showToast('📋 已粘贴截图') }
  })
})
</script>
