<template>
  <div
    class="file-item"
    :class="{ 'opacity-40': dragging, 'border-primary-500 bg-primary-50 dark:bg-primary-900/20': dragTarget }"
    :draggable="sortable"
    @dragstart="$emit('dragstart', $event)"
    @dragend="$emit('dragend', $event)"
    @dragover.prevent="$emit('dragover', $event)"
    @dragleave="$emit('dragleave', $event)"
    @drop.prevent="$emit('drop', $event)"
  >
    <span v-if="sortable" class="text-gray-300 dark:text-gray-600 text-base cursor-grab">⠿</span>
    <span class="text-xl">{{ icon }}</span>
    <div class="flex-1 overflow-hidden">
      <div class="text-sm font-semibold truncate text-gray-800 dark:text-gray-200">{{ name }}</div>
      <div class="text-xs text-gray-400 mt-0.5">{{ meta }}</div>
    </div>
    <button
      v-if="removable"
      class="text-gray-400 hover:text-red-500 transition-colors text-sm px-1"
      @click.stop="$emit('remove')"
    >✕</button>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  name: string
  meta?: string
  icon?: string
  sortable?: boolean
  removable?: boolean
  dragging?: boolean
  dragTarget?: boolean
}>(), {
  icon: '📄',
  sortable: false,
  removable: true,
  dragging: false,
  dragTarget: false,
})

defineEmits<{
  remove: []
  dragstart: [e: DragEvent]
  dragend: [e: DragEvent]
  dragover: [e: DragEvent]
  dragleave: [e: DragEvent]
  drop: [e: DragEvent]
}>()
</script>
