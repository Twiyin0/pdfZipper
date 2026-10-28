<template>
  <div class="flex flex-col gap-4">
    <div v-if="draft" class="space-y-3">
      <div class="flex items-center justify-between">
        <div class="section-title !mb-0">{{ draft.mode === 'insert' ? '新增文字' : `第 ${draft.page + 1} 页` }}</div>
        <button class="text-xs text-gray-400 hover:text-indigo-500" @click="$emit('clear')">取消选择</button>
      </div>

      <div v-if="draft.original && draft.mode !== 'insert'" class="text-xs text-gray-500 dark:text-gray-400 truncate">
        原文：{{ draft.original }}
      </div>

      <textarea v-model="draft.text" rows="3" class="form-input resize-y" placeholder="输入新的文字" />

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="form-label">字号 (pt)</label>
          <input v-model.number="draft.fontSize" type="number" min="1" max="200" step="0.5" class="form-input" />
        </div>
        <div>
          <label class="form-label">颜色</label>
          <input
            :value="toHex(draft.color)"
            type="color"
            class="w-full h-[42px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 cursor-pointer"
            @input="draft.color = fromHex(($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>

      <div class="flex gap-1.5">
        <button
          v-for="option in aligns"
          :key="option.value"
          class="flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-colors"
          :class="draft.align === option.value
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'"
          @click="draft.align = option.value"
        >{{ option.label }}</button>
      </div>

      <label class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
        <input v-model="draft.fitToWidth" type="checkbox" class="accent-indigo-500" />
        超出原宽度时自动缩小字号
      </label>

      <template v-if="draft.mode !== 'insert'">
        <label class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <input v-model="draft.cover" type="checkbox" class="accent-indigo-500" />
          先用背景色盖住原文字
        </label>
        <div class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <span>覆盖色</span>
          <button
            class="px-2 py-1 rounded-md border text-xs"
            :class="draft.coverColor === 'auto' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-gray-200 dark:border-gray-700'"
            @click="draft.coverColor = 'auto'"
          >自动采样</button>
          <button
            class="px-2 py-1 rounded-md border text-xs"
            :class="draft.coverColor !== 'auto' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-gray-200 dark:border-gray-700'"
            @click="draft.coverColor = { r: 1, g: 1, b: 1 }"
          >白色</button>
        </div>
      </template>

      <div class="flex gap-2 pt-1">
        <button class="btn btn-gray flex-1 !py-2 text-xs" @click="$emit('revert', draft.id)">还原</button>
        <button
          v-if="draft.mode !== 'delete'"
          class="btn flex-1 !py-2 text-xs bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400"
          @click="$emit('delete', draft.id)"
        >删除文字</button>
        <button class="btn btn-success flex-1 !py-2 text-xs" @click="save">保存</button>
      </div>
    </div>

    <div v-else class="text-xs text-gray-400 leading-relaxed">
      点击页面上的文字框开始编辑；点击页面空白处可新增文字。
    </div>

    <div class="border-t border-gray-100 dark:border-gray-700 pt-3">
      <div class="flex items-center justify-between mb-2">
        <div class="section-title !mb-0">修改清单（{{ edits.length }}）</div>
        <div class="flex gap-1.5">
          <button class="btn btn-gray !px-2 !py-1 text-xs disabled:opacity-40" :disabled="!canUndo" @click="$emit('undo')">撤销</button>
          <button class="btn btn-gray !px-2 !py-1 text-xs disabled:opacity-40" :disabled="!canRedo" @click="$emit('redo')">重做</button>
        </div>
      </div>

      <div v-if="!edits.length" class="text-xs text-gray-400">还没有修改</div>

      <ul v-else class="space-y-1.5 max-h-56 overflow-y-auto pr-1">
        <li
          v-for="entry in sortedEdits"
          :key="entry.id"
          class="flex items-start gap-2 text-xs px-2 py-1.5 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
          @click="$emit('locate', entry)"
        >
          <span class="shrink-0 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300">
            {{ entry.page + 1 }} 页
          </span>
          <span
            class="flex-1 truncate"
            :class="entry.mode === 'delete' ? 'text-red-500 line-through' : 'text-gray-700 dark:text-gray-200'"
          >{{ entry.mode === 'delete' ? (entry.original || '删除') : (entry.text || '（空）') }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { EditAlign, EditColor, PdfEditEntry } from '../../composables/usePdfEditor'

const props = defineProps<{
  entry: PdfEditEntry | null
  edits: PdfEditEntry[]
  canUndo: boolean
  canRedo: boolean
}>()

const emit = defineEmits<{
  save: [entry: PdfEditEntry]
  revert: [id: string]
  delete: [id: string]
  clear: []
  undo: []
  redo: []
  locate: [entry: PdfEditEntry]
}>()

const aligns: Array<{ value: EditAlign; label: string }> = [
  { value: 'left', label: '左对齐' },
  { value: 'center', label: '居中' },
  { value: 'right', label: '右对齐' },
]

const draft = ref<PdfEditEntry | null>(null)

watch(
  () => props.entry,
  (entry) => {
    draft.value = entry
      ? {
          ...entry,
          rect: { ...entry.rect },
          color: { ...entry.color },
          coverColor: entry.coverColor === 'auto' ? 'auto' : { ...entry.coverColor },
        }
      : null
  },
  { immediate: true, deep: true },
)

const sortedEdits = computed(() =>
  [...props.edits].sort((a, b) => a.page - b.page || b.rect.y - a.rect.y),
)

function toHex(color: EditColor): string {
  const hex = (n: number) =>
    Math.round(Math.min(1, Math.max(0, n)) * 255).toString(16).padStart(2, '0')
  return `#${hex(color.r)}${hex(color.g)}${hex(color.b)}`
}

function fromHex(hex: string): EditColor {
  const value = hex.replace('#', '')
  return {
    r: parseInt(value.slice(0, 2), 16) / 255,
    g: parseInt(value.slice(2, 4), 16) / 255,
    b: parseInt(value.slice(4, 6), 16) / 255,
  }
}

function save() {
  if (!draft.value) return
  emit('save', { ...draft.value, rect: { ...draft.value.rect } })
}
</script>

