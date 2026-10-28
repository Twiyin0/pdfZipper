import { computed, ref, shallowRef } from 'vue'
import {
  loadPdfDocument,
  extractPageBlocks,
  type PdfDocumentProxy,
  type PdfTextBlock,
  type PdfRect,
  type FontFamily,
} from '../utils/pdfText'

export type EditMode = 'replace' | 'delete' | 'insert'
export type EditAlign = 'left' | 'center' | 'right'
export interface EditColor { r: number; g: number; b: number }

export interface PdfEditEntry {
  id: string
  page: number
  mode: EditMode
  /** PDF 用户空间坐标（左下原点、未应用 /Rotate） */
  rect: PdfRect
  original?: string
  text: string
  fontSize: number
  /** 字体类别，默认跟随原文字体 */
  fontFamily: FontFamily
  color: EditColor
  align: EditAlign
  fitToWidth: boolean
  cover: boolean
  coverColor: 'auto' | EditColor
}

let seq = 0
const nextId = (prefix: string) => `${prefix}-${++seq}`

function cloneEntries(list: PdfEditEntry[]): PdfEditEntry[] {
  return list.map((entry) => ({
    ...entry,
    rect: { ...entry.rect },
    color: { ...entry.color },
    coverColor: entry.coverColor === 'auto' ? 'auto' : { ...entry.coverColor },
  }))
}

export function usePdfEditor() {
  const pdf = shallowRef<PdfDocumentProxy | null>(null)
  const file = ref<File | null>(null)
  const pageCount = ref(0)
  const currentPage = ref(0)
  const blocks = ref<PdfTextBlock[]>([])
  const loading = ref(false)
  const error = ref('')

  const edits = ref<PdfEditEntry[]>([])
  const history = ref<PdfEditEntry[][]>([[]])
  const historyIndex = ref(0)

  const pageCache = new Map<number, PdfTextBlock[]>()

  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value < history.value.length - 1)
  const editCount = computed(() => edits.value.length)

  function commit(next: PdfEditEntry[]) {
    history.value = history.value.slice(0, historyIndex.value + 1)
    history.value.push(cloneEntries(next))
    if (history.value.length > 51) history.value.shift()
    historyIndex.value = history.value.length - 1
    edits.value = cloneEntries(next)
  }

  function undo() {
    if (!canUndo.value) return
    historyIndex.value -= 1
    edits.value = cloneEntries(history.value[historyIndex.value])
  }

  function redo() {
    if (!canRedo.value) return
    historyIndex.value += 1
    edits.value = cloneEntries(history.value[historyIndex.value])
  }

  async function goPage(index: number) {
    if (!pdf.value) return
    const target = Math.min(Math.max(index, 0), pageCount.value - 1)
    currentPage.value = target

    const cached = pageCache.get(target)
    if (cached) { blocks.value = cached; return }

    loading.value = true
    error.value = ''
    try {
      const page = await pdf.value.getPage(target + 1)
      const list = await extractPageBlocks(page, target)
      pageCache.set(target, list)
      if (currentPage.value === target) blocks.value = list
    } catch (e) {
      error.value = (e as Error).message || '解析页面文字失败'
    } finally {
      loading.value = false
    }
  }

  async function open(nextFile: File) {
    loading.value = true
    error.value = ''
    try {
      const data = await nextFile.arrayBuffer()
      const doc = await loadPdfDocument(data)

      pdf.value = doc
      file.value = nextFile
      pageCount.value = doc.numPages
      pageCache.clear()
      edits.value = []
      history.value = [[]]
      historyIndex.value = 0
      currentPage.value = 0

      await goPage(0)
    } catch (e) {
      error.value = (e as Error).message || '无法解析该 PDF（可能是加密文件）'
      pdf.value = null
      file.value = null
      pageCount.value = 0
      blocks.value = []
    } finally {
      loading.value = false
    }
  }

  function reset() {
    pdf.value?.destroy()
    pdf.value = null
    file.value = null
    pageCount.value = 0
    currentPage.value = 0
    blocks.value = []
    edits.value = []
    history.value = [[]]
    historyIndex.value = 0
    error.value = ''
    pageCache.clear()
  }

  function entryForBlock(blockId: string): PdfEditEntry | undefined {
    return edits.value.find((e) => e.id === blockId)
  }

  function upsert(entry: PdfEditEntry) {
    const exists = edits.value.some((e) => e.id === entry.id)
    commit(exists
      ? edits.value.map((e) => (e.id === entry.id ? entry : e))
      : [...edits.value, entry])
  }

  function remove(id: string) {
    commit(edits.value.filter((e) => e.id !== id))
  }

  function revert(id: string) {
    remove(id)
  }

  /** 在页面坐标 (pdfX, pdfY)（基线位置）插入一段新文字 */
  function addInsert(pdfX: number, pdfY: number, fontSize = 16): PdfEditEntry {
    const entry: PdfEditEntry = {
      id: nextId('insert'),
      page: currentPage.value,
      mode: 'insert',
      rect: {
        x: pdfX,
        y: pdfY - fontSize * 0.25,
        w: 0,
        h: fontSize * 1.2,
      },
      text: '',
      fontSize,
      fontFamily: 'sans',
      color: { r: 0, g: 0, b: 0 },
      align: 'left',
      fitToWidth: false,
      cover: false,
      coverColor: 'auto',
    }
    commit([...edits.value, entry])
    return entry
  }

  /** 把块变成可编辑条目（未修改过则用原文与样式初始化） */
  function ensureEntry(block: PdfTextBlock): PdfEditEntry {
    const existing = entryForBlock(block.id)
    if (existing) return existing

    const entry: PdfEditEntry = {
      id: block.id,
      page: block.page,
      mode: 'replace',
      rect: { ...block.rect },
      original: block.text,
      text: block.text,
      fontSize: Math.round(block.fontSize * 100) / 100,
      fontFamily: block.fontFamily,
      color: { r: 0, g: 0, b: 0 },
      align: 'left',
      fitToWidth: true,
      cover: true,
      coverColor: 'auto',
    }
    commit([...edits.value, entry])
    return entry
  }

  return {
    pdf, file, pageCount, currentPage, blocks, loading, error,
    edits, canUndo, canRedo, editCount,
    open, reset, goPage, undo, redo,
    entryForBlock, ensureEntry, upsert, remove, revert, addInsert,
  }
}
