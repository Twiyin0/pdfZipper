<template>
  <div class="absolute inset-0">
    <button
      v-for="block in blocks"
      :key="block.id"
      type="button"
      class="absolute rounded-sm ring-1 transition-colors duration-100"
      :class="classOf(block)"
      :style="boxOf(block)"
      :title="entryOf(block.id)?.text ?? block.text"
      @click.stop="$emit('select', block)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { rectToBox, type PdfTextBlock } from '../../utils/pdfText'
import type { PdfEditEntry } from '../../composables/usePdfEditor'

const props = defineProps<{
  blocks: PdfTextBlock[]
  viewport: { convertToViewportPoint: (x: number, y: number) => number[] } | null
  edits: PdfEditEntry[]
  selectedId: string | null
}>()

defineEmits<{ select: [block: PdfTextBlock] }>()

const editMap = computed(() => {
  const map = new Map<string, PdfEditEntry>()
  for (const entry of props.edits) map.set(entry.id, entry)
  return map
})

function entryOf(id: string) {
  return editMap.value.get(id)
}

function boxOf(block: PdfTextBlock) {
  if (!props.viewport) return { display: 'none' }
  const box = rectToBox(block.rect, props.viewport)
  return {
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
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
