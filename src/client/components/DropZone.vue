<template>
  <div
    class="drop-zone"
    :class="{ 'drag-over': isDragging }"
    @dragover.prevent="isDragging = true"
    @dragleave="isDragging = false"
    @drop.prevent="onDrop"
    @click="fileInput?.click()"
  >
    <input
      ref="fileInput"
      type="file"
      class="hidden"
      :accept="accept"
      :multiple="multiple"
      @change="onFileChange"
    />
    <div class="text-4xl mb-2 pointer-events-none">{{ icon }}</div>
    <div class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 pointer-events-none">{{ text }}</div>
    <div class="text-xs text-gray-400 pointer-events-none">{{ hint }} · Ctrl+V 粘贴</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(defineProps<{
  accept?: string
  multiple?: boolean
  icon?: string
  text?: string
  hint?: string
}>(), {
  accept: '*',
  multiple: false,
  icon: '📄',
  text: '点击选择或拖拽文件',
  hint: '',
})

const emit = defineEmits<{
  files: [files: File[]]
}>()

const fileInput = ref<HTMLInputElement>()
const isDragging = ref(false)

function onDrop(e: DragEvent) {
  isDragging.value = false
  const files = Array.from(e.dataTransfer?.files ?? [])
  if (files.length) emit('files', files)
}

function onFileChange(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? [])
  if (files.length) emit('files', files)
  ;(e.target as HTMLInputElement).value = ''
}
</script>
