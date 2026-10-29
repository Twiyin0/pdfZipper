<template>
  <div class="card card-wide">
    <h1 class="text-xl font-bold mb-1">PDF 合并</h1>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">上传多个 PDF 文件，拖拽调整顺序，合并为一个文件</p>

    <DropZone
      accept=".pdf,application/pdf"
      multiple
      icon="link"
      text="点击选择或拖拽 PDF 文件"
      hint="可同时选择多个文件 · 最大单文件 200 MB"
      @files="addFiles"
    />

    <div v-if="files.length" class="mt-3 flex flex-col gap-2">
      <FileItem
        v-for="item in files"
        :key="item.id"
        :name="item.file.name"
        :meta="fmtSize(item.file.size)"
        sortable
        :dragging="dragSrc === item.id"
        :drag-target="dragTarget === item.id"
        @remove="removeFile(item.id)"
        @dragstart="onDragStart(item.id)"
        @dragend="onDragEnd"
        @dragover="onDragOver(item.id)"
        @dragleave="dragTarget = null"
        @drop="onDrop(item.id)"
      />
    </div>

    <p v-if="files.length > 1" class="text-xs text-gray-400 text-center mt-2">拖拽文件名可调整文件顺序</p>

    <div v-if="files.length" class="mt-3">
      <button
        class="w-full py-2 border-2 border-dashed border-primary-200 dark:border-primary-800 rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-500 text-sm font-semibold cursor-pointer hover:border-primary-400 transition-colors relative"
        @click="addMoreInput?.click()"
      >
        <input ref="addMoreInput" type="file" accept=".pdf,application/pdf" multiple class="hidden" @change="onAddMore" />
        <span class="inline-flex items-center gap-1.5">
          <SvgIcon name="plus" size="0.9rem" />
          继续添加 PDF
        </span>
      </button>
    </div>

    <div v-if="files.length" class="mt-5">
      <div class="section-title">页面顺序（合并结果顺序）</div>
      <PageThumbnailGrid
        :pages="pages"
        :loading="thumbLoading"
        :show-original-no="false"
        hint="拖拽缩略图可调整页面在合并结果中的先后顺序"
        @reorder="onReorder"
      />
      <p v-if="renderedCount < pageTotal && pageTotal" class="text-xs text-gray-400 mt-1">
        共 {{ pageTotal }} 页，其中 {{ renderedCount }} 页已生成预览（其余页面未生成预览，但仍按顺序参与合并）
      </p>
    </div>

    <div v-if="files.length" class="mt-5">
      <div class="section-title">统一页面尺寸</div>
      <div class="grid grid-cols-4 gap-2 mb-1">
        <button
          v-for="s in sizes"
          :key="s.value"
          class="py-2 border-2 rounded-lg text-xs font-semibold transition-all"
          :class="selectedSize === s.value
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
            : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary-400'"
          @click="selectedSize = s.value"
        >{{ s.label }}</button>
      </div>
      <p class="text-xs text-gray-400 mt-1">选择统一尺寸后，所有页面将等比缩放并居中</p>
    </div>

    <button class="btn btn-primary" :disabled="files.length < 2 || loading" @click="merge">
      {{ loading ? '合并中...' : files.length >= 2 ? `合并 ${files.length} 个 PDF（${pageTotal} 页）` : '请先添加至少两个 PDF' }}
    </button>

    <ProgressBar :show="loading" :progress="progress" :text="progressText" />

    <ResultBox :show="!!result" :type="result?.success ? 'ok' : 'fail'" :title="result?.success ? '合并成功！' : '失败'">
      <template v-if="result?.success">
        <div class="grid grid-cols-3 gap-2 mb-3">
          <div class="stat-box">
            <div class="text-base font-bold text-gray-800 dark:text-gray-200">{{ files.length }}</div>
            <div class="text-xs text-gray-400 mt-0.5">合并文件数</div>
          </div>
          <div class="stat-box">
            <div class="text-base font-bold text-emerald-600">{{ result.pageCount }}</div>
            <div class="text-xs text-gray-400 mt-0.5">总页数</div>
          </div>
          <div class="stat-box">
            <div class="text-base font-bold text-gray-800 dark:text-gray-200">{{ fmtSize(result.size) }}</div>
            <div class="text-xs text-gray-400 mt-0.5">文件大小</div>
          </div>
        </div>
        <p class="text-xs text-gray-500 text-center mb-3">页面尺寸：{{ selectedSize === 'original' ? '原始尺寸' : selectedSize.toUpperCase() }}</p>
        <button class="btn btn-success" @click="downloadFile(result.file)"><SvgIcon name="download" size="0.95rem" /> 下载合并文件</button>
      </template>
      <template v-else-if="result">
        <p class="text-sm text-red-700 dark:text-red-400">{{ result.error }}</p>
      </template>
    </ResultBox>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import DropZone from '../../components/DropZone.vue'
