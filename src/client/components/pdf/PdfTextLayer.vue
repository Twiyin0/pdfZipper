<template>
  <div class="absolute inset-0">
    <template v-for="block in blocks" :key="block.id">
      <button
        type="button"
        class="absolute rounded-sm ring-1 transition-colors duration-100"
        :class="classOf(block)"
        :style="boxStyle(block.rect)"
        :title="entryOf(block.id)?.text ?? block.text"
        @click.stop="$emit('select', block)"
      />

      <!-- 删除：用白底模拟擦除效果 -->
      <span
        v-if="isDeleting(block.id)"
        class="absolute pointer-events-none rounded-sm bg-white/95"
        :style="boxStyle(block.rect)"
      />

      <!-- 替换：按原位置/字号预览新文字 -->
      <span
        v-else-if="previewOf(block.id)"
        class="absolute pointer-events-none whitespace-pre overflow-hidden rounded-sm"
        :style="previewStyle(block.id, block.rect)"
      >{{ previewOf(block.id) }}</span>
    </template>

    <!-- 新增文字：没有对应文本块，单独渲染 -->
    <span
      v-for="entry in insertPreviews"
      :key="`insert-${entry.id}`"
      class="absolute pointer-events-none whitespace-pre rounded-sm"
      :style="previewStyle(entry.id, entry.rect)"
    >{{ entry.text }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { rectToBox, type PdfRect, type PdfTextBlock } from '../../utils/pdfText'
import type { PdfEditEntry } from '../../composables/usePdfEditor'

const props = defineProps<{
  blocks: PdfTextBlock[]
  viewport: { convertToViewportPoint: (x: number, y: number) => number[] } | null
  edits: PdfEditEntry[]
  selectedId: string | null
  /** 当前渲染缩放，用于按比例换算预览字号 */
  scale: number
}>()

defineEmits<{ select: [block: PdfTextBlock] }>()

const editMap = computed(() => {
  const map = new Map<string, PdfEditEntry>()
  for (const entry of props.edits) map.set(entry.id, entry)
  return map
})

const insertPreviews = computed(() =>
  props.edits.filter((entry) => entry.mode === 'insert' && entry.text.trim()),
)

function entryOf(id: string) {
  return editMap.value.get(id)
}

function isDeleting(id: string) {
  return entryOf(id)?.mode === 'delete'
}

/** 仅当新文字与原文不同才预览，避免和 canvas 上的原文叠字 */
function previewOf(id: string) {
  const entry = entryOf(id)
  if (!entry || entry.mode === 'delete') return ''
  const text = entry.text
  if (!text.trim()) return ''
  if (entry.mode === 'replace' && text === entry.original) return ''
  return text
}

function boxOf(rect: PdfRect) {
  if (!props.viewport) return { left: 0, top: 0, width: 1, height: 1 }
  return rectToBox(rect, props.viewport)
}

function boxStyle(rect: PdfRect) {
  const box = boxOf(rect)
  return {
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
  }
}

function previewStyle(id: string, rect: PdfRect) {
  const entry = entryOf(id)
  if (!entry) return { display: 'none' }

  const box = boxOf(rect)
  const fontSize = Math.max(entry.fontSize * props.scale, 1)

  return {
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: entry.rect.w > 0 ? `${box.width}px` : 'auto',
    height: `${box.height}px`,
    fontSize: `${fontSize}px`,
    lineHeight: `${box.height}px`,
    color: `rgb(${Math.round(entry.color.r * 255)}, ${Math.round(entry.color.g * 255)}, ${Math.round(entry.color.b * 255)})`,
    textAlign: entry.align,
    fontFamily: "'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    background: entry.mode === 'insert' ? 'transparent' : 'rgba(255, 255, 255, 0.92)',
  }
}

function classOf(block: PdfTextBlock) {
  const entry = entryOf(block.id)
  const selected = props.selectedId === block.id

  if (selected) return 'ring-2 ring-indigo-500 bg-indigo-500/20'
  if (!entry) return 'ring-transparent hover:ring-indigo-400 hover:bg-indigo-400/10'
  if (entry.mode === 'delete') return 'ring-red-400 bg-red-500/15'
  return 'ring-emerald-500 bg-emerald-500/15'
}
</script>
