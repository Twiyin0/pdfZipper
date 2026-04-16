<template>
  <div class="card card-wide">
    <h1 class="text-xl font-bold mb-1">文本比较</h1>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">对比两段文本的差异，高亮标注增删内容</p>

    <div class="grid grid-cols-2 gap-3 mb-3">
      <div>
        <label class="form-label">文本 A（原始）</label>
        <textarea v-model="textA" class="form-input font-mono h-48 resize-y" placeholder="粘贴原始文本..." />
      </div>
      <div>
        <label class="form-label">文本 B（修改后）</label>
        <textarea v-model="textB" class="form-input font-mono h-48 resize-y" placeholder="粘贴修改后文本..." />
      </div>
    </div>

    <div class="flex gap-2 items-center flex-wrap mb-4">
      <span class="text-xs font-semibold text-gray-500">比较方式</span>
      <button v-for="m in modes" :key="m.value" class="px-3 py-1 border-2 rounded-lg text-xs font-semibold transition-all"
        :class="mode === m.value ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary-400'"
        @click="mode = m.value">{{ m.label }}</button>
      <button class="btn btn-gray ml-auto px-3 py-1 text-xs" @click="swap">⇄ 交换 A/B</button>
      <button class="btn btn-primary mt-0 w-auto px-4 py-1.5 text-xs" @click="diff">对比</button>
    </div>

    <div class="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden font-mono text-xs leading-relaxed">
      <div v-if="!diffOutput" class="p-6 text-center text-gray-400">输入文本后点击「对比」查看差异</div>
      <template v-else>
        <div class="flex gap-4 px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <span class="font-semibold text-emerald-600">+ {{ addCount }} {{ unitLabel }}新增</span>
          <span class="font-semibold text-red-500">− {{ delCount }} {{ unitLabel }}删除</span>
        </div>
        <div class="overflow-auto max-h-96">
          <template v-if="mode === 'line'">
            <div v-for="(line, i) in diffLines" :key="i"
              class="flex"
              :class="line.type === 'add' ? 'bg-emerald-50 dark:bg-emerald-900/20' : line.type === 'del' ? 'bg-red-50 dark:bg-red-900/20' : ''">
              <span class="w-9 min-w-9 text-right px-1.5 text-gray-400 bg-gray-50 dark:bg-gray-900/50 border-r border-gray-200 dark:border-gray-700 select-none text-xs leading-relaxed">
                {{ line.type !== 'del' ? line.no : '−' }}
              </span>
              <span class="px-2.5 py-0 flex-1 whitespace-pre-wrap break-all"
                :class="line.type === 'add' ? 'text-emerald-700 dark:text-emerald-300' : line.type === 'del' ? 'text-red-700 dark:text-red-300 line-through' : 'text-gray-700 dark:text-gray-300'">
                {{ line.type === 'add' ? '+ ' : line.type === 'del' ? '− ' : '  ' }}{{ line.text }}
              </span>
            </div>
          </template>
          <div v-else class="p-3 whitespace-pre-wrap break-all text-gray-700 dark:text-gray-300" v-html="inlineDiffHtml" />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import * as Diff from 'diff'

const textA = ref('')
const textB = ref('')
const mode = ref('line')
const diffOutput = ref(false)
const addCount = ref(0)
const delCount = ref(0)
const diffLines = ref<Array<{ type: string; text: string; no: number }>>([])
const inlineDiffHtml = ref('')

const modes = [
  { value: 'line', label: '逐行' },
  { value: 'word', label: '逐词' },
  { value: 'char', label: '逐字符' },
]

const unitLabel = computed(() => ({ line: '行', word: '词', char: '字符' }[mode.value] ?? ''))

function swap() { const t = textA.value; textA.value = textB.value; textB.value = t }

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function diff() {
  const a = textA.value, b = textB.value
  diffOutput.value = true
  addCount.value = 0; delCount.value = 0

  if (mode.value === 'line') {
    const parts = Diff.diffLines(a, b)
    parts.forEach(p => { if (p.added) addCount.value += p.count ?? 1; if (p.removed) delCount.value += p.count ?? 1 })
    const lines: typeof diffLines.value = []
    let lineNo = 1
    parts.forEach(part => {
      const ls = part.value.split('\n')
      if (ls[ls.length - 1] === '') ls.pop()
      const type = part.added ? 'add' : part.removed ? 'del' : 'eq'
      ls.forEach(text => {
        lines.push({ type, text, no: type !== 'del' ? lineNo++ : 0 })
      })
    })
    diffLines.value = lines
  } else {
    const parts = mode.value === 'word' ? Diff.diffWords(a, b) : Diff.diffChars(a, b)
    parts.forEach(p => { if (p.added) addCount.value += p.count ?? 1; if (p.removed) delCount.value += p.count ?? 1 })
    inlineDiffHtml.value = parts.map(p => {
      if (p.added) return `<ins class="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 rounded no-underline">${esc(p.value)}</ins>`
      if (p.removed) return `<del class="bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 rounded">${esc(p.value)}</del>`
      return esc(p.value)
    }).join('')
  }
}
</script>
