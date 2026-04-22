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
import { useShwvStore } from '../stores/shwvStore'
import { SheepShuttle } from '../../logic/shuttle/sheepShuttle.js'

const store = useShwvStore()

const modes = [
  { id: 'sync', name: 'Sync' },
  { id: 'async', name: 'Async' }
]
const mode = ref('sync')

const sources = [
  { id: 'internal', name: 'Internal ShWvData' },
  { id: 'custom', name: 'Custom JSONL' }
]
const source = ref('internal')
const customJsonl = ref('')

const isRequesting = ref(false)
const pollingStatus = ref<string>('')
const response = ref<any>(null)
const errorMsg = ref<string>('')
const taskId = ref<string>('')

const canSend = computed(() => {
  if (source.value === 'internal') return store.hasData
  return customJsonl.value.trim().length > 0
})

const lineCount = computed(() => {
  if (source.value === 'internal' && store.data) {
    return store.data.body.units.length
  }
  return customJsonl.value.split('\n').filter(l => l.trim()).length
})

function clearResults() {
  response.value = null
  errorMsg.value = ''
  taskId.value = ''
  pollingStatus.value = ''
}

async function sendRequest() {
  if (!canSend.value) return
  
  clearResults()
  isRequesting.value = true

  try {
    let payload = ''
    if (source.value === 'internal' && store.data) {
      payload = SheepShuttle.getJsonlContent(store.data.body.units)
    } else {
      payload = customJsonl.value
    }

    // This is a stub for real API interaction.
    // In a real app, you would use $fetch or similar.
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    if (mode.value === 'sync') {
      response.value = {
        status: 'completed',
        results: payload.split('\n').map(line => {
          try {
            const parsed = JSON.parse(line)
            return { ...parsed, translated: true }
          } catch { return line }
        })
      }
    } else {
      taskId.value = 'task_' + Math.random().toString(36).substring(7)
      startPolling()
    }

  } catch (e: any) {
    errorMsg.value = e.message || 'リクエストに失敗しました'
  } finally {
    if (mode.value === 'sync') isRequesting.value = false
  }
}

async function startPolling() {
  pollingStatus.value = 'pending'
  let count = 0
  const timer = setInterval(() => {
    count++
    if (count === 1) pollingStatus.value = 'processing'
    if (count === 3) {
      pollingStatus.value = 'completed'
      response.value = { 
        status: 'completed', 
        task_id: taskId.value,
        data: "Poll results would appear here" 
      }
      isRequesting.value = false
      clearInterval(timer)
    }
  }, 2000)
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
          </div>
          
          <div class="config-section">
            <div class="config-group">
              <label class="config-label">通信モード</label>
              <div class="radio-group">
                <div v-for="m in modes" :key="m.id" 
                     class="radio-item" :class="{ active: mode === m.id }"
                     @click="mode = m.id">
                  <input type="radio" :value="m.id" v-model="mode" />
                  <span>{{ m.name }}</span>
                </div>
              </div>
            </div>

            <div class="config-group">
              <label class="config-label">データソース</label>
              <div class="source-tabs">
                <button v-for="s in sources" :key="s.id"
                        class="source-tab" :class="{ active: source === s.id }"
                        @click="source = s.id">
                  {{ s.name }}
                </button>
              </div>
            </div>

            <!-- Custom Input -->
            <div class="config-group" v-if="source === 'custom'">
              <label class="config-label">
                Custom JSONL Input
                <span class="line-count" v-if="lineCount > 0">{{ lineCount }} lines</span>
              </label>
              <textarea v-model="customJsonl" class="jsonl-textarea" 
                        placeholder='{"src": "Hello", "tgt": ""}'></textarea>
            </div>

            <!-- Internal Status -->
            <div class="config-group" v-else>
              <label class="config-label">Internal Status</label>
              <div class="payload-preview">
                <div v-if="store.hasData">
                  <p class="status-ok">READY: {{ store.fileName }}</p>
                  <p class="status-count">{{ lineCount }} segments available</p>
                </div>
                <div v-else class="status-empty">
                  ShWvData が読み込まれていません
                </div>
              </div>
            </div>

            <button class="btn-send" @click="sendRequest" :disabled="!canSend || isRequesting">
              <Send :size="18" v-if="!isRequesting" />
              <Loader2 :size="18" v-else class="spin" />
              {{ isRequesting ? '通信中...' : 'リクエスト送信' }}
            </button>
          </div>
        </div>
      </aside>

      <!-- Main: Response View -->
      <section class="response-area">
        <div class="card full-height">
          <div class="card-header space-between">
            <h2>API レスポンス</h2>
            <button class="btn-refresh" @click="clearResults" v-if="response || errorMsg">
              <Trash2 :size="14" /> クリア
            </button>
          </div>

          <!-- Polling Header -->
          <div class="polling-bar" v-if="taskId && isRequesting">
            <span class="polling-label">Task ID:</span>
            <span class="task-id">{{ taskId }}</span>
            <span class="polling-status" :class="pollingStatus">{{ pollingStatus }}</span>
          </div>

          <!-- Error Panel -->
          <div class="error-panel" v-if="errorMsg">
            <AlertCircle :size="20" />
            <div class="error-text">{{ errorMsg }}</div>
          </div>

          <!-- Response Body -->
          <div class="response-content" v-if="response">
            <div class="response-header">
              <span class="response-status completed">STATUS: {{ response.status }}</span>
            </div>
            <div class="response-body">
              <h3>Content</h3>
              <pre class="result-pre">{{ JSON.stringify(response, null, 2) }}</pre>
            </div>
          </div>

          <!-- Empty State -->
          <div class="empty-state" v-if="!response && !errorMsg && !isRequesting">
            <Cloud :size="48" class="empty-icon" />
            <p>リクエストを送信するとレスポンスが表示されます</p>
          </div>

          <!-- Loading -->
          <div class="empty-state" v-if="isRequesting && !response">
            <Loader2 :size="40" class="spin empty-icon" />
            <p>{{ mode === 'async' ? `ポーリング中... (${pollingStatus})` : 'リクエスト送信中...' }}</p>
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

@media (max-width: 900px) {
  .api-layout { grid-template-columns: 1fr; }
}

.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  transition: var(--transition);
}