import FileItem from '../../components/FileItem.vue'
import PageThumbnailGrid from '../../components/PageThumbnailGrid.vue'
import ProgressBar from '../../components/ProgressBar.vue'
import ResultBox from '../../components/ResultBox.vue'
import SvgIcon from '../../components/SvgIcon.vue'
import { downloadFile, fmtSize } from '../../utils/download'
import { fetchThumbnails, THUMB_MIN_PER_FILE, THUMB_PAGE_LIMIT, THUMB_TOTAL_BUDGET, type ThumbPage } from '../../utils/pdfThumbs'
import { useToast } from '../../composables/useToast'

const { show: showToast } = useToast()

interface FileEntry { file: File; id: string; pages: ThumbPage[] }
const files = ref<FileEntry[]>([])
/** 展平后的页面顺序，即合并结果中的页面顺序 */
const pages = ref<ThumbPage[]>([])
const pendingThumbs = ref(0)
const thumbLoading = computed(() => pendingThumbs.value > 0)
const pageTotal = computed(() => files.value.reduce((n, f) => n + f.pages.length, 0))
/** 实际生成了缩略图的页数（其余为未生成预览的占位项） */
const renderedCount = computed(() => pages.value.filter(p => p.data).length)
const dragSrc = ref<string | null>(null)
const dragTarget = ref<string | null>(null)
const selectedSize = ref('original')
const loading = ref(false)
const progress = ref(0)
const progressText = ref('')
const result = ref<any>(null)
const addMoreInput = ref<HTMLInputElement>()

const sizes = [
  { value: 'original', label: '保持原始' },
  { value: 'a5', label: 'A5' },
  { value: 'a4', label: 'A4' },
  { value: 'a3', label: 'A3' },
  { value: 'a2', label: 'A2' },
  { value: 'a1', label: 'A1' },
  { value: 'letter', label: 'Letter' },
  { value: 'legal', label: 'Legal' },
]

function uid() { return Math.random().toString(36).slice(2) }

function fileMeta(item: FileEntry) {
  const size = fmtSize(item.file.size)
  return item.pages.length ? `${size} · ${item.pages.length} 页` : size
}

async function addFiles(newFiles: File[]) {
  const accepted: File[] = []
  for (const f of newFiles) {
    if (f.type !== 'application/pdf') { showToast(`${f.name} 不是 PDF，已跳过`); continue }
    accepted.push(f)
  }
  if (!accepted.length) return
  result.value = null
  for (const f of accepted) {
    const id = uid()
    files.value.push({ file: f, id, pages: [] })
    void loadThumbs(id, f)
  }
}

