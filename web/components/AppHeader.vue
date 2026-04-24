<script setup lang="ts">
import { computed } from 'vue'
import { Trash2 } from 'lucide-vue-next'
import { useShuttleStore } from '../stores/shuttleStore'

const store = useShuttleStore()

const route = useRoute()

const isWasmReady = defineModel<boolean>('wasmReady', { default: false })

const currentTitle = computed(() => {
  return (route.meta.title as string) || 'SheepCombWeb'
})

const handleReset = () => {
  if (confirm('プロジェクトのすべてのデータをリセットしますか？この操作は取り消せません。')) {
    store.clear()
  }
}
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <div class="logo-area">
        <h1 class="logo-text">
          <span class="logo-icon">🐑</span>
          SheepComb
          <span class="logo-version">Web</span>
        </h1>
        <p class="logo-subtitle">{{ currentTitle }}</p>
      </div>
    </div>

    <nav class="header-nav">
      <div class="nav-group">
        <NuxtLink to="/parser" class="nav-link" active-class="active">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5V19A9 3 0 0 0 21 19V5" />
            <path d="M3 12A9 3 0 0 0 21 12" />
          </svg>
          <span>パーサー</span>
        </NuxtLink>
        <NuxtLink to="/shuttle-parse" class="nav-link" active-class="active">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span>構造化</span>
        </NuxtLink>
        <NuxtLink to="/shuttle-analyze" class="nav-link" active-class="active">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span>解析</span>
        </NuxtLink>
        <NuxtLink to="/shuttle-manage" class="nav-link" active-class="active">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="m18 8 4 4-4 4" />
            <path d="m6 8-4 4 4 4" />
            <path d="m14.5 4-5 16" />
          </svg>
          <span>管理</span>
        </NuxtLink>
        <NuxtLink to="/api" class="nav-link" active-class="active">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
          </svg>
          <span>API</span>
        </NuxtLink>
      </div>

      <div class="nav-spacer"></div>

      <div class="nav-group">
        <NuxtLink to="/batch" class="nav-link" active-class="active">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          <span>一括差分</span>
        </NuxtLink>
      </div>
    </nav>

    <div class="header-right">
      <button class="btn-reset" @click="handleReset" title="プロジェクトをリセット">
        <Trash2 :size="16" />
      </button>
      <div class="wasm-badge" :class="isWasmReady ? 'ready' : 'loading'">
        <span class="wasm-dot"></span>
        {{ isWasmReady ? 'WASM' : 'LOADING' }}
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  height: 60px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(12px);
}

.header-left {
  display: flex;
  align-items: center;
  min-width: 200px;
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 800;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  display: flex;
  align-items: baseline;
  gap: 4px;
  white-space: nowrap;
}

.logo-icon {
  -webkit-text-fill-color: initial;
  font-size: 1.1rem;
  margin-right: 2px;
}

.logo-version {
  font-size: 0.65rem;
  padding: 1px 6px;
  background: var(--accent-glow);
  -webkit-text-fill-color: var(--accent-light);
  border-radius: 4px;
  font-family: 'Inter', monospace;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.logo-subtitle {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: -2px;
}

/* Navigation */
.header-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  padding: 0 40px;
}

.nav-group {
  display: flex;
  gap: 2px;
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
  padding: 3px;
}

.nav-spacer {
  flex: 1;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  border-radius: var(--radius-xs);
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-muted);
  text-decoration: none;
  transition: var(--transition);
  white-space: nowrap;
}

.nav-link:hover {
  color: var(--text-secondary);
  background: var(--bg-hover);
}

.nav-link.active {
  color: var(--accent);
  background: var(--accent-glow);
}

.nav-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* WASM Badge */
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 200px;
  justify-content: flex-end;
}

.btn-reset {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: var(--transition);
}

.btn-reset:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error);
  border-color: var(--error);
}

.wasm-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  letter-spacing: 0.05em;
  font-family: 'Inter', monospace;
}

.wasm-badge.ready {
  background: var(--accent-glow);
  color: var(--accent-light);
  border-color: var(--border-accent);
}

.wasm-badge.loading {
  color: var(--text-muted);
  animation: pulse 2s ease-in-out infinite;
}

.wasm-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

@keyframes pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}

@media (max-width: 768px) {
  .app-header {
    height: auto;
    flex-wrap: wrap;
    padding: 12px 16px;
    gap: 8px;
  }

  .header-left,
  .header-right {
    min-width: auto;
  }

  .header-nav {
    order: 3;
    width: 100%;
    justify-content: center;
  }

  .logo-subtitle {
    display: none;
  }
}
</style>
