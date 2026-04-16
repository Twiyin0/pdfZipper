<template>
  <aside class="w-60 shrink-0 h-screen flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-y-auto">
    <!-- Logo -->
    <div class="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
      <span class="text-base font-bold text-primary-500 tracking-tight">PDF 工具箱</span>
    </div>

    <!-- Nav -->
    <nav class="flex-1 px-3 py-3 space-y-1">
      <template v-for="group in navGroups" :key="group.label">
        <div class="px-2 pt-3 pb-1 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          {{ group.label }}
        </div>
        <RouterLink
          v-for="item in group.items"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors duration-150"
          active-class="bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-semibold"
        >
          <span class="text-base leading-none">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </template>
    </nav>

    <!-- Theme toggle -->
    <div class="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
      <ThemeToggle />
    </div>
  </aside>
</template>

<script setup lang="ts">
import ThemeToggle from './ThemeToggle.vue'

const navGroups = [
  {
    label: 'PDF 工具',
    items: [
      { path: '/pdf/compress',       icon: '🗜️', label: '压缩' },
      { path: '/pdf/merge',          icon: '🔗', label: '合并' },
      { path: '/pdf/split',          icon: '✂️', label: '拆分' },
      { path: '/pdf/rotate',         icon: '🔄', label: '旋转' },
      { path: '/pdf/pages',          icon: '📑', label: '页面管理' },
      { path: '/pdf/compare',        icon: '🔍', label: 'PDF 比对' },
      { path: '/convert/img-to-pdf', icon: '🖼️', label: '图转 PDF' },
      { path: '/convert/pdf-to-img', icon: '📸', label: 'PDF 转图' },
    ],
  },
  {
    label: '图文处理',
    items: [
      { path: '/qrcode', icon: '🔲', label: '二维码' },
    ],
  },
  {
    label: '文本处理',
    items: [
      { path: '/text/hash',   icon: '#️⃣', label: '哈希散列' },
      { path: '/text/diff',   icon: '🔀', label: '文本比较' },
      { path: '/text/escape', icon: '🔤', label: '文本转义' },
      { path: '/text/json',   icon: '{}', label: 'JSON 格式化' },
    ],
  },
  {
    label: '图片处理',
    items: [
      { path: '/image/compress', icon: '🗜️', label: '图片压缩' },
      { path: '/image/convert',  icon: '🔁', label: '格式转换' },
    ],
  },
]
</script>