.card:hover { border-color: var(--border-hover); }
.full-height { min-height: calc(100vh - 140px); }

.card-header {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-header.space-between { justify-content: space-between; }

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
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.config-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.config-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 8px;
}

.line-count {
  font-size: 0.65rem;
  color: var(--accent);
  font-weight: 600;
  text-transform: none;
}

.radio-group {
  display: flex;
  gap: 6px;
}

.radio-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: var(--transition);
  font-size: 0.78rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.radio-item input { display: none; }

.radio-item:hover {
  border-color: var(--border-hover);
  color: var(--text-primary);
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
  padding: 6px 10px;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
  font-family: 'Inter', sans-serif;
}

.source-tab:hover:not(:disabled) {
  color: var(--text-secondary);
  background: var(--bg-hover);
}

.source-tab.active {
  color: var(--accent);
  background: var(--accent-glow);
}

.source-tab:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.jsonl-textarea {
  width: 100%;
  padding: 12px 14px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: 'Inter', monospace;
  font-size: 0.78rem;
  line-height: 1.6;
  resize: vertical;
  min-height: 120px;
}

.jsonl-textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.jsonl-textarea::placeholder {
  color: var(--text-muted);
}

.status-ok { color: var(--success); font-weight: 600; font-size: 0.8rem; margin: 0; }
.status-count { color: var(--text-muted); font-size: 0.7rem; margin: 4px 0 0; }
.status-empty { color: var(--text-muted); font-size: 0.78rem; font-style: italic; }

.payload-preview {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
}

.btn-send {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: var(--transition);
  font-family: 'Inter', sans-serif;
}

.btn-send:hover:not(:disabled) {
  background: var(--accent-hover);
  box-shadow: var(--shadow-glow);
}

.btn-send:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.btn-refresh {
  display: flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 4px 12px;
  border-radius: var(--radius-xs);
  font-size: 0.72rem;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  transition: var(--transition);
}

.btn-refresh:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* Polling Bar */
.polling-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
}

.polling-label { font-size: 0.72rem; font-weight: 700; color: var(--text-muted); }
.task-id { font-family: 'Inter', monospace; font-size: 0.72rem; color: var(--accent); }

.polling-status {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
}
.polling-status.pending { background: #555; color: #fff; }
.polling-status.processing { background: var(--warning); color: #000; }
.polling-status.completed { background: var(--success); color: #fff; }

/* Empty state */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  gap: 16px;
  padding: 80px 20px;
}

.empty-icon { opacity: 0.15; }
.empty-state p { font-size: 0.88rem; }

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.result-pre {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  padding: 16px;
  border-radius: var(--radius-sm);
  font-family: 'Inter', monospace;
  font-size: 0.75rem;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-primary);
}
</style>
