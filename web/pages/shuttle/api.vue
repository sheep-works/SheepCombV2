<script setup lang="ts">
/**
 * web/pages/api.vue
 * API Client tool.
 */
definePageMeta({
  title: 'API Client',
  icon: 'cloud',
})

import { ref, computed, watch, onMounted } from 'vue'
import { Send, Cloud, Loader2, AlertCircle, RefreshCw, Trash2 } from 'lucide-vue-next'
// Note: Using relative paths instead of Nuxt aliases (~~, ~, @) to ensure stable resolution.
import { useShuttleStore } from '../../stores/shuttleStore'
import { SheepShuttle } from '../../../logic/shuttle/sheepShuttle.js'

const store = useShuttleStore()

onMounted(async () => {
  await store.checkConnection()
})

const modes = [
  { id: 'units', name: 'Raw Units' },
  { id: 'data', name: 'ShWvData' }
]
const mode = ref('units')

const requestTargets = [
  { id: 'CHECK', name: 'Check' },
  { id: 'TRANSLATE', name: 'Translate' }
]
const requestTarget = ref<'CHECK' | 'TRANSLATE'>('CHECK')
const userPrompt = ref('')

const isRequesting = ref(false)
const errorMsg = ref<string>('')

async function createChunks() {
  try {
    store.createChunks(mode.value as 'units' | 'data', 4000)
  } catch (e: any) {
    errorMsg.value = e.message
  }
}

async function processChunk(index: number) {
  // 再チェック
  const ok = await store.checkConnection()
  if (!ok) {
    errorMsg.value = 'API サーバー (SheepHub) がオフラインです。起動しているか確認してください。'
    return
  }

  isRequesting.value = true
  errorMsg.value = ''
  try {
    await store.processRequests(index, requestTarget.value, userPrompt.value)
  } catch (e: any) {
    errorMsg.value = e.message
  } finally {
    isRequesting.value = false
  }
}

async function processAll() {
  // 再チェック
  const ok = await store.checkConnection()
  if (!ok) {
    errorMsg.value = 'API サーバー (SheepHub) がオフラインです。起動しているか確認してください。'
    return
  }

  isRequesting.value = true
  errorMsg.value = ''
  try {
    // 成功していないチャンクを順番に処理
    for (let i = 0; i < store.chunks.length; i++) {
      if (store.chunks[i]!.status !== 'success') {
        await processChunk(i)
      }
    }
  } catch (e: any) {
    errorMsg.value = e.message
  } finally {
    isRequesting.value = false
  }
}

function clearResults() {
  errorMsg.value = ''
  store.clearChunks()
}

function getStatusColor(status: string) {
  switch (status) {
    case 'success': return 'var(--success-glow)'
    case 'error': return 'var(--error-glow)'
    case 'pending': return 'var(--warning-glow)'
    default: return 'transparent'
  }
}
</script>

