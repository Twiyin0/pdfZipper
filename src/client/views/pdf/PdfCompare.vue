<template>
  <div class="card card-wide">
    <h1 class="text-xl font-bold mb-1">PDF 比对</h1>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">逐页对比两个 PDF 的文字内容，高亮显示差异</p>

    <div class="grid grid-cols-2 gap-3 mb-4">
      <div
        v-for="slot in ['A', 'B']"
        :key="slot"
        class="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer relative transition-all min-h-28 flex flex-col items-center justify-center"
        :class="getSlotFile(slot) ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 hover:border-primary-400'"
        @dragover.prevent="dragOver[slot] = true"
        @dragleave="dragOver[slot] = false"
        @drop.prevent="onSlotDrop(slot, $event)"
        @click="slotInputs[slot]?.click()"
      >
        <input :ref="el => slotInputs[slot] = el as HTMLInputElement" type="file" accept=".pdf,application/pdf" class="hidden" @change="onSlotChange(slot, $event)" />
        <button v-if="getSlotFile(slot)" class="absolute top-1.5 right-2 text-gray-400 hover:text-red-500 text-sm" @click.stop="clearSlot(slot)">✕</button>
        <div class="text-2xl mb-1.5">{{ getSlotFile(slot) ? '✅' : '📄' }}</div>
        <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">文件 {{ slot }}（{{ slot === 'A' ? '原始' : '修改后' }}）</div>
        <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 break-all">
          {{ getSlotFile(slot)?.name ?? '点击或拖拽上传' }}
        </div>
        <div v-if="getSlotFile(slot)" class="text-xs text-gray-400 mt-0.5">{{ fmtSize(getSlotFile(slot)!.size) }}</div>
      </div>
    </div>

    <button class="btn btn-primary" :disabled="!fileA || !fileB || loading" @click="compare">
      {{ loading ? '比对中...' : fileA && fileB ? '开始比对' : '请先上传两个 PDF' }}
    </button>

    <ProgressBar :show="loading" :progress="progress" :text="progressText" />

    <div v-if="compareData" class="mt-5">
      <!-- Summary -->
      <div class="grid grid-cols-4 gap-2 mb-4">
        <div class="stat-box">
          <div class="text-xl font-extrabold text-primary-500">{{ compareData.totalPages }}</div>
          <div class="text-xs text-gray-400 mt-0.5">总页数</div>
        </div>
        <div class="stat-box">
          <div class="text-xl font-extrabold text-red-500">{{ compareData.changedPages }}</div>
          <div class="text-xs text-gray-400 mt-0.5">差异页</div>
        </div>
        <div class="stat-box">
          <div class="text-xl font-extrabold text-emerald-600">{{ compareData.identicalPages }}</div>
          <div class="text-xs text-gray-400 mt-0.5">相同页</div>
        </div>
        <div class="stat-box">
          <div class="text-base font-bold text-gray-700 dark:text-gray-300">{{ compareData.pagesA }} / {{ compareData.pagesB }}</div>
          <div class="text-xs text-gray-400 mt-0.5">A页 / B页</div>
        </div>
      </div>

      <!-- Filter -->
      <div class="flex gap-2 items-center mb-3 flex-wrap">
        <span class="text-xs text-gray-400">显示：</span>
        <button
          v-for="f in filters"
          :key="f.value"
          class="px-3 py-1 rounded-lg text-xs font-semibold border-2 transition-all"
          :class="currentFilter === f.value
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-400'"
          @click="currentFilter = f.value"
        >{{ f.label }}</button>
      </div>

      <!-- Page tabs -->
      <div class="flex gap-1.5 flex-wrap mb-3">
        <button
          v-for="p in visiblePages"
          :key="p.page"
          class="px-2.5 py-1 rounded-md text-xs font-semibold border-2 transition-all"
          :class="[
            currentPage === p.page ? 'border-primary-500' : 'border-gray-200 dark:border-gray-700',
            p.identical ? 'text-gray-400' : 'text-red-500 border-red-200 dark:border-red-800',
            currentPage === p.page && !p.identical ? 'bg-red-50 dark:bg-red-900/20' : '',
            currentPage === p.page && p.identical ? 'bg-primary-50 dark:bg-primary-900/20' : '',
          ]"
          @click="currentPage = p.page"
        >第 {{ p.page }} 页{{ p.identical ? '' : ' ●' }}</button>
      </div>

      <!-- Diff view -->
      <div v-if="currentPageData">
        <div v-if="currentPageData.identical" class="text-center py-6 text-gray-400 text-sm bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
          ✅ 第 {{ currentPage }} 页内容完全相同
        </div>
        <div v-else>
          <div class="grid grid-cols-2 border border-gray-200 dark:border-gray-700 rounded-t-xl overflow-hidden">
            <div class="px-4 py-2 text-xs font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 truncate">📄 {{ compareData.fileA }}</div>
            <div class="px-4 py-2 text-xs font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 truncate">📄 {{ compareData.fileB }}</div>
          </div>
          <div class="grid grid-cols-2 border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-xl overflow-hidden text-sm leading-relaxed">
            <div class="p-4 bg-gray-50 dark:bg-gray-900/50 border-r border-gray-200 dark:border-gray-700 overflow-auto max-h-96 whitespace-pre-wrap break-words" v-html="diffHtmlA" />
            <div class="p-4 bg-gray-50 dark:bg-gray-900/50 overflow-auto max-h-96 whitespace-pre-wrap break-words" v-html="diffHtmlB" />
          </div>
        </div>
      </div>
    </div>

    <div v-if="errorMsg" class="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
      <p class="text-sm text-red-700 dark:text-red-400">{{ errorMsg }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import ProgressBar from '../../components/ProgressBar.vue'
import { fmtSize } from '../../utils/download'
import { useToast } from '../../composables/useToast'

const { show: showToast } = useToast()
const fileA = ref<File | null>(null)
const fileB = ref<File | null>(null)
const slotInputs: Record<string, HTMLInputElement | null> = { A: null, B: null }
const dragOver: Record<string, boolean> = { A: false, B: false }
const loading = ref(false)
const progress = ref(0)
const progressText = ref('')
const compareData = ref<any>(null)
const currentPage = ref(1)
const currentFilter = ref('all')
const errorMsg = ref('')

const filters = [
  { value: 'all', label: '全部页面' },
  { value: 'changed', label: '仅差异页' },
  { value: 'identical', label: '仅相同页' },
]

function getSlotFile(slot: string) { return slot === 'A' ? fileA.value : fileB.value }

function setSlotFile(slot: string, f: File) {
  if (f.type !== 'application/pdf') { showToast('请选择 PDF 文件'); return }
  if (slot === 'A') fileA.value = f; else fileB.value = f
  compareData.value = null; errorMsg.value = ''
}

function clearSlot(slot: string) {
  if (slot === 'A') fileA.value = null; else fileB.value = null
}

function onSlotChange(slot: string, e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) setSlotFile(slot, f)
}

