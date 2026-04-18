<script setup lang="ts">
import { ref, computed } from 'vue'
import { FileUp, Download, Scissors, Merge, FileText, FileJson, Trash2 } from 'lucide-vue-next'
import { useShwvStore } from '@/stores/shwvStore'
import { SheepShuttle } from '@/logic/sheepShuttle'
import { FileIO } from '@/utils/fileIO'
import JsonViewer from '@/components/JsonViewer.vue'

const store = useShwvStore()
const fileInput = ref<HTMLInputElement | null>(null)
const isProcessing = ref(false)
const statusMsg = ref({ text: '', type: 'info' as 'info' | 'success' | 'error' })
const splitLength = ref(2000)
const chunkLength = ref(2000)

// JSONL update
const jsonlInput = ref<HTMLInputElement | null>(null)

const hasData = computed(() => store.hasData)

const handleFileDrop = async (e: DragEvent) => {
  e.preventDefault()
  const file = e.dataTransfer?.files[0]
  if (file) await loadFile(file)
}

const handleFileSelect = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) await loadFile(file)
}

async function loadFile(file: File) {
  try {
    isProcessing.value = true
    statusMsg.value = { text: '読み込み中...', type: 'info' }
    await store.loadFromFile(file)
    statusMsg.value = { text: `読み込み完了: ${store.unitCount} units`, type: 'success' }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    statusMsg.value = { text: `エラー: ${msg}`, type: 'error' }
  } finally {
    isProcessing.value = false
  }
}

// --- Export Actions ---
function doExportJson() {
  if (!store.data) return
  const pairs = SheepShuttle.exportToJson(store.data)
  FileIO.downloadJson(pairs, 'export.json')
  statusMsg.value = { text: 'JSON をダウンロードしました', type: 'success' }
}

function doExportCsv() {
  if (!store.data) return
  const csv = SheepShuttle.exportToCsv(store.data)
  FileIO.downloadCsv(csv, 'export.csv')
  statusMsg.value = { text: 'CSV をダウンロードしました', type: 'success' }
}

function doExportTm() {
  if (!store.data) return
  const tm = SheepShuttle.exportAsTm(store.data)
  FileIO.downloadJson(tm, 'export_tm.json')
  statusMsg.value = { text: 'TM をダウンロードしました', type: 'success' }
}

function doExportTb() {
  if (!store.data) return
  const tb = SheepShuttle.exportAsTb(store.data)
  FileIO.downloadJson(tb, 'export_tb.json')
  statusMsg.value = { text: 'TB をダウンロードしました', type: 'success' }
}

function doSplitByFile() {
  if (!store.data) return
  const result = SheepShuttle.splitByFile(store.data)
  result.forEach((pairs, name) => {
    FileIO.downloadJson(pairs, name)
  })
  statusMsg.value = { text: `${result.size} ファイルに分割しました`, type: 'success' }
}

function doSplitByLength() {
  if (!store.data) return
  const chunks = SheepShuttle.splitByLength(store.data, splitLength.value)
  chunks.forEach((chunk, i) => {
    FileIO.downloadJson(chunk, `chunk_${String(i).padStart(3, '0')}.json`)
  })
  statusMsg.value = { text: `${chunks.length} チャンクに分割しました`, type: 'success' }
}

function doExportJsonl() {
  if (!store.data) return
  const jsonl = SheepShuttle.exportToJsonl(store.data)
  FileIO.download(jsonl, 'export.jsonl', 'application/jsonl')
  statusMsg.value = { text: 'JSONL をダウンロードしました', type: 'success' }
}

function doChunkJsonl() {
  if (!store.data) return
  const jsonl = SheepShuttle.chunkJsonl(store.data, chunkLength.value)
  FileIO.download(jsonl, 'chunked.jsonl', 'application/jsonl')
  statusMsg.value = { text: 'Chunked JSONL をダウンロードしました', type: 'success' }
}

async function doUpdateFromJsonl(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || !store.data) return

  try {
    const content = await file.text()
    const updatedUnits = SheepShuttle.updateFromJsonl(store.data, content)
    const newData = structuredClone(store.data)
    newData.body.units = updatedUnits
    store.setData(newData, store.fileName)
    statusMsg.value = { text: `JSONL から更新しました (${updatedUnits.length} units)`, type: 'success' }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    statusMsg.value = { text: `更新エラー: ${msg}`, type: 'error' }
  }
}
</script>

