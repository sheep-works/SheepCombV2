<script setup lang="ts">
import { ref, computed } from 'vue'
import { Cloud, Send, Loader2, CheckCircle, AlertCircle, Clock, RefreshCw } from 'lucide-vue-next'
import { useParserStore } from '@/stores/parserStore'
import { useShwvStore } from '@/stores/shwvStore'
import { getApi, type ResultResponse } from '@/utils/api'
import { SheepShuttle } from '@/logic/sheepShuttle'
import type { Segment } from '@/logic/parsers'

type Endpoint = 'check' | 'trans'
type Mode = 'sync' | 'async'

const parserStore = useParserStore()
const shwvStore = useShwvStore()
const api = getApi()

const endpoint = ref<Endpoint>('check')
const mode = ref<Mode>('sync')
const isRequesting = ref(false)
const response = ref<ResultResponse | null>(null)
const errorMsg = ref('')
const taskId = ref('')
const pollingStatus = ref('')
const customJsonl = ref('')
const dataSource = ref<'parser' | 'shuttle' | 'custom'>('custom')

// Build JSONL from different sources
const buildJsonl = computed((): string => {
  if (dataSource.value === 'custom') {
    return customJsonl.value
  }
  if (dataSource.value === 'parser' && parserStore.hasSegments) {
    return parserStore.segments
      .map((s: Segment) => JSON.stringify({ src: s.src, tgt: s.tgt }))
      .join('\n')
  }
  if (dataSource.value === 'shuttle' && shwvStore.hasData && shwvStore.data) {
    return SheepShuttle.exportToJsonl(shwvStore.data)
  }
  return ''
})

const hasPayload = computed(() => buildJsonl.value.trim().length > 0)
const lineCount = computed(() => {
  const val = buildJsonl.value.trim()
  return val ? val.split('\n').length : 0
})

