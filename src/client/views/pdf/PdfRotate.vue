<template>
  <div class="card card-wide">
    <h1 class="text-xl font-bold mb-1">PDF 旋转</h1>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">旋转 PDF 页面，支持全部或指定页面</p>

    <DropZone v-if="!file" accept=".pdf,application/pdf" icon="rotate-cw" text="点击选择或拖拽 PDF 文件" hint="最大支持 200 MB" @files="onFiles" />
    <FileItem v-else :name="file.name" :meta="`${fmtSize(file.size)}${totalPages ? ' · ' + totalPages + ' 页' : ''}`" @remove="clearFile" />

    <div v-if="file" class="mt-5">
      <div class="section-title">页面预览</div>
      <PageThumbnailGrid
        :pages="pageList"
        :loading="thumbLoading"
        :selected="selectedPositions"
        hint="拖拽缩略图可调整页面顺序，旋转结果按此顺序输出；高亮页为待旋转页"
        @reorder="onReorder"
      />
      <p v-if="pageList.length && renderedCount < totalPages" class="text-xs text-gray-400 mt-1">
        共 {{ totalPages }} 页，其中 {{ renderedCount }} 页已生成预览（未生成预览的页面仍参与旋转）
      </p>
    </div>

    <div class="mt-5">
      <div class="section-title">旋转角度</div>
      <div class="flex gap-2 mb-4">
        <button
          v-for="a in angles"
          :key="a.value"
          class="flex-1 py-2 border-2 rounded-lg text-sm font-semibold transition-all"
          :class="angle === a.value
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
            : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary-400'"
          @click="angle = a.value"
        >{{ a.label }}</button>
      </div>

      <div>
        <label class="form-label">指定页面（可选）</label>
        <input v-model="pages" class="form-input" :placeholder="totalPages ? `例如：1, 3, 5-8（共 ${totalPages} 页，留空则旋转全部）` : '例如：1, 3, 5-8（留空则旋转全部）'" />
        <p class="text-xs text-gray-400 mt-1">支持范围格式，如 1-3, 5, 7-9。支持中文标点：，｜－。页码按上方缩略图的当前顺序计算</p>
      </div>
    </div>

    <button class="btn btn-primary" :disabled="!file || loading" @click="rotate">
      {{ loading ? '旋转中...' : file ? '开始旋转' : '选择文件后开始旋转' }}
    </button>

    <ProgressBar :show="loading" :progress="progress" :text="progressText" />

    <ResultBox :show="!!result" :type="result?.success ? 'ok' : 'fail'" :title="result?.success ? '旋转成功！' : '失败'">
      <template v-if="result?.success">
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div class="stat-box">
            <div class="text-base font-bold text-gray-800 dark:text-gray-200">{{ result.pageCount }}</div>
            <div class="text-xs text-gray-400 mt-0.5">总页数</div>
          </div>
          <div class="stat-box">
            <div class="text-base font-bold text-gray-800 dark:text-gray-200">{{ fmtSize(result.size) }}</div>
            <div class="text-xs text-gray-400 mt-0.5">文件大小</div>
          </div>
        </div>
        <button class="btn btn-success" @click="downloadFile(result.file)"><SvgIcon name="download" size="0.95rem" /> 下载旋转文件</button>
      </template>
      <template v-else-if="result">
        <p class="text-sm text-red-700 dark:text-red-400">{{ result.error }}</p>
      </template>
    </ResultBox>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import DropZone from '../../components/DropZone.vue'
import FileItem from '../../components/FileItem.vue'
import PageThumbnailGrid from '../../components/PageThumbnailGrid.vue'
import ProgressBar from '../../components/ProgressBar.vue'
import ResultBox from '../../components/ResultBox.vue'
import SvgIcon from '../../components/SvgIcon.vue'
import { downloadFile, fmtSize } from '../../utils/download'
import { fetchThumbnails, parsePageList, type ThumbPage } from '../../utils/pdfThumbs'
import { useToast } from '../../composables/useToast'

const { show: showToast } = useToast()
const file = ref<File | null>(null)
const totalPages = ref(0)
/** 页面顺序（拖拽可调整），旋转结果按此顺序输出 */
const pageList = ref<ThumbPage[]>([])
const thumbLoading = ref(false)
/** 实际生成了缩略图的页数（其余为未生成预览的占位项） */
const renderedCount = computed(() => pageList.value.filter(p => p.data).length)
const angle = ref(90)
const pages = ref('')
const loading = ref(false)
const progress = ref(0)
const progressText = ref('')
const result = ref<any>(null)

const angles = [
  { value: 90,  label: '顺时针 90°' },
  { value: 180, label: '180°' },
  { value: 270, label: '逆时针 90°' },
]

/** 待旋转的位置（按当前缩略图顺序，1-based） */
const selectedPositions = computed(() =>
  pages.value.trim() ? parsePageList(pages.value, pageList.value.length) : [])

async function onFiles(files: File[]) {
  const f = files[0]
  if (f.type !== 'application/pdf') { showToast('请选择 PDF 文件'); return }
  file.value = f; result.value = null; totalPages.value = 0; pageList.value = []
  thumbLoading.value = true
  try {
    const res = await fetchThumbnails(f)
    pageList.value = res.pages
    totalPages.value = res.pageCount
  } catch (e: unknown) {
    showToast(`缩略图生成失败：${(e as Error).message}`)
  } finally {
    thumbLoading.value = false
  }
}
function clearFile() { file.value = null; result.value = null; totalPages.value = 0; pageList.value = [] }
function onReorder(list: ThumbPage[]) { pageList.value = list }

async function rotate() {
  if (!file.value) return
  loading.value = true; progress.value = 0; progressText.value = '正在处理...'
  result.value = null
  const fd = new FormData()
  fd.append('pdf', file.value)
  fd.append('angle', String(angle.value))
  if (pages.value.trim()) fd.append('pages', pages.value)
  if (pageList.value.length) fd.append('order', JSON.stringify(pageList.value.map(p => p.page)))
  const timer = setInterval(() => { if (progress.value < 85) progress.value += 5 }, 100)
  try {
    result.value = await fetch('/api/rotate', { method: 'POST', body: fd }).then(r => r.json())
    progress.value = 100
  } catch { showToast('网络错误，请重试') }
  finally { clearInterval(timer); loading.value = false }
}

onMounted(() => {
  document.addEventListener('paste', (e) => {
    if ((e.target as HTMLElement).matches('textarea, input[type="text"]')) return
    const item = [...(e.clipboardData?.items ?? [])].find(i => i.kind === 'file' && i.type === 'application/pdf')
    if (!item) return
    const f = item.getAsFile()
    if (f) { onFiles([f]); showToast(`已粘贴：${f.name}`) }
  })
})
</script>
