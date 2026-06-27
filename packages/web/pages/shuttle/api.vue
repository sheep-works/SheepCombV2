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
import { Send, Cloud, Loader2, AlertCircle, RefreshCw, Trash2, Download, Upload, RotateCcw } from 'lucide-vue-next'
// Note: Using relative paths instead of Nuxt aliases (~~, ~, @) to ensure stable resolution.
import { useShuttleStore } from '../../stores/shuttleStore'
import { useI18n } from 'vue-i18n'
import type { ChunkOptions } from '@sheep-family/types'
import defaultCheckPromptText from '../../prompts/default.md?raw'
import defaultTransPromptText from '../../prompts/default-translation.md?raw'

const store = useShuttleStore()
const { t } = useI18n()

onMounted(async () => {
  store.provider = 'honox-local'
  await store.checkConnection()
})

const modes = [
  { id: 'units', name: 'Raw Units' },
  { id: 'data', name: 'ShWvData' },
  { id: 'similarity', name: 'Similarity' }
]
const mode = ref('units')

const requestTargets = [
  { id: 'CHECK', name: 'Check' },
  { id: 'TRANSLATE', name: 'Translate' },
  { id: 'PROOF', name: 'Proof' },
  { id: 'CUSTOM', name: 'Custom' }
]
const requestTarget = ref<'CHECK' | 'TRANSLATE' | 'PROOF' | 'CUSTOM'>('CHECK')
const userPrompt = ref(defaultCheckPromptText)
const sourceLang = ref('英語')
const targetLang = ref('日本語')
const chunkMaxLength = ref<number>(4000)

const chunkOptions = ref<ChunkOptions>({
  src: true,
  tgt: true,
  note: true,
  history: false,
  terms: false
})

const apiTarget = computed(() => {
  return requestTarget.value === 'CUSTOM' ? 'CHECK' : requestTarget.value
})

const defaultPrompt = computed(() => {
  return requestTarget.value === 'TRANSLATE' ? defaultTransPromptText : defaultCheckPromptText
})

const isEndpointEditable = ref(false)

watch(requestTarget, (newTarget, oldTarget) => {
  const oldDefault = oldTarget === 'TRANSLATE' ? defaultTransPromptText : defaultCheckPromptText
  if (!userPrompt.value || userPrompt.value.trim() === oldDefault.trim()) {
    userPrompt.value = newTarget === 'TRANSLATE' ? defaultTransPromptText : defaultCheckPromptText
  }
  
  if (newTarget === 'TRANSLATE' && chunkMaxLength.value === 4000) {
    chunkMaxLength.value = 2500
  } else if (newTarget !== 'TRANSLATE' && chunkMaxLength.value === 2500) {
    chunkMaxLength.value = 4000
  }

  // Update default chunk options for non-custom targets
  if (newTarget === 'CHECK') {
    chunkOptions.value = { src: true, tgt: true, note: true, history: false, terms: false }
  } else if (newTarget === 'TRANSLATE') {
    chunkOptions.value = { src: true, tgt: false, note: true, history: false, terms: false }
  } else if (newTarget === 'PROOF') {
    chunkOptions.value = { src: false, tgt: true, note: false, history: false, terms: false }
  }
})

const isRequesting = ref(false)
const errorMsg = ref<string>('')

const showConfirmDialog = ref(false)
const confirmData = ref({ provider: '', model: '', url: '' })
const confirmAction = ref<(() => Promise<void>) | null>(null)

async function requestWithConfirm(action: () => Promise<void>) {
  try {
    const settings = await store.shuttle.requests.getSettings()
    confirmData.value = settings
    confirmAction.value = action
    showConfirmDialog.value = true
  } catch (e: any) {
    errorMsg.value = `Failed to get settings: ${e.message}`
  }
}

async function executeConfirmedAction() {
  showConfirmDialog.value = false
  if (confirmAction.value) {
    await confirmAction.value()
    confirmAction.value = null
  }
}

function cancelConfirmedAction() {
  showConfirmDialog.value = false
  confirmAction.value = null
}

const promptFileInput = ref<HTMLInputElement | null>(null)