function onSlotDrop(slot: string, e: DragEvent) {
  dragOver[slot] = false
  const f = e.dataTransfer?.files?.[0]
  if (f) setSlotFile(slot, f)
}

const visiblePages = computed(() => {
  if (!compareData.value) return []
  return compareData.value.pages.filter((p: any) => {
    if (currentFilter.value === 'changed') return !p.identical
    if (currentFilter.value === 'identical') return p.identical
    return true
  })
})

const currentPageData = computed(() =>
  compareData.value?.pages.find((p: any) => p.page === currentPage.value)
)

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
}

const diffHtmlA = computed(() => {
  if (!currentPageData.value) return ''
  return currentPageData.value.changes
    .filter((c: any) => c.type !== 'added')
    .map((c: any) => c.type === 'removed'
      ? `<mark class="bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 rounded">${escHtml(c.value)}</mark>`
      : escHtml(c.value))
    .join('')
})

const diffHtmlB = computed(() => {
  if (!currentPageData.value) return ''
  return currentPageData.value.changes
    .filter((c: any) => c.type !== 'removed')
    .map((c: any) => c.type === 'added'
      ? `<mark class="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 rounded">${escHtml(c.value)}</mark>`
      : escHtml(c.value))
    .join('')
})

async function compare() {
  if (!fileA.value || !fileB.value) return
  loading.value = true; progress.value = 0; progressText.value = '正在提取文字内容...'
  compareData.value = null; errorMsg.value = ''
  const fd = new FormData()
  fd.append('pdfs', fileA.value)
  fd.append('pdfs', fileB.value)
  const timer = setInterval(() => { if (progress.value < 70) progress.value += 2 }, 100)
  try {
    const data = await fetch('/api/compare', { method: 'POST', body: fd }).then(r => r.json())
    progress.value = 100
    if (data.success) {
      compareData.value = data
      currentPage.value = data.pages[0]?.page ?? 1
    } else {
      errorMsg.value = data.error
    }
  } catch { showToast('网络错误，请重试') }
  finally { clearInterval(timer); loading.value = false }
}

onMounted(() => {
  let pasteCount = 0
  document.addEventListener('paste', (e) => {
    if ((e.target as HTMLElement).matches('textarea, input[type="text"]')) return
    const item = [...(e.clipboardData?.items ?? [])].find(i => i.kind === 'file' && i.type === 'application/pdf')
    if (!item) return
    const f = item.getAsFile()
    if (!f) return
    if (!fileA.value) { setSlotFile('A', f); pasteCount = 1 }
    else if (!fileB.value) { setSlotFile('B', f); pasteCount = 2 }
    showToast(`📋 已粘贴到文件 ${pasteCount === 1 ? 'A' : 'B'}`)
  })
})
</script>
