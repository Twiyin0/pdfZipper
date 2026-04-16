<template>
  <div class="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden">
    <Sidebar />
    <main class="flex-1 overflow-y-auto">
      <div class="flex items-start justify-center p-8 min-h-full">
        <RouterView />
      </div>
    </main>
    <Toast />
  </div>
</template>

<script setup lang="ts">
import Sidebar from './components/Sidebar.vue'
import Toast from './components/Toast.vue'
</script>