async function sendRequest() {
  if (!hasPayload.value) return

  isRequesting.value = true
  response.value = null
  errorMsg.value = ''
  taskId.value = ''
  pollingStatus.value = ''

  try {
    const jsonl = buildJsonl.value

    if (mode.value === 'sync') {
      // Synchronous request
      const result = endpoint.value === 'check'
        ? await api.checkDefaultSync(jsonl)
        : await api.transDefaultSync(jsonl)
      response.value = result
    } else {
      // Async request → poll
      const taskResp = endpoint.value === 'check'
        ? await api.checkDefault(jsonl)
        : await api.transDefault(jsonl)

      taskId.value = taskResp.task_id
      pollingStatus.value = taskResp.status

      const result = await api.pollTask(taskResp.task_id, 2000, 60, (r) => {
        pollingStatus.value = r.status
      })

      response.value = result
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    errorMsg.value = msg
  } finally {
    isRequesting.value = false
  }
}

async function refreshTask() {
  if (!taskId.value) return

  try {
    const result = await api.getTaskResult(taskId.value)
    response.value = result
    pollingStatus.value = result.status
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    errorMsg.value = msg
  }
}
</script>

<template>
  <div class="api-view">
    <div class="api-layout">
      <!-- Left: Request Config -->
      <aside class="sidebar">
        <div class="card">
          <div class="card-header">
            <Cloud :size="16" />
            <h2>API リクエスト</h2>
          </div>

          <div class="config-section">
            <!-- Endpoint Selection -->
            <div class="config-group">
              <label class="config-label">エンドポイント</label>
              <div class="radio-group">
                <label class="radio-item" :class="{ active: endpoint === 'check' }">
                  <input type="radio" v-model="endpoint" value="check" />
                  <CheckCircle :size="14" />
                  <span>check/default</span>
                </label>
                <label class="radio-item" :class="{ active: endpoint === 'trans' }">
                  <input type="radio" v-model="endpoint" value="trans" />
                  <Send :size="14" />
                  <span>trans/default</span>
                </label>
              </div>
            </div>

            <!-- Mode Selection -->
            <div class="config-group">
              <label class="config-label">モード</label>
              <div class="radio-group">
                <label class="radio-item" :class="{ active: mode === 'sync' }">
                  <input type="radio" v-model="mode" value="sync" />
                  <Clock :size="14" />
                  <span>同期</span>
                </label>
                <label class="radio-item" :class="{ active: mode === 'async' }">
                  <input type="radio" v-model="mode" value="async" />
                  <RefreshCw :size="14" />
                  <span>非同期</span>
                </label>
              </div>
            </div>

            <!-- Data Source -->
            <div class="config-group">
              <label class="config-label">データソース</label>
              <div class="source-tabs">
                <button
                  class="source-tab"
                  :class="{ active: dataSource === 'custom' }"
                  @click="dataSource = 'custom'"
                >手動入力</button>
                <button
                  class="source-tab"
                  :class="{ active: dataSource === 'parser', disabled: !parserStore.hasSegments }"
                  @click="dataSource = 'parser'"
                  :disabled="!parserStore.hasSegments"
                >パーサー</button>
                <button
                  class="source-tab"
                  :class="{ active: dataSource === 'shuttle', disabled: !shwvStore.hasData }"
                  @click="dataSource = 'shuttle'"
                  :disabled="!shwvStore.hasData"
                >Shuttle</button>
              </div>
            </div>

            <!-- JSONL Input -->
            <div class="config-group" v-if="dataSource === 'custom'">
              <label class="config-label">
                JSONL ペイロード
                <span class="line-count" v-if="lineCount > 0">{{ lineCount }} lines</span>
              </label>
              <textarea
                v-model="customJsonl"
                class="jsonl-textarea"
                rows="10"
                placeholder='{"src": "こんにちは", "tgt": "Hello"}'
              ></textarea>
            </div>

            <!-- Auto-generated payload preview -->
            <div class="config-group" v-else>
              <label class="config-label">
                自動生成ペイロード
                <span class="line-count" v-if="lineCount > 0">{{ lineCount }} lines</span>
              </label>
              <div class="payload-preview">
                <pre>{{ buildJsonl.substring(0, 500) }}{{ buildJsonl.length > 500 ? '\n...' : '' }}</pre>
              </div>
            </div>

            <!-- Send Button -->
            <button
              class="btn-send"
              @click="sendRequest"
              :disabled="!hasPayload || isRequesting"
            >
              <Loader2 v-if="isRequesting" :size="18" class="spin" />
              <Send v-else :size="18" />
              <span>{{ isRequesting ? '送信中...' : 'リクエスト送信' }}</span>
            </button>
          </div>
        </div>
      </aside>

      <!-- Right: Response -->
      <section class="response-area">
        <div class="card full-height">
          <div class="card-header space-between">
            <h2>レスポンス</h2>
            <button
              v-if="taskId"
              class="btn-refresh"
              @click="refreshTask"
            >
              <RefreshCw :size="14" />
              Refresh
            </button>
          </div>

          <!-- Polling Status -->
          <div class="polling-bar" v-if="taskId">
            <span class="polling-label">Task:</span>
            <code class="task-id">{{ taskId }}</code>
            <span class="polling-status" :class="pollingStatus">{{ pollingStatus }}</span>
          </div>

          <!-- Error -->
          <div class="error-panel" v-if="errorMsg">
            <AlertCircle :size="16" />
            <span>{{ errorMsg }}</span>
          </div>

          <!-- Response Content -->
          <div class="response-content" v-if="response">
            <div class="response-status" :class="response.status">
              Status: {{ response.status }}
            </div>

            <div class="response-body" v-if="response.result">
              <h3>Result</h3>
              <pre class="result-pre">{{ response.result }}</pre>
            </div>

            <div class="response-body error-body" v-if="response.error">
              <h3>Error</h3>
              <pre class="result-pre">{{ response.error }}</pre>
            </div>
          </div>

          <!-- Empty State -->
          <div class="empty-state" v-if="!response && !errorMsg && !isRequesting">
            <Cloud :size="48" class="empty-icon" />
            <p>リクエストを送信するとレスポンスがここに表示されます</p>
          </div>

          <!-- Loading -->
          <div class="empty-state" v-if="isRequesting && !response">
            <Loader2 :size="40" class="spin empty-icon" />
            <p>{{ mode === 'async' ? `ポーリング中... (${pollingStatus})` : 'リクエスト処理中...' }}</p>
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

.payload-preview {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  max-height: 200px;
  overflow-y: auto;
}

.payload-preview pre {
  font-size: 0.72rem;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  font-family: 'Inter', monospace;
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

/* Polling */
.polling-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-hover);
  font-size: 0.78rem;
}

.polling-label {
  color: var(--text-muted);
  font-weight: 600;
}

.task-id {
  font-size: 0.72rem;
  padding: 2px 8px;
  background: var(--bg-primary);
  border-radius: 4px;
  color: var(--text-secondary);
  font-family: 'Inter', monospace;
}

.polling-status {
  padding: 2px 10px;
  border-radius: var(--radius-full);
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
}

.polling-status.pending,
.polling-status.processing {
  background: rgba(245, 158, 11, 0.15);
  color: var(--warning);
}

.polling-status.completed {
  background: rgba(16, 185, 129, 0.15);
  color: var(--success);
}

.polling-status.failed {
  background: rgba(239, 68, 68, 0.15);
  color: var(--error);
}

/* Error */
.error-panel {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 20px;
  background: rgba(239, 68, 68, 0.08);
  border-bottom: 1px solid rgba(239, 68, 68, 0.2);
  color: var(--error);
  font-size: 0.82rem;
}

/* Response */
.response-content {
  padding: 20px;
  flex: 1;
}

.response-status {
  padding: 8px 14px;
  border-radius: var(--radius-xs);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  margin-bottom: 16px;
}

.response-status.completed {
  background: rgba(16, 185, 129, 0.1);
  color: var(--success);
}

.response-status.failed {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error);
}

.response-body h3 {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.result-pre {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 16px;
  font-size: 0.78rem;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 500px;
  overflow-y: auto;
  font-family: 'Inter', monospace;
  margin: 0;
}

.error-body .result-pre {
  border-color: rgba(239, 68, 68, 0.2);
}

/* Empty */
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
</style>
