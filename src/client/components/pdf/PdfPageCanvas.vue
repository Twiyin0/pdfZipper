<template>
  <div
    class="relative inline-block shrink-0 select-none overflow-hidden"
    :style="{ width: size.w + 'px', height: size.h + 'px' }"
  >
    <canvas
      ref="canvas"
      class="block rounded bg-white shadow-sm cursor-crosshair"
      @click="onClick"
    />
    <slot />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PdfDocumentProxy, PdfPageProxy } from '../../utils/pdfText'

const props = defineProps<{
  pdf: PdfDocumentProxy | null
  pageIndex: number
  scale: number
}>()

const emit = defineEmits<{
  ready: [viewport: ReturnType<PdfPageProxy['getViewport']>]
  click: [x: number, y: number]
}>()

const canvas = ref<HTMLCanvasElement>()
const size = ref({ w: 0, h: 0 })
let renderTask: ReturnType<PdfPageProxy['render']> | null = null

async function render() {
  if (!props.pdf || !canvas.value) return

  renderTask?.cancel()
  renderTask = null

  const page = await props.pdf.getPage(props.pageIndex + 1)
  const viewport = page.getViewport({ scale: props.scale })
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const el = canvas.value

  el.width = Math.max(1, Math.floor(viewport.width * dpr))
  el.height = Math.max(1, Math.floor(viewport.height * dpr))
  el.style.width = `${Math.floor(viewport.width)}px`
  el.style.height = `${Math.floor(viewport.height)}px`
  size.value = { w: Math.floor(viewport.width), h: Math.floor(viewport.height) }

  const ctx = el.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, viewport.width, viewport.height)

  const task = page.render({ canvasContext: ctx, viewport })
  renderTask = task
  try {
    await task.promise
    if (renderTask === task) emit('ready', viewport)
  } catch {
    // 被新的渲染任务取消属于正常流程
  }
}

function onClick(e: MouseEvent) {
  const el = canvas.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  emit('click', e.clientX - rect.left, e.clientY - rect.top)
}

// watch 回调在 setup 阶段拿不到模板 ref（canvas 还未挂载），
// 必须等挂载完成后再渲染第一页，否则画布会一直是 300x150 的默认尺寸。
onMounted(() => {
  void render()
})

watch(
  [() => props.pdf, () => props.pageIndex, () => props.scale],
  () => { void render() },
)

onBeforeUnmount(() => {
  renderTask?.cancel()
  renderTask = null
})
</script>
