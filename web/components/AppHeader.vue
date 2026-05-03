<script setup lang="ts">
import { computed } from 'vue'
import { Trash2, ChevronDown, Database, Layers, Zap, Code2, Cloud, Split, Search } from 'lucide-vue-next'
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
      <NuxtLink to="/" class="logo-link">
        <div class="logo-area">
          <h1 class="logo-text">
            <span class="logo-icon">🐑</span>
            SheepComb
            <span class="logo-version">Web</span>
          </h1>
          <p class="logo-subtitle">{{ currentTitle }}</p>
        </div>
      </NuxtLink>
    </div>

    <nav class="header-nav">
      <div class="nav-main-groups">
        <!-- Shuttle Group -->
        <div class="nav-item has-dropdown">
          <button class="nav-group-trigger" :class="{ active: route.path.startsWith('/shuttle') }">
            <Database :size="16" />
            <span>Shuttle</span>
            <ChevronDown :size="14" class="chevron" />
          </button>
          <div class="dropdown-menu">
            <NuxtLink to="/shuttle/parser" class="dropdown-item" active-class="active">
              <Database :size="14" />
              <div class="item-text">
                <span class="label">パーサー</span>
                <span class="desc">Rawファイルの抽出</span>
              </div>
            </NuxtLink>
            <NuxtLink to="/shuttle/shuttle-parser" class="dropdown-item" active-class="active">
              <Layers :size="14" />
              <div class="item-text">
                <span class="label">構造化</span>
                <span class="desc">ShWvデータへの変換</span>
              </div>
            </NuxtLink>
            <NuxtLink to="/shuttle/shuttle-analyzer" class="dropdown-item" active-class="active">
              <Zap :size="14" />
              <div class="item-text">
                <span class="label">解析</span>
                <span class="desc">TM/TBマッチング</span>
              </div>
            </NuxtLink>
            <NuxtLink to="/shuttle/shuttle-manage" class="dropdown-item" active-class="active">
              <Code2 :size="14" />
              <div class="item-text">
                <span class="label">管理</span>
                <span class="desc">データの結合・分割</span>
              </div>
            </NuxtLink>
            <div class="dropdown-divider"></div>
            <NuxtLink to="/shuttle/api" class="dropdown-item" active-class="active">
              <Cloud :size="14" />
              <div class="item-text">
                <span class="label">API</span>
                <span class="desc">LLM処理設定</span>
              </div>
            </NuxtLink>
          </div>
        </div>

        <!-- Tools Group -->
        <div class="nav-item has-dropdown">
          <button class="nav-group-trigger" :class="{ active: route.path.startsWith('/tools') }">
            <Split :size="16" />
            <span>Tools</span>
            <ChevronDown :size="14" class="chevron" />
          </button>
          <div class="dropdown-menu">
            <NuxtLink to="/tools/batch" class="dropdown-item" active-class="active">
              <Split :size="14" />
              <div class="item-text">
                <span class="label">一括差分</span>
                <span class="desc">テキスト比較ツール</span>
              </div>
            </NuxtLink>
            <NuxtLink to="/tools/concordance" class="dropdown-item" active-class="active">
              <Search :size="14" />
              <div class="item-text">
                <span class="label">コンコーダンス</span>
                <span class="desc">高速な一致検索</span>
              </div>
            </NuxtLink>
          </div>
        </div>
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

.logo-link {
  text-decoration: none;
  transition: var(--transition);
}

.logo-link:hover {
  opacity: 0.8;
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
  justify-content: center;
  flex: 1;
  padding: 0 40px;
}

.nav-main-groups {
  display: flex;
  gap: 16px;
}

.nav-item {
  position: relative;
}

.nav-group-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
}

.nav-group-trigger:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.nav-group-trigger.active {
  color: var(--accent);
  background: var(--accent-glow);
}

.chevron {
  opacity: 0.5;
  transition: transform 0.3s ease;
}

.nav-item:hover .chevron {
  transform: rotate(180deg);
}

/* Dropdown Menu */
.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(10px);
  min-width: 220px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 200;
}

.nav-item:hover .dropdown-menu {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(4px);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-xs);
  text-decoration: none;
  color: var(--text-muted);
  transition: var(--transition);
}

.dropdown-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.dropdown-item.active {
  background: var(--accent-glow);
  color: var(--accent);
}

.item-text {
  display: flex;
  flex-direction: column;
}

.label {
  font-size: 0.82rem;
  font-weight: 700;
}

.desc {
  font-size: 0.68rem;
  opacity: 0.6;
}

.dropdown-divider {
  height: 1px;
  background: var(--border);
  margin: 6px 4px;
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
