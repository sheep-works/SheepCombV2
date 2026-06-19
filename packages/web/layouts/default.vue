<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { initWasm } from '@sheep-family/core/wasm'


const isWasmReady = ref(false)

onMounted(async () => {
  try {
    await initWasm()
    isWasmReady.value = true
  } catch {
    console.warn('WASM initialization failed. Some features may be unavailable.')
  }
})
</script>

<template>
  <div class="app-shell">
    <AppHeader v-model:wasm-ready="isWasmReady" />
    <main class="main-content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.main-content {
  flex: 1;
}
</style>
