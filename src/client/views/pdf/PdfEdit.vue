<template>
  <div class="w-full max-w-6xl">
    <h1 class="text-xl font-bold mb-1">PDF 编辑器</h1>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-5">
      点选页面文字直接改写，支持替换、删除与新增，导出后版式保持不变
    </p>

    <DropZone
      v-if="!file"
      accept=".pdf,application/pdf"
      icon="pen"
      text="点击选择或拖拽 PDF 文件"
      hint="最大支持 200 MB"
      @files="onFiles"
    />

    <template v-else>
      <div class="flex items-center gap-2 flex-wrap mb-3">
        <div class="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate max-w-[200px]">{{ file.name }}</div>
        <span class="text-xs text-gray-400">{{ pageCount }} 页</span>

        <button class="btn btn-gray !px-2 !py-1 text-xs" :disabled="currentPage === 0" @click="goPage(currentPage - 1)">上一页</button>
        <span class="text-xs text-gray-500 tabular-nums">{{ currentPage + 1 }} / {{ pageCount }}</span>
        <button class="btn btn-gray !px-2 !py-1 text-xs" :disabled="currentPage >= pageCount - 1" @click="goPage(currentPage + 1)">下一页</button>

        <div class="flex items-center gap-1">
          <button class="btn btn-gray !px-2 !py-1 text-xs" @click="zoomBy(-0.1)">−</button>
          <span class="w-12 text-center text-xs text-gray-500 tabular-nums">{{ Math.round(scale * 100) }}%</span>
          <button class="btn btn-gray !px-2 !py-1 text-xs" @click="zoomBy(0.1)">＋</button>
          <button class="btn btn-gray !px-2 !py-1 text-xs" @click="fitWidth">适应</button>
        </div>

        <div class="ml-auto flex items-center gap-2">
          <span class="text-xs text-gray-400">已改 {{ editCount }} 处</span>
          <button class="btn btn-gray !px-2 !py-1 text-xs" :disabled="!canUndo" @click="undo">撤销</button>
          <button class="btn btn-gray !px-2 !py-1 text-xs" :disabled="!canRedo" @click="redo">重做</button>
          <button class="btn btn-primary !mt-0 !w-auto !px-3 !py-1.5 text-xs" :disabled="!editCount || exporting" @click="exportPdf">
            {{ exporting ? '生成中...' : '应用并下载' }}
          </button>
          <button class="btn btn-gray !px-2 !py-1.5 text-xs" @click="resetAll">换文件</button>
        </div>
      </div>

      <div class="flex gap-4 items-stretch h-[70vh]">
        <aside class="w-16 shrink-0 overflow-y-auto bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-1.5 space-y-1">
          <button
            v-for="n in pageCount"
            :key="n"
            class="w-full py-1.5 rounded-lg text-xs font-semibold transition-colors"
            :class="currentPage === n - 1
              ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'"
            @click="goPage(n - 1)"
          >{{ n }}</button>
        </aside>

        <div
          ref="scroller"
          class="flex-1 min-w-0 overflow-auto bg-gray-100 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-start justify-center"
        >
          <div v-if="loading" class="w-full text-sm text-gray-400 py-10 text-center">正在解析...</div>
          <PdfPageCanvas
            v-else
            :pdf="pdf"
            :page-index="currentPage"
            :scale="scale"
            @ready="onReady"
            @click="onCanvasClick"
          >
            <PdfTextLayer
              :blocks="blocks"
              :viewport="viewport"
              :edits="edits"
              :selected-id="selectedId"
              :scale="scale"
              @select="onSelectBlock"
            />
          </PdfPageCanvas>
        </div>

        <aside class="w-80 shrink-0 overflow-y-auto bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <PdfEditPanel
            :entry="selectedEntry"
            :edits="edits"
            :can-undo="canUndo"
            :can-redo="canRedo"
            @save="onSaveEntry"
            @revert="onRevert"
            @delete="onDeleteEntry"
            @clear="clearSelection"
            @undo="undo"
            @redo="redo"
            @locate="onLocate"
          />
        </aside>
      </div>

      <p v-if="error" class="text-xs text-red-500 mt-3">{{ error }}</p>
      <p class="text-xs text-gray-400 mt-3 leading-relaxed">
        替换与删除采用「背景覆盖 + 重绘」：页面外观会更新，但原文仍保留在 PDF 文本层（可能被搜索或复制到）。
      </p>

      <ResultBox :show="!!result" :type="result?.success ? 'ok' : 'fail'" :title="result?.success ? '生成成功！' : '生成失败'">
        <template v-if="result?.success">
          <div class="grid grid-cols-3 gap-2 mb-3">
            <div class="stat-box">
              <div class="text-base font-bold text-gray-800 dark:text-gray-200">{{ result.applied }}</div>
              <div class="text-xs text-gray-400 mt-0.5">已应用</div>
            </div>
            <div class="stat-box">
              <div class="text-base font-bold text-gray-800 dark:text-gray-200">{{ result.skipped }}</div>
              <div class="text-xs text-gray-400 mt-0.5">已跳过</div>
            </div>
            <div class="stat-box">
              <div class="text-base font-bold text-gray-800 dark:text-gray-200">{{ fmtSize(result.size) }}</div>
              <div class="text-xs text-gray-400 mt-0.5">文件大小</div>
            </div>
          </div>
          <button class="btn btn-success" @click="downloadFile(result.file)">
            <SvgIcon name="download" size="0.95rem" /> 下载编辑后的 PDF
          </button>
        </template>
        <template v-else-if="result">
          <p class="text-sm text-red-700 dark:text-red-400">{{ result.error }}</p>
        </template>
      </ResultBox>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DropZone from '../../components/DropZone.vue'
