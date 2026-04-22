<script setup lang="ts">
definePageMeta({
  title: 'Shuttle Manage',
  icon: 'settings',
})
import { ref, computed } from 'vue'
import { FileUp, Download, Scissors, Merge, FileText, FileJson, Trash2, Settings2 } from 'lucide-vue-next'
// Note: Using relative paths instead of Nuxt aliases (~~, ~, @) to ensure stable resolution.
import { useShwvStore } from '../stores/shwvStore'
import { SheepShuttle } from '../../logic/shuttle/sheepShuttle.js'
import { FileIO } from '../utils/fileIO'
import JsonViewer from '../components/JsonViewer.vue'


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
    statusMsg.value = { text: `読み取り完了: ${store.unitCount} segments`, type: 'success' }
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
  FileIO.download(jsonl, 'export.jsonl')
  statusMsg.value = { text: 'JSONL を出力しました', type: 'success' }
}

function doChunkJsonl() {
  if (!store.data) return
  const chunkedJsonl = SheepShuttle.chunkJsonl(store.data, chunkLength.value)
  FileIO.download(chunkedJsonl, 'chunked.jsonl')
  statusMsg.value = { text: '分割 JSONL を出力しました', type: 'success' }
}

async function doUpdateFromJsonl(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || !store.data) return

  try {
    const text = await file.text()
    const updated = SheepShuttle.updateFromJsonl(store.data, text)
    store.data.body.units = updated
    statusMsg.value = { text: 'JSONL から更新しました', type: 'success' }
  } catch (e: any) {
    statusMsg.value = { text: `更新エラー: ${e.message}`, type: 'error' }
  }
}

function doClear() {
  store.clear()
  statusMsg.value = { text: 'データをクリアしました', type: 'info' }
}
</script>

<template>
  <div class="manage-view">
    <div class="shuttle-layout">
      <!-- Sidebar: Actions -->
      <aside class="sidebar">
        <!-- Loader Card -->
        <div class="card upload-section">
          <div class="card-header">
            <h2>ShWvData 読み込み</h2>
          </div>
          <div v-if="!hasData" class="drop-zone" @drop="handleFileDrop" @dragover.prevent @click="fileInput?.click()">
            <FileUp :size="24" class="drop-icon" />
            <p>ShWvData (.json) をドロップ</p>
            <input type="file" ref="fileInput" hidden accept=".json" @change="handleFileSelect" />
          </div>
          <div v-else class="loaded-info">
            <div class="loaded-label">ACTIVE DATA</div>
            <div class="loaded-name">{{ store.fileName }}</div>
            <div class="loaded-count">{{ store.unitCount }} Segments</div>
            <button class="btn-clear-full" @click="doClear">
              <Trash2 :size="14" /> クリア
            </button>
          </div>
        </div>

        <!-- Action Card -->
        <div class="card" :class="{ disabled: !hasData }">
          <div class="card-header">
            <Settings2 :size="18" />
            <h2>データ操作・変換</h2>
          </div>
          <div class="action-list">
            <div class="action-group">
              <h3 class="group-title">エクスポート</h3>
              <div class="action-grid">
                <button class="action-btn" @click="doExportJson" :disabled="!hasData">
                  <FileJson :size="16" /> JSON
                </button>
                <button class="action-btn" @click="doExportCsv" :disabled="!hasData">
                  <FileText :size="16" /> CSV
                </button>
                <button class="action-btn" @click="doExportTm" :disabled="!hasData">
                  <Download :size="16" /> TM
                </button>
                <button class="action-btn" @click="doExportTb" :disabled="!hasData">
                  <Download :size="16" /> TB
                </button>
              </div>
            </div>

            <div class="action-group">
              <h3 class="group-title">分割・チャンク化</h3>
              <button class="action-btn" @click="doSplitByFile" :disabled="!hasData">
                <Scissors :size="16" /> ファイル単位で分割
              </button>
              <div class="input-row">
                <input type="number" v-model.number="splitLength" class="input-sm" placeholder="文字数" />
                <button class="action-btn flex-1" @click="doSplitByLength" :disabled="!hasData">
                  <Scissors :size="16" /> 指定文字数で分割
                </button>
              </div>
            </div>

            <div class="action-group">
              <h3 class="group-title">JSONL 連携</h3>
              <button class="action-btn" @click="doExportJsonl" :disabled="!hasData">
                <FileText :size="16" /> JSONL 出力
              </button>
              <div class="input-row">
                <input type="number" v-model.number="chunkLength" class="input-sm" placeholder="文字数" />
                <button class="action-btn flex-1" @click="doChunkJsonl" :disabled="!hasData">
                  <Merge :size="16" /> JSONL チャンク化
                </button>
              </div>
              <div class="input-row">
                <input type="file" ref="jsonlInput" hidden accept=".jsonl" @change="doUpdateFromJsonl" />
                <button class="action-btn flex-1" @click="jsonlInput?.click()" :disabled="!hasData">
                  <FileUp :size="16" /> JSONL からデータを反映
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
            <h2>ShWvData ビューワー</h2>
          </div>
          <div class="viewer-content">
            <JsonViewer v-if="hasData" :data="store.data" />
            <div class="empty-state" v-else>
              <FileJson :size="48" class="empty-icon" />
              <p>表示するデータがありません。<br>解析ページで作成するか、JSONファイルを読み込んでください。</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.manage-view {
  padding: 24px;
}

.shuttle-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 24px;
}

@media (max-width: 900px) {
  .shuttle-layout {
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
}

.card:hover {
  border-color: var(--border-hover);
}

.card.disabled {
  opacity: 0.5;
  pointer-events: none;
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
.upload-section {
  padding: 16px 20px;
}

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

.drop-icon {
  margin-bottom: 6px;
  opacity: 0.5;
}

.drop-zone p {
  font-size: 0.8rem;
}

.loaded-info {
  text-align: center;
}

.loaded-label {
  color: var(--success);
  font-weight: 700;
  font-size: 0.85rem;
}

.loaded-name {
  color: var(--text-secondary);
  font-size: 0.75rem;
  margin-top: 2px;
}

.loaded-count {
  color: var(--accent);
  font-size: 0.72rem;
  font-weight: 600;
  margin-top: 2px;
}

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

.action-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
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

.flex-1 {
  flex: 1;
}

/* Status */
.status-msg {
  margin: 0 20px 16px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
  font-weight: 500;
}

.status-msg.info {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.status-msg.success {
  background: rgba(16, 185, 129, 0.1);
  color: var(--success);
}

.status-msg.error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error);
}

/* Viewer */
.viewer-area {
  min-width: 0;
}

.viewer-content {
  padding: 20px;
  flex: 1;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: var(--text-muted);
  gap: 16px;
  text-align: center;
}

.empty-icon {
  opacity: 0.15;
}

.empty-state p {
  font-size: 0.88rem;
  line-height: 1.5;
}
</style>
