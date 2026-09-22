<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { initWasm } from '@sheep-family/core/wasm'

const route = useRoute()
const isWasmReady = ref(false)

const showFooter = computed(() => {
  return !route.meta.hideFooter
})

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
  <div class="app-shell" :class="{ 'full-screen-tool': !showFooter }">
    <AppHeader v-model:wasm-ready="isWasmReady" />
    <main class="main-content">
      <slot />
    </main>
    <AppFooter v-if="showFooter" />
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
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.full-screen-tool {
  height: 100vh;
  overflow: hidden;
}
</style>