<template>
  <div class="shuttle-view">
    <div class="shuttle-layout">
      <!-- Sidebar -->
      <aside class="sidebar">
        <!-- File Input -->
        <div class="card">
          <div class="card-header">
            <FileUp :size="16" />
            <h2>ShWvData 読み込み</h2>
          </div>
          <div class="upload-section">
            <div
              class="drop-zone"
              @dragover.prevent
              @drop="handleFileDrop"
              @click="fileInput?.click()"
            >
              <input type="file" ref="fileInput" hidden accept=".json" @change="handleFileSelect" />
              <FileUp :size="28" class="drop-icon" />
              <p v-if="!hasData">ShWvData JSON をドロップ</p>
              <div v-else class="loaded-info">
                <p class="loaded-label">✓ 読み込み済み</p>
                <p class="loaded-name">{{ store.fileName }}</p>
                <p class="loaded-count">{{ store.unitCount }} units</p>
              </div>
            </div>
            <button v-if="hasData" class="btn-clear-full" @click="store.clear()">
              <Trash2 :size="14" />
              <span>クリア</span>
            </button>
          </div>
        </div>

        <!-- Actions -->
        <div class="card" :class="{ disabled: !hasData }">
          <div class="card-header">
            <Scissors :size="16" />
            <h2>変換・操作</h2>
          </div>
          <div class="action-list">
            <div class="action-group">
              <h3 class="group-title">エクスポート</h3>
              <button class="action-btn" @click="doExportJson" :disabled="!hasData">
                <FileJson :size="16" /> JSON
              </button>
              <button class="action-btn" @click="doExportCsv" :disabled="!hasData">
                <FileText :size="16" /> CSV
              </button>
              <button class="action-btn" @click="doExportTm" :disabled="!hasData">
                <Download :size="16" /> TM (JSON)
              </button>
              <button class="action-btn" @click="doExportTb" :disabled="!hasData">
                <Download :size="16" /> TB (JSON)
              </button>
            </div>

            <div class="action-group">
              <h3 class="group-title">分割</h3>
              <button class="action-btn" @click="doSplitByFile" :disabled="!hasData">
                <Scissors :size="16" /> ファイル単位
              </button>
              <div class="input-row">
                <input
                  type="number"
                  v-model.number="splitLength"
                  class="input-sm"
                  placeholder="文字数"
                />
                <button class="action-btn flex-1" @click="doSplitByLength" :disabled="!hasData">
                  <Scissors :size="16" /> 文字数分割
                </button>
              </div>
            </div>

            <div class="action-group">
              <h3 class="group-title">JSONL</h3>
              <button class="action-btn" @click="doExportJsonl" :disabled="!hasData">
                <FileText :size="16" /> JSONL 出力
              </button>
              <div class="input-row">
                <input
                  type="number"
                  v-model.number="chunkLength"
                  class="input-sm"
                  placeholder="文字数"
                />
                <button class="action-btn flex-1" @click="doChunkJsonl" :disabled="!hasData">
                  <Merge :size="16" /> Chunk JSONL
                </button>
              </div>
              <div class="input-row">
                <input
                  type="file"
                  ref="jsonlInput"
                  hidden
                  accept=".jsonl"
                  @change="doUpdateFromJsonl"
                />
                <button class="action-btn flex-1" @click="jsonlInput?.click()" :disabled="!hasData">
                  <FileUp :size="16" /> JSONL から更新
                </button>
              </div>
            </div>
          </div>

          <div class="status-msg" v-if="statusMsg.text" :class="statusMsg.type">
            {{ statusMsg.text }}
          </div>
        </div>
      </aside>

      <!-- Main content: JsonViewer -->
      <section class="viewer-area">
        <div class="card full-height">
          <div class="card-header">
            <h2>ShWvData ビューア</h2>
          </div>
          <div class="viewer-content">
            <JsonViewer v-if="hasData" :data="store.data" />
            <div class="empty-state" v-else>
              <FileJson :size="48" class="empty-icon" />
              <p>ShWvData JSON ファイルを読み込んでください</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.shuttle-view {
  padding: 24px;
}

.shuttle-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 24px;
}

@media (max-width: 900px) {
  .shuttle-layout { grid-template-columns: 1fr; }
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
.card.disabled { opacity: 0.5; pointer-events: none; }

.full-height { min-height: calc(100vh - 140px); }

.card-header {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 10px;
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

/* Upload */
.upload-section { padding: 16px 20px; }

.drop-zone {
  border: 2px dashed var(--border);
  border-radius: var(--radius-sm);
  padding: 24px;
  text-align: center;
  cursor: pointer;
  transition: var(--transition);
  color: var(--text-secondary);
}

.drop-zone:hover {
  border-color: var(--accent);
  background: var(--accent-glow);
}

.drop-icon { margin-bottom: 6px; opacity: 0.5; }
.drop-zone p { font-size: 0.8rem; }

.loaded-info { text-align: center; }
.loaded-label { color: var(--success); font-weight: 700; font-size: 0.85rem; }
.loaded-name { color: var(--text-secondary); font-size: 0.75rem; margin-top: 2px; }
.loaded-count { color: var(--accent); font-size: 0.72rem; font-weight: 600; margin-top: 2px; }

.btn-clear-full {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 10px;
  width: 100%;
  padding: 6px;
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  color: var(--error);
  font-size: 0.75rem;
  cursor: pointer;
  transition: var(--transition);
  font-family: 'Inter', sans-serif;
}

.btn-clear-full:hover {
  background: rgba(239, 68, 68, 0.08);
  border-color: var(--error);
}

/* Action List */
.action-list {
  padding: 12px 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.action-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.group-title {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  margin-bottom: 2px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
  font-family: 'Inter', sans-serif;
}

.action-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-glow);
}

.action-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.input-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.input-sm {
  width: 80px;
  padding: 7px 10px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  color: var(--text-primary);
  font-size: 0.78rem;
  font-family: 'Inter', monospace;
}

.input-sm:focus {
  outline: none;
  border-color: var(--accent);
}

.flex-1 { flex: 1; }

/* Status */
.status-msg {
  margin: 0 20px 16px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
  font-weight: 500;
}
.status-msg.info { background: var(--bg-hover); color: var(--text-primary); }
.status-msg.success { background: rgba(16, 185, 129, 0.1); color: var(--success); }
.status-msg.error { background: rgba(239, 68, 68, 0.1); color: var(--error); }

/* Viewer */
.viewer-area { min-width: 0; }
.viewer-content { padding: 20px; flex: 1; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: var(--text-muted);
  gap: 16px;
}

.empty-icon { opacity: 0.15; }
.empty-state p { font-size: 0.88rem; }
</style>