import ResultBox from '../../components/ResultBox.vue'
import SvgIcon from '../../components/SvgIcon.vue'
import PdfPageCanvas from '../../components/pdf/PdfPageCanvas.vue'
import PdfTextLayer from '../../components/pdf/PdfTextLayer.vue'
import PdfEditPanel from '../../components/pdf/PdfEditPanel.vue'
import { usePdfEditor, type PdfEditEntry } from '../../composables/usePdfEditor'
import { pointToPdf, type PdfPageProxy, type PdfTextBlock } from '../../utils/pdfText'
import { downloadFile, fmtSize } from '../../utils/download'
import { useToast } from '../../composables/useToast'

type Viewport = ReturnType<PdfPageProxy['getViewport']>

const { show: showToast } = useToast()

const {
  pdf, file, pageCount, currentPage, blocks, loading, error, edits,
  canUndo, canRedo, editCount, open, reset, goPage, undo, redo,
  entryForBlock, upsert, remove, addInsert,
} = usePdfEditor()

const viewport = ref<Viewport | null>(null)
const scroller = ref<HTMLElement | null>(null)
const scale = ref(1)
/** 首次渲染完成后自动按容器宽度适配一次 */
const autoFitted = ref(false)
const selectedId = ref<string | null>(null)
/** 选中但尚未保存到修改清单的临时条目 */
const draftSeed = ref<PdfEditEntry | null>(null)
const exporting = ref(false)
const result = ref<any>(null)

const selectedEntry = computed<PdfEditEntry | null>(() => {
  const saved = edits.value.find((entry) => entry.id === selectedId.value)
  if (saved) return saved
  return draftSeed.value?.id === selectedId.value ? draftSeed.value : null
})

function onFiles(files: File[]) {
  const picked = files[0]
  if (!picked) return
  if (picked.type !== 'application/pdf' && !picked.name.toLowerCase().endsWith('.pdf')) {
    showToast('请选择 PDF 文件')
    return
  }
  result.value = null
  clearSelection()
  void open(picked)
}

function resetAll() {
  reset()
  clearSelection()
  result.value = null
  viewport.value = null
}

function clearSelection() {
  selectedId.value = null
  draftSeed.value = null
}

function onReady(next: Viewport) {
  viewport.value = next
  if (!autoFitted.value) {
    autoFitted.value = true
    // 首帧时父容器可能还没完成布局（clientWidth 为 0），延后一帧再适配
    requestAnimationFrame(() => fitWidth())
  }
}

function zoomBy(delta: number) {
  scale.value = Math.min(2, Math.max(0.4, +(scale.value + delta).toFixed(2)))
}

/** 让页面宽度贴合可视区，避免出现横向滚动 */
function fitWidth() {
  const el = scroller.value
  const vp = viewport.value
  if (!el || !vp) return
  const pageWidth = vp.width / scale.value
  const available = el.clientWidth - 32
  if (pageWidth <= 0 || available <= 0) return
  scale.value = Math.min(2, Math.max(0.4, +(available / pageWidth).toFixed(3)))
}

function onCanvasClick(x: number, y: number) {
  if (!viewport.value) return
  const point = pointToPdf(x, y, viewport.value)
  const entry = addInsert(point.x, point.y, 16)
  selectedId.value = entry.id
  draftSeed.value = entry
  showToast('在右侧输入文字后点「保存」')
}

function onSelectBlock(block: PdfTextBlock) {
  const existing = entryForBlock(block.id)
  selectedId.value = block.id
  draftSeed.value = existing
    ? null
    : {
        id: block.id,
        page: block.page,
        mode: 'replace',
        rect: { ...block.rect },
        original: block.text,
        text: block.text,
        fontSize: Math.round(block.fontSize * 100) / 100,
        color: { r: 0, g: 0, b: 0 },
        align: 'left',
        fitToWidth: true,
        cover: true,
        coverColor: 'auto',
      }
}

function onSaveEntry(entry: PdfEditEntry) {
  upsert(entry)
  draftSeed.value = null
  showToast('已加入修改清单')
}

function onRevert(id: string) {
  remove(id)
  if (selectedId.value === id) clearSelection()
}

function onDeleteEntry() {
  const entry = selectedEntry.value
  if (!entry) return
  upsert({ ...entry, mode: 'delete', text: '', cover: true })
  draftSeed.value = null
  showToast('已标记为删除')
}

function onLocate(entry: PdfEditEntry) {
  if (entry.page !== currentPage.value) void goPage(entry.page)
  selectedId.value = entry.id
  draftSeed.value = null
}

async function exportPdf() {
  if (!file.value || !edits.value.length) return
  exporting.value = true
  result.value = null

  const payload = edits.value.map((entry) => ({
    page: entry.page,
    rect: entry.rect,
    text: entry.text,
    fontSize: entry.fontSize,
    color: entry.color,
    align: entry.align,
    fitToWidth: entry.fitToWidth,
    cover: entry.cover,
    coverColor: entry.coverColor,
    mode: entry.mode,
  }))

  const form = new FormData()
  form.append('pdf', file.value)
  form.append('edits', JSON.stringify(payload))

  try {
    const res = await fetch('/api/pdf-edit/apply', { method: 'POST', body: form })
    result.value = await res.json()
  } catch {
    showToast('网络错误，请重试')
  } finally {
    exporting.value = false
  }
}

watch(currentPage, () => {
  clearSelection()
})
</script>