<template>
  <div class="api-view">
    <div class="api-layout">
      <!-- Sidebar: Request Settings -->
      <aside class="sidebar">
        <div class="card">
          <div class="card-header">
            <h2>リクエスト設定</h2>
            <span class="dev-badge">SheepHub v2</span>
          </div>

          <div class="config-section">
            <div class="config-group">
              <label class="config-label">チャンク作成モード</label>
              <div class="radio-group">
                <div v-for="m in modes" :key="m.id" class="radio-item" :class="{ active: mode === m.id }"
                  @click="mode = m.id">
                  <input type="radio" :value="m.id" v-model="mode" />
                  <span>{{ m.name }}</span>
                </div>
              </div>
            </div>

            <div class="config-group">
              <label class="config-label">リクエスト種別</label>
              <div class="source-tabs">
                <button v-for="t in requestTargets" :key="t.id" class="source-tab"
                  :class="{ active: requestTarget === t.id }" @click="requestTarget = t.id as any">
                  {{ t.name }}
                </button>
              </div>
            </div>

            <div class="config-group">
              <label class="config-label">カスタムプロンプト (オプション)</label>
              <textarea v-model="userPrompt" class="prompt-textarea" placeholder="例: 文末をですます調に統一してください。"></textarea>
            </div>

            <div class="button-row">
              <button class="btn-action secondary" @click="createChunks" :disabled="!store.hasUnits && !store.hasData">
                <RefreshCw :size="16" /> チャンク作成
              </button>
              <button class="btn-action primary" @click="processAll" :disabled="!store.hasChunks || isRequesting">
                <Send :size="16" /> 全チャンク処理
              </button>
            </div>
          </div>
        </div>

        <div class="card connection-card">
          <div class="card-header">
            <h2>接続ステータス</h2>
            <div class="status-dot" :class="{ online: store.isApiAvailable }"></div>
          </div>
          
          <!-- Developer Toggle -->
          <div class="dev-toggle-row">
            <label class="toggle-container">
              <input type="checkbox" v-model="store.isDevOverride" />
              <span class="toggle-slider"></span>
              <span class="toggle-label">開発者モード (Local)</span>
            </label>
          </div>

          <div class="status-content-inline">
            <span class="status-text" :class="{ online: store.isApiAvailable }">
              {{ store.isApiAvailable ? 'ONLINE (Accessible)' : 'OFFLINE (Unavailable)' }}
            </span>
            <button class="btn-refresh-small" @click="store.checkConnection">
              <RefreshCw :size="12" />
            </button>
          </div>
        </div>

        <div class="card status-card" v-if="store.hasChunks">
          <div class="card-header">
            <h2>ステータス概要</h2>
          </div>
          <div class="status-content">
            <div class="status-stat">
              <span class="label">Total Chunks</span>
              <span class="value">{{ store.chunks.length }}</span>
            </div>
            <div class="status-stat">
              <span class="label">Completed</span>
              <span class="value success">{{store.chunks.filter(c => c.status === 'success').length}}</span>
            </div>
          </div>
        </div>
      </aside>

      <!-- Main: Chunk List View -->
      <section class="response-area">
        <div class="card full-height">
          <div class="card-header space-between">
            <h2>チャンク一覧</h2>
            <button class="btn-refresh" @click="clearResults" v-if="store.hasChunks">
              <Trash2 :size="14" /> クリア
            </button>
          </div>

          <!-- Error Panel -->
          <div class="error-panel" v-if="errorMsg">
            <AlertCircle :size="20" />
            <div class="error-text">{{ errorMsg }}</div>
          </div>

          <!-- Chunks List -->
          <div class="chunks-container" v-if="store.hasChunks">
            <div v-for="(chunk, idx) in store.chunks" :key="idx" class="chunk-item"
              :style="{ backgroundColor: getStatusColor(chunk.status) }">
              <div class="chunk-header">
                <div class="chunk-info">
                  <span class="chunk-id">Chunk #{{ chunk.chunkId }}</span>
                  <span class="chunk-size">{{ chunk.data.length }} chars</span>
                  <span class="chunk-status-badge" :class="chunk.status">{{ chunk.status }}</span>
                </div>
                <button class="btn-process-small" @click="processChunk(idx)" :disabled="isRequesting">
                  <Loader2 v-if="isRequesting && chunk.status === 'pending'" :size="14" class="spin" />
                  <RefreshCw v-else :size="14" />
                </button>
              </div>
              <div class="chunk-body">
                <div class="data-preview">
                  <label>Data:</label>
                  <pre>{{ chunk.data.substring(0, 150) }}...</pre>
                </div>
                <div class="response-preview" v-if="chunk.response">
                  <label>Response:</label>
                  <pre>{{ chunk.response }}</pre>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div class="empty-state" v-else>
            <Cloud :size="48" class="empty-icon" />
            <p v-if="!store.hasUnits">まずは Parser タブでファイルを読み込んでください</p>
            <p v-else>「チャンク作成」ボタンを押してデータを分割してください</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.api-view {
  padding: 24px;
}

.api-layout {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 24px;
}

@media (max-width: 1000px) {
  .api-layout {
    grid-template-columns: 1fr;
  }
}

.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  transition: var(--transition);
  overflow: hidden;
}

.card:hover {
  border-color: var(--border-hover);
}

.full-height {
  min-height: calc(100vh - 140px);
}

.card-header {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.02);
}

.card-header.space-between {
  justify-content: space-between;
}

.card-header h2 {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: sticky;
  top: 84px;
  align-self: start;
}