function resetPrompt() {
  userPrompt.value = defaultPrompt.value
}

function triggerPromptUpload() {
  promptFileInput.value?.click()
}

function onPromptFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return

  const file = target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    if (text) {
      userPrompt.value = text
    }
    target.value = ''
  }
  reader.readAsText(file)
}

function parseChunkResponse(responseText: string) {
  if (!responseText) return [];
  const lines = responseText.split('\n'); // 空行もスキップしないようにfilterを除去
  return lines.map(line => {
    if (line.trim().length === 0) return { raw: '' }; // 空行は空文字列として扱う
    try {
      return JSON.parse(line);
    } catch (e) {
      return { raw: line };
    }
  });
}

async function createChunks() {
  try {
    store.createChunks(mode.value as 'units' | 'data' | 'similarity', chunkMaxLength.value, apiTarget.value, chunkOptions.value)
  } catch (e: any) {
    errorMsg.value = e.message
  }
}

async function processChunk(index: number) {
  // 再チェック
  const ok = await store.checkConnection()
  if (!ok) {
    errorMsg.value = t('shuttle.api.err_offline')
    return
  }

  isRequesting.value = true
  errorMsg.value = ''
  try {
    let promptToSend = userPrompt.value.trim();
    if (promptToSend) {
      promptToSend = promptToSend.replace(/{source_lang}/g, sourceLang.value).replace(/{target_lang}/g, targetLang.value);
    }
    await store.processRequests(index, apiTarget.value, promptToSend)
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
    errorMsg.value = t('shuttle.api.err_offline')
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

function exportCSV() {
  const rows: string[] = [];
  rows.push(['Index', 'Source', 'Target', 'Note', 'IssueType', 'Detail'].join(','));

  const escapeCsv = (val: any) => {
    if (val === undefined || val === null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  for (const chunk of store.chunks) {
    if (chunk.status !== 'success' || !chunk.response) continue;

    let originalData: any[] = [];
    try {
      const parsed = JSON.parse(chunk.data);
      if (Array.isArray(parsed)) originalData = parsed;
      else originalData = [parsed];
    } catch(e) {
      // fallback
    }

    const feedbackMap = new Map<string, {issueType: string, detail: string}>();
    
    // check if response is JSON with idx
    const resItems = parseChunkResponse(chunk.response);
    let isJsonResponses = false;
    for (const rItem of resItems) {
      if (rItem.idx !== undefined || rItem.Index !== undefined) {
         isJsonResponses = true;
         const idxStr = String(rItem.idx ?? rItem.Index);
         feedbackMap.set(idxStr, {
           issueType: String(rItem.issueType || rItem.IssueType || ''),
           detail: String(rItem.detail || rItem.Detail || rItem.result || rItem.raw || '')
         });
      }
    }

    if (!isJsonResponses) {
      // Parse plain text responses like "Line 0: [Error]" or "Line [0]:"
      let currentIdx: string | null = null;
      let currentFeedback: string[] = [];
      const lines = (chunk.response || '').split('\n');
      
      for (const line of lines) {
        const match = line.match(/^(?:Line|行)\s*\[?(\d+)\]?[\s:]/i);
        if (match) {
          if (currentIdx !== null) {
            feedbackMap.set(currentIdx, { issueType: '', detail: currentFeedback.join('\n').trim() });
          }
          currentIdx = match[1]!;
          currentFeedback = [line];
        } else if (currentIdx !== null) {
          currentFeedback.push(line);
        }
      }
      if (currentIdx !== null) {
        feedbackMap.set(currentIdx, { issueType: '', detail: currentFeedback.join('\n').trim() });
      }
    }

    if (originalData.length > 0) {
      for (const oItem of originalData) {
        const idxStr = String(oItem.idx ?? oItem.Index ?? '');
        const feedback = feedbackMap.get(idxStr);
        
        const idx = escapeCsv(idxStr);
        const src = escapeCsv(oItem.src ?? oItem.Source ?? '');
        const tgt = escapeCsv(oItem.tgt ?? oItem.Target ?? '');
        const note = escapeCsv(oItem.notes ?? oItem.note ?? oItem.Note ?? '');
        const issueType = escapeCsv(feedback ? feedback.issueType : '');
        const detail = escapeCsv(feedback ? feedback.detail : '');

        rows.push([idx, src, tgt, note, issueType, detail].join(','));
      }
    } else {
      // Fallback if originalData is missing
      for (const rItem of resItems) {
        const idx = escapeCsv(rItem.idx ?? rItem.Index ?? '');
        const src = escapeCsv(rItem.src ?? rItem.Source ?? '');
        const tgt = escapeCsv(rItem.tgt ?? rItem.Target ?? '');
        const note = escapeCsv(rItem.note ?? rItem.notes ?? rItem.Note ?? '');
        const issueType = escapeCsv(rItem.issueType ?? rItem.IssueType ?? '');
        const detail = escapeCsv(rItem.detail ?? rItem.Detail ?? rItem.result ?? rItem.raw ?? '');
        rows.push([idx, src, tgt, note, issueType, detail].join(','));
      }
    }
  }

  const csvContent = "\uFEFF" + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'ai_results.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportJSON() {
  const jsonContent = JSON.stringify(store.chunks, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'ai_chunks.json');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
    <!-- Confirmation Dialog -->
    <div v-if="showConfirmDialog" class="modal-overlay">
      <div class="modal">
        <h3>実行前の確認</h3>
        <p style="margin-bottom: 12px; font-size: 14px;">以下の設定でリクエストを送信します。よろしいですか？</p>
        <ul class="confirm-list">
          <li><strong>Provider:</strong> {{ confirmData.provider }}</li>
          <li><strong>Model:</strong> {{ confirmData.model }}</li>
          <li v-if="confirmData.url"><strong>URL:</strong> {{ confirmData.url }}</li>
        </ul>
        <div class="modal-actions">
          <button class="btn-outline" @click="cancelConfirmedAction">キャンセル</button>
          <button class="btn-action primary" @click="executeConfirmedAction">実行する</button>
        </div>
      </div>
    </div>

    <div class="api-layout">
      <!-- Sidebar: Request Settings -->
      <aside class="sidebar">
        <!-- LLM Provider Settings -->
        <div class="card">
          <div class="card-header">
            <h2>Provider Settings</h2>
            <span class="dev-badge" :style="{ background: store.isConnected ? 'rgba(0, 200, 100, 0.15)' : 'rgba(255, 100, 100, 0.15)', color: store.isConnected ? '#4ade80' : '#f87171', border: '1px solid ' + (store.isConnected ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)') }">
              {{ store.isConnected ? 'Connected' : 'Not Connected' }}
            </span>
          </div>
          <div class="config-section">
            <div class="config-group">
              <label class="config-label">{{ $t('shuttle.api.lbl_password') }}</label>
              <input 
                type="password" 
                v-model="store.honoxApiKey" 
                class="prompt-textarea" 
                style="min-height: 40px; padding: 8px;" 
                :placeholder="$t('shuttle.api.ph_password')" 
              />
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                <div class="status-content-inline" style="padding: 0; background: transparent; border: none;">
                  <div class="status-dot" :class="{ online: store.isApiAvailable }" style="margin-right: 6px;"></div>
                  <span class="status-text" :class="{ online: store.isApiAvailable }">
                    {{ store.isApiAvailable ? 'ONLINE' : 'OFFLINE' }}
                  </span>
                  <button class="btn-refresh-small" @click="store.checkConnection" style="margin-left: 6px;">
                    <RefreshCw :size="12" />
                  </button>
                </div>
                <NuxtLink to="/shuttle/api-tips" class="manual-link">
                  {{ $t('shuttle.api.lnk_manual') }}
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2>{{ $t('shuttle.api.title_request') }}</h2>
            <span class="dev-badge">SheepBobbin v2</span>
          </div>

          <div class="config-section">
            <div class="config-group">
              <label class="config-label">{{ $t('shuttle.api.lbl_chunk_mode') }}</label>
              <div class="radio-group">
                <div v-for="m in modes" :key="m.id" class="radio-item" :class="{ active: mode === m.id }"
                  @click="mode = m.id">
                  <input type="radio" :value="m.id" v-model="mode" />
                  <span>{{ m.name }}</span>
                </div>
              </div>
            </div>

            <div class="config-group">
              <label class="config-label">{{ $t('shuttle.api.lbl_req_type') }}</label>
              <div class="source-tabs">
                <button v-for="t in requestTargets" :key="t.id" class="source-tab"
                  :class="{ active: requestTarget === t.id }" @click="requestTarget = t.id as any">
                  {{ t.name }}
                </button>
              </div>

              <!-- Accordion for Custom keys selection -->
              <transition name="expand">
                <div v-if="requestTarget === 'CUSTOM'" class="custom-keys-selector">
                  <div class="config-sub-label">出力キーの選択 <span style="font-size: 11px; color: var(--text-muted); font-weight: normal;">(idxは常に出力されます)</span></div>
                  <div class="checkbox-row">
                    <label class="checkbox-label">
                      <input type="checkbox" v-model="chunkOptions.src" /> src
                    </label>
                    <label class="checkbox-label">
                      <input type="checkbox" v-model="chunkOptions.tgt" /> tgt
                    </label>
                    <label class="checkbox-label">
                      <input type="checkbox" v-model="chunkOptions.note" /> note
                    </label>
                    <label class="checkbox-label" :title="mode === 'units' ? 'ShWvDataからのみ抽出されます' : ''">
                      <input type="checkbox" v-model="chunkOptions.history" :disabled="mode === 'units'" /> history
                    </label>
                    <label class="checkbox-label" :title="mode === 'units' ? 'ShWvDataからのみ抽出されます' : ''">
                      <input type="checkbox" v-model="chunkOptions.terms" :disabled="mode === 'units'" /> terms
                    </label>
                  </div>
                </div>
              </transition>
            </div>

            <div class="config-group">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label class="config-label" style="margin-bottom: 0;">{{ $t('shuttle.api.lbl_prompt') }}</label>
                <div style="display: flex; gap: 4px;">
                  <button class="btn-refresh-small" @click="resetPrompt" :title="$t('shuttle.api.btn_reset_prompt')">
                    <RotateCcw :size="14" />
                  </button>
                  <button class="btn-refresh-small" @click="triggerPromptUpload" :title="$t('shuttle.api.btn_load_prompt')">
                    <Upload :size="14" />
                  </button>
                </div>
                <input type="file" ref="promptFileInput" accept=".txt,.md" style="display: none" @change="onPromptFileChange" />
              </div>
              
              <div style="display: flex; gap: 8px; margin-bottom: 8px; margin-top: 8px;">
                <input type="text" v-model="sourceLang" class="prompt-textarea" style="min-height: 36px; padding: 8px;" placeholder="原文の言語" title="source_lang" />
                <span style="display: flex; align-items: center; color: var(--text-muted);">→</span>
                <input type="text" v-model="targetLang" class="prompt-textarea" style="min-height: 36px; padding: 8px;" placeholder="訳文の言語" title="target_lang" />
              </div>

              <textarea v-model="userPrompt" class="prompt-textarea"></textarea>
            </div>

            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; margin-top: 12px;">
              <label class="config-label" style="margin-bottom: 0;">チャンクサイズ上限 (文字数):</label>
              <input type="number" v-model="chunkMaxLength" class="input-field" style="width: 100px; padding: 4px;" />
            </div>

            <div class="button-row">
              <button class="btn-action secondary" @click="createChunks" :disabled="!store.hasUnits && !store.hasData">
                <RefreshCw :size="16" /> {{ $t('shuttle.api.btn_create_chunks') }}
              </button>
              <button class="btn-action primary" @click="requestWithConfirm(processAll)" :disabled="!store.hasChunks || isRequesting">
                <Send :size="16" /> {{ $t('shuttle.api.btn_process_all') }}
              </button>
            </div>
          </div>
        </div>



        <div class="card status-card" v-if="store.hasChunks">
          <div class="card-header">
            <h2>{{ $t('shuttle.api.title_summary') }}</h2>
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
            <h2>{{ $t('shuttle.api.title_list') }}</h2>
            <div style="display: flex; gap: 8px;">
              <button class="btn-outline" @click="exportJSON" v-if="store.hasChunks">
                <Download :size="14" /> Export JSON
              </button>
              <button class="btn-outline" @click="exportCSV" v-if="store.hasChunks">
                <Download :size="14" /> {{ $t('shuttle.api.btn_export_csv') }}
              </button>
              <button class="btn-outline" @click="clearResults" v-if="store.hasChunks">
                <Trash2 :size="14" /> {{ $t('shuttle.api.btn_clear') }}
              </button>
            </div>
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
                <button class="btn-process-small" @click="requestWithConfirm(() => processChunk(idx))" :disabled="isRequesting">
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
                  <div class="response-table-wrapper">
                    <table class="response-table">
                      <thead>
                        <tr>
                          <th style="width: 40px;">Idx</th>
                          <th style="width: 25%;">Src</th>
                          <th style="width: 25%;">Tgt</th>
                          <th>Result / Feedback</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="(item, i) in parseChunkResponse(chunk.response)" :key="i">
                          <template v-if="item.src !== undefined || item.tgt !== undefined">
                            <td class="td-idx">{{ item.idx }}</td>
                            <td>{{ item.src }}</td>
                            <td>{{ item.tgt }}</td>
                            <td class="td-result">{{ item.result }}</td>
                          </template>
                          <template v-else>
                            <td colspan="4" class="td-raw">{{ item.raw || JSON.stringify(item) }}</td>
                          </template>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div class="empty-state" v-else>
            <Cloud :size="48" class="empty-icon" />
            <p v-if="!store.hasUnits">{{ $t('shuttle.api.empty_no_units') }}</p>
            <p v-else>{{ $t('shuttle.api.empty_no_chunks') }}</p>
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
  text-align: center;
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

.manual-link {
  font-size: 0.75rem;
  color: var(--accent);
  text-decoration: none;
  margin-top: 4px;
  display: inline-block;
}
.manual-link:hover {
  text-decoration: underline;
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

/* Response Table */
.response-table-wrapper {
  overflow-x: auto;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  margin-top: 4px;
}

.response-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
  text-align: left;
}

.response-table th {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-weight: 700;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.65rem;
}

.response-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  color: var(--text-primary);
  vertical-align: top;
  word-break: break-word;
}

.response-table tbody tr:last-child td {
  border-bottom: none;
}

.response-table tbody tr:nth-child(even) {
  background: rgba(255, 255, 255, 0.02);
}

.td-idx {
  font-family: 'Inter', monospace;
  color: var(--text-muted);
  font-weight: 600;
}

.td-result {
  color: var(--success);
  white-space: pre-wrap;
}

.td-raw {
  color: var(--warning);
  font-family: 'Inter', monospace;
  white-space: pre-wrap;
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

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.modal {
  background: var(--bg-primary);
  padding: 24px; border-radius: 8px; width: 400px; max-width: 90%;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  border: 1px solid var(--border);
}
.modal h3 { margin-top: 0; margin-bottom: 12px; }
.confirm-list { margin: 16px 0; padding-left: 20px; color: var(--text-secondary); line-height: 1.6; font-size: 14px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }

/* Custom Keys Selector Accordion Styles */
.custom-keys-selector {
  margin-top: 10px;
  background: var(--bg-tertiary);
  padding: 10px;
  border-radius: var(--radius-xs);
  border: 1px dashed var(--border);
}
.config-sub-label {
  font-size: 0.72rem;
  font-weight: 700;
  margin-bottom: 6px;
  color: var(--text-secondary);
}
.checkbox-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-size: 0.78rem;
  color: var(--text-secondary);
}
.checkbox-label input {
  cursor: pointer;
}
.expand-enter-active, .expand-leave-active {
  transition: all 0.25s ease-out;
  max-height: 100px;
  opacity: 1;
  overflow: hidden;
}
.expand-enter-from, .expand-leave-to {
  max-height: 0;
  opacity: 0;
  margin-top: 0;
  padding-top: 0;
  padding-bottom: 0;
}
</style>
