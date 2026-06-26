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
    <SvgIcon v-if="sortable" name="menu" size="1rem" class="text-gray-300 dark:text-gray-600 cursor-grab" />
    <SvgIcon :name="icon" size="1.25rem" class="text-gray-500 dark:text-gray-400" />
    <div class="flex-1 overflow-hidden">
      <div class="text-sm font-semibold truncate text-gray-800 dark:text-gray-200">{{ name }}</div>
      <div class="text-xs text-gray-400 mt-0.5">{{ meta }}</div>
    </div>
    <button
      v-if="removable"
      class="inline-flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors px-1"
      @click.stop="$emit('remove')"
    >
      <SvgIcon name="xmark" size="0.875rem" />
    </button>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from './SvgIcon.vue'

withDefaults(defineProps<{
  name: string
  meta?: string
  icon?: string
  sortable?: boolean
  removable?: boolean
  dragging?: boolean
  dragTarget?: boolean
}>(), {
  icon: 'file-alt',
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