/* Config */
.config-section {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.config-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.radio-group {
  display: flex;
  gap: 6px;
}

.radio-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: var(--transition);
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.radio-item input {
  display: none;
}

.radio-item.active {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-glow);
}

.source-tabs {
  display: flex;
  gap: 4px;
  background: var(--bg-primary);
  border-radius: var(--radius-xs);
  padding: 3px;
}

.source-tab {
  flex: 1;
  padding: 6px;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
}

.source-tab.active {
  color: var(--accent);
  background: var(--accent-glow);
}

.prompt-textarea {
  width: 100%;
  padding: 12px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 0.85rem;
  min-height: 80px;
  resize: vertical;
}

.button-row {
  display: flex;
  gap: 10px;
}

.btn-action {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border-radius: var(--radius-sm);
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: var(--transition);
}

.btn-action.primary {
  background: var(--accent);
  color: #fff;
  border: none;
}

.btn-action.secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border);
}

.btn-action:hover:not(:disabled) {
  transform: translateY(-1px);
}

.btn-action:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* Status Card */
.status-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-stat .label {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.status-stat .value {
  font-weight: 700;
  font-family: 'Inter', monospace;
}

.status-stat .value.success {
  color: var(--success);
}

/* Connection Status */
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff4d4f; /* Default offline */
  transition: var(--transition);
}

.status-dot.online {
  background: var(--success);
  box-shadow: 0 0 8px var(--success);
}

.status-content-inline {
  padding: 12px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(0, 0, 0, 0.1);
}

.status-text {
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--text-muted);
  text-transform: uppercase;
}

.status-text.online {
  color: var(--success);
}

.btn-refresh-small {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}

.btn-refresh-small:hover {
  color: var(--accent);
  transform: rotate(90deg);
}

/* Chunks Container */
.chunks-container {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chunk-item {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  transition: var(--transition);
  padding: 16px;
}

.chunk-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.chunk-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chunk-id {
  font-weight: 700;
  font-size: 0.85rem;
}

.chunk-size {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.chunk-status-badge {
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 100px;
  background: var(--bg-secondary);
}

.chunk-status-badge.success {
  background: var(--success);
  color: #fff;
}

.chunk-status-badge.error {
  background: var(--error);
  color: #fff;
}

.chunk-status-badge.pending {
  background: var(--warning);
  color: #000;
}

.btn-process-small {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  cursor: pointer;
  transition: var(--transition);
}

.btn-process-small:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.chunk-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.data-preview,
.response-preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.data-preview label,
.response-preview label {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
}

pre {
  margin: 0;
  background: rgba(0, 0, 0, 0.2);
  padding: 10px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-family: 'Inter', monospace;
  white-space: pre-wrap;
  word-break: break-all;
}

.response-preview pre {
  border-left: 2px solid var(--success);
  background: rgba(var(--success-rgb), 0.05);
}

/* Globals */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.error-panel {
  margin: 20px;
  padding: 16px;
  background: rgba(var(--error-rgb), 0.1);
  border: 1px solid var(--error);
  border-radius: var(--radius-sm);
  display: flex;
  gap: 12px;
  color: var(--error);
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--text-muted);
  padding: 80px 20px;
}

.empty-icon {
  opacity: 0.2;
}

.dev-badge {
  font-size: 0.6rem;
  background: var(--warning);
  color: #000;
  font-weight: 800;
}

/* Developer Toggle */
.dev-toggle-row {
  padding: 10px 20px;
  background: rgba(var(--warning-rgb), 0.03);
  border-bottom: 1px solid var(--border);
}

.toggle-container {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.toggle-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.toggle-container input {
  display: none;
}

.toggle-slider {
  position: relative;
  width: 32px;
  height: 18px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 20px;
  transition: var(--transition);
}

.toggle-slider::before {
  content: "";
  position: absolute;
  width: 12px;
  height: 12px;
  left: 2px;
  bottom: 2px;
  background: var(--text-muted);
  border-radius: 50%;
  transition: var(--transition);
}

input:checked + .toggle-slider {
  background: var(--warning);
  border-color: var(--warning);
}

input:checked + .toggle-slider::before {
  transform: translateX(14px);
  background: #000;
}
</style>