/** 加载单个文件的缩略图 */
async function loadThumbs(id: string, file: File) {
  pendingThumbs.value += 1
  try {
    // 多文件时按总预算均分预览额度，但每份文件至少保留 THUMB_MIN_PER_FILE 页，
    // 且不超过单文件上限 THUMB_PAGE_LIMIT（避免大文档出现大片未生成预览的占位格）
    const share = Math.floor(THUMB_TOTAL_BUDGET / Math.max(1, files.value.length))
    const limit = Math.min(THUMB_PAGE_LIMIT, Math.max(THUMB_MIN_PER_FILE, share))
    const { pages: filePages } = await fetchThumbnails(file, { limit, group: id, label: file.name })
    const entry = files.value.find(x => x.id === id)
    if (!entry) return
    // 多文件场景下页码只在文件内有意义，标签带上文件名避免歧义
    filePages.forEach(p => { p.label = `${file.name} · 第${p.page}页` })
    entry.pages = filePages
    insertPages(id, filePages)
  } catch (e: unknown) {
    showToast(`${file.name} 缩略图生成失败：${(e as Error).message}`)
  } finally {
    pendingThumbs.value -= 1
  }
}

/** 把某文件的页面插入到展平列表中它应在的位置（按文件顺序） */
function insertPages(id: string, filePages: ThumbPage[]) {
  const order = files.value.map(f => f.id)
  const pos = order.indexOf(id)
  const before = new Set(order.slice(0, pos))
  let insertAt = 0
  for (let i = 0; i < pages.value.length; i++) {
    if (before.has(pages.value[i].group ?? '')) insertAt = i + 1
  }
  pages.value.splice(insertAt, 0, ...filePages)
}

/** 文件顺序变化后按新顺序重排页面（文件内相对顺序保持不变） */
function regroupPages() {
  const rank = new Map(files.value.map((f, i) => [f.id, i]))
  pages.value = pages.value
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const ra = rank.get(a.p.group ?? '') ?? 0
      const rb = rank.get(b.p.group ?? '') ?? 0
      return ra === rb ? a.i - b.i : ra - rb
    })
    .map(x => x.p)
}

function removeFile(id: string) {
  files.value = files.value.filter(f => f.id !== id)
  pages.value = pages.value.filter(p => p.group !== id)
}

function onAddMore(e: Event) {
  addFiles(Array.from((e.target as HTMLInputElement).files ?? []))
  ;(e.target as HTMLInputElement).value = ''
}

function onDragStart(id: string) { dragSrc.value = id }
function onDragEnd() { dragSrc.value = null; dragTarget.value = null }
function onDragOver(id: string) { if (dragSrc.value !== id) dragTarget.value = id }
function onDrop(id: string) {
  if (!dragSrc.value || dragSrc.value === id) return
  const srcIdx = files.value.findIndex(f => f.id === dragSrc.value)
  const dstIdx = files.value.findIndex(f => f.id === id)
  const [moved] = files.value.splice(srcIdx, 1)
  let insert = dstIdx
  if (srcIdx < insert) insert -= 1
  files.value.splice(insert, 0, moved)
  dragTarget.value = null
  regroupPages()
}

function onReorder(list: ThumbPage[]) { pages.value = list }

async function merge() {
  if (files.value.length < 2) return
  loading.value = true; progress.value = 0; progressText.value = '正在上传...'
  result.value = null
  const fd = new FormData()
  files.value.forEach(({ file }) => fd.append('pdfs', file))
  fd.append('order', JSON.stringify(files.value.map((_, i) => i)))
  fd.append('paperSize', selectedSize.value)

  // 页面级顺序：所有文件的页面都已加载预览时才发送，否则退回按文件顺序合并
  const fileIndex = new Map(files.value.map((f, i) => [f.id, i]))
  const allLoaded = files.value.every(f => f.pages.length > 0)
  if (allLoaded && pages.value.length) {
    const pageOrder = pages.value.map(p => {
      const f = p.group === undefined ? undefined : fileIndex.get(p.group)
      return f === undefined ? null : { f, p: p.page }
    }).filter((x): x is { f: number; p: number } => x !== null)
    if (pageOrder.length) fd.append('pageOrder', JSON.stringify(pageOrder))
  }

  const timer = setInterval(() => { if (progress.value < 85) progress.value += 3 }, 100)
  progressText.value = '正在合并页面...'
  try {
    result.value = await fetch('/api/merge', { method: 'POST', body: fd }).then(r => r.json())
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
    if (f) { addFiles([f]); showToast(`已粘贴：${f.name}`) }
  })
})
</script>
