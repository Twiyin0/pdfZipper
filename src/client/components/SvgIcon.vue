<template>
  <span
    class="svg-icon"
    :style="sizeStyle"
    v-html="markup"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { icons } from '../utils/icons'

const props = withDefaults(defineProps<{
  name: string
  size?: string | number
}>(), {
  size: '1em',
})

function normalizeSvg(raw: string) {
  const cleaned = raw
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s(?:width|height)="[^"]*"/g, '')
    .replace(/\b(stroke|fill)="(?!none|currentColor)[^"]*"/g, '$1="currentColor"')
    .trim()

  return cleaned.replace(/<svg\b([^>]*)>/, (_, attrs: string) => {
    const classAttr = /class="([^"]*)"/.test(attrs)
      ? attrs.replace(/class="([^"]*)"/, 'class="$1 svg-icon__svg"')
      : `${attrs} class="svg-icon__svg"`
    return `<svg${classAttr}>`
  })
}

const markup = computed(() => {
  const raw = icons[props.name]
  if (!raw) {
    if (import.meta.env.DEV) console.warn(`[SvgIcon] 未注册的图标：${props.name}`)
    return ''
  }
  return normalizeSvg(raw)
})

const sizeStyle = computed(() => ({
  '--icon-size': typeof props.size === 'number' ? `${props.size}px` : props.size,
}))
</script>

<style scoped>
.svg-icon {
  display: inline-flex;
  width: var(--icon-size);
  height: var(--icon-size);
  flex-shrink: 0;
  line-height: 0;
}

.svg-icon :deep(.svg-icon__svg) {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
