<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import { initWasm } from '@/logic/wasm'

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
      <router-view v-slot="{ Component }">
        <transition name="fade-slide" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
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
