<template>
  <Teleport to="body">
    <TransitionGroup
      tag="div"
      class="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none"
      enter-active-class="transition-all duration-200"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-200"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-for="t in toasts"
        :key="t.id"
        class="bg-gray-900 dark:bg-gray-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg"
      >
        {{ t.msg }}
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup lang="ts">
import { useToast } from '../composables/useToast'
const { toasts } = useToast()
</script>
