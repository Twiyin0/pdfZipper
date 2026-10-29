<template>
  <div class="thumb-root">
    <div v-if="loading" class="thumb-state">
      <span class="thumb-spinner" />
      <span class="text-xs text-gray-400">{{ loadingText }}</span>
    </div>
    <div v-else-if="!pages.length" class="thumb-state">
      <span class="text-xs text-gray-400">{{ emptyText }}</span>
    </div>
    <template v-else>
      <p v-if="hint" class="text-xs text-gray-400 mb-2">{{ hint }}</p>
      <div ref="gridRef" class="thumb-grid thumb-scroll" @dragleave="onGridLeave">
        <div
          v-for="(p, i) in pages"
          :key="p.key"
          class="thumb-cell"
          :class="cellClass(i)"
          draggable="true"
          @dragstart="onDragStart(i, $event)"
          @dragover.prevent="onDragOver(i, $event)"
          @drop.prevent="onDrop(i, $event)"
          @dragend="onDragEnd"
          @click="emit('toggle', i + 1)"
        >
          <div class="thumb-frame" :style="{ aspectRatio: `${p.width || 210} / ${p.height || 297}` }">
            <img
              v-if="p.data"
              :src="thumbSrc(p)"
              :alt="`第 ${i + 1} 页`"
              class="thumb-img"
              draggable="false"
              loading="lazy"
            />
            <div v-else class="thumb-placeholder">{{ placeholderText }}</div>
            <span class="thumb-index">{{ i + 1 }}</span>
            <span v-if="p.label" class="thumb-label" :title="p.label">{{ p.label }}</span>
          </div>
          <div v-if="showOriginalNo && p.page !== i + 1" class="thumb-original">原第 {{ p.page }} 页</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { thumbSrc, type ThumbPage } from '../utils/pdfThumbs'

const props = withDefaults(defineProps<{
  pages: ThumbPage[]
  loading?: boolean
  loadingText?: string
  emptyText?: string
  hint?: string
  /** 需要高亮的位置（1-based，按当前显示顺序） */
  selected?: number[]
  /** 是否显示「原第 N 页」提示 */
  showOriginalNo?: boolean
  /** 无预览时的占位文案 */
  placeholderText?: string
}>(), {
  loading: false,
  loadingText: '正在生成页面缩略图...',
  emptyText: '暂无可预览的页面',
  hint: '',
  selected: () => [],
  showOriginalNo: true,
  placeholderText: '未生成预览',
})

const emit = defineEmits<{
  /** 拖拽结束后新的页面顺序 */
  reorder: [pages: ThumbPage[]]
  /** 点击缩略图，参数为当前显示顺序中的位置（1-based） */
  toggle: [position: number]
}>()

const gridRef = ref<HTMLElement>()
const dragIndex = ref<number | null>(null)
const overIndex = ref<number | null>(null)
const overAfter = ref(false)

function cellClass(i: number) {
  return {
    'is-dragging': dragIndex.value === i,
    'is-selected': props.selected.includes(i + 1),
    'drop-before': overIndex.value === i && dragIndex.value !== null && !overAfter.value,
    'drop-after': overIndex.value === i && dragIndex.value !== null && overAfter.value,
  }
}

function onDragStart(i: number, e: DragEvent) {
  dragIndex.value = i
  overIndex.value = i
  overAfter.value = false
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    try { e.dataTransfer.setData('text/plain', String(i)) } catch { /* 某些浏览器限制 */ }
  }
}

function onDragOver(i: number, e: DragEvent) {
  if (dragIndex.value === null) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  // 落在右半边表示插到该页之后
  overAfter.value = e.clientX > rect.left + rect.width / 2
  overIndex.value = i
}

function onDrop(i: number, e: DragEvent) {
  e.preventDefault()
  const from = dragIndex.value
  if (from === null) return
  const list = props.pages.slice()
  const [moved] = list.splice(from, 1)
  let insert = overAfter.value ? i + 1 : i
  if (from < insert) insert -= 1
  if (insert !== from) {
    list.splice(insert, 0, moved)
    emit('reorder', list)
  }
  reset()
}

function onDragEnd() { reset() }

function onGridLeave(e: DragEvent) {
  const grid = gridRef.value
  const to = e.relatedTarget as Node | null
  if (grid && to && grid.contains(to)) return
  overIndex.value = null
}

function reset() {
  dragIndex.value = null
  overIndex.value = null
  overAfter.value = false
}
</script>

<style scoped>
.thumb-state {
  @apply flex items-center justify-center gap-2 py-8 rounded-xl border border-dashed border-gray-200 dark:border-gray-700;
}
.thumb-spinner {
  @apply w-3.5 h-3.5 rounded-full border-2 border-gray-300 border-t-indigo-500;
  animation: thumb-spin 0.8s linear infinite;
}
@keyframes thumb-spin {
  to { transform: rotate(360deg); }
}
.thumb-grid {
  @apply grid gap-3 pb-1;
  grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
  max-height: min(62vh, 600px);
  overflow-y: auto;
}
.thumb-cell {
  @apply relative rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1 cursor-grab transition-colors select-none;
}
.thumb-cell:hover {
  @apply border-indigo-300 dark:border-indigo-600;
}
.thumb-cell.is-selected {
  @apply border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20;
}
.thumb-cell.is-dragging {
  @apply opacity-40;
}
.thumb-cell.drop-before::before,
.thumb-cell.drop-after::after {
  content: '';
  position: absolute;
  top: -2px;
  bottom: -2px;
  width: 3px;
  border-radius: 2px;
  background: #6366f1;
}
.thumb-cell.drop-before::before { left: -7px; }
.thumb-cell.drop-after::after { right: -7px; }
.thumb-frame {
  @apply relative w-full rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center;
}
.thumb-img {
  @apply w-full h-full object-contain;
}
.thumb-placeholder {
  @apply text-[10px] text-gray-400;
}
.thumb-index {
  @apply absolute top-1 left-1 min-w-[1.15rem] h-[1.15rem] px-1 rounded-md bg-gray-900/75 text-white text-[10px] font-bold flex items-center justify-center;
}
.thumb-label {
  @apply absolute bottom-1 left-1 right-1 text-[9px] leading-tight px-1 py-0.5 rounded bg-gray-900/70 text-white truncate;
}
.thumb-original {
  @apply text-center text-[10px] text-gray-400 mt-1;
}
</style>
