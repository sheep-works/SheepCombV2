<script setup lang="ts">
/**
 * web/pages/shuttle-manage.vue
 * 解析済みデータ（ShWvData）の管理・分割・エクスポートを行う画面。
 */
definePageMeta({
  title: 'Shuttle Manage',
  icon: 'settings',
})
import { ref, computed } from 'vue'
import { FileUp, Download, Scissors, Merge, FileText, FileJson, Trash2, Settings2 } from 'lucide-vue-next'
// Note: Using relative paths instead of Nuxt aliases (~~, ~, @) to ensure stable resolution.
import { useShuttleStore } from '../stores/shuttleStore'
import { FileIO } from '../utils/fileIO'
import JsonViewer from '../components/JsonViewer.vue'


// ストアの初期化
const store = useShuttleStore()

// UI 状態
const fileInput = ref<HTMLInputElement | null>(null)
const isProcessing = computed(() => store.isLoading)
const statusMsg = computed(() => store.statusMsg)
const splitLength = ref(2000)
const chunkLength = ref(2000)

// JSONL 更新用の入力
const jsonlInput = ref<HTMLInputElement | null>(null)

// データの有無を確認
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

/**
 * ファイルの読み込み処理（ストアに保存）
 */
/**
 * ファイルの読み込み処理（ストアに保存）
 */
async function loadFile(file: File) {
  try {
    store.setStatus('読み込み中...', 'info')
    const text = await file.text()
    const data = JSON.parse(text)
    await store.loadShwvData(data, file.name)
    store.setStatus(`読み取り完了: ${store.shwvUnitCount} segments`, 'success')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    store.setStatus(`エラー: ${msg}`, 'error')
  }
}

// --- エクスポート処理 ---

/** JSON (src/tgt ペア) として保存 */
function doExportJson() {
  if (!store.hasData) return
  const jsonStr = store.getManagedData('UNITS')
  FileIO.downloadJson(JSON.parse(jsonStr), 'export.json')
  store.setStatus('JSON をダウンロードしました', 'success')
}

/** CSV として保存 */
function doExportCsv() {
  if (!store.hasData) return
  const csv = store.getManagedData('CSV')
  FileIO.downloadCsv(csv, 'export.csv')
  store.setStatus('CSV をダウンロードしました', 'success')
}

/** 翻訳メモリー (TM) 形式として保存 */
function doExportTm() {
  if (!store.hasData) return
  const tmStr = store.getManagedData('TMS')
  FileIO.downloadJson(JSON.parse(tmStr), 'export_tm.json')
  store.setStatus('TM をダウンロードしました', 'success')
}

/** 用語集 (TB) 形式として保存 */
function doExportTb() {
  if (!store.hasData) return
  const tbStr = store.getManagedData('TBS')
  FileIO.downloadJson(JSON.parse(tbStr), 'export_tb.json')
  store.setStatus('TB をダウンロードしました', 'success')
}

/** 元のファイル単位に分割して保存 */
function doSplitByFile() {
  if (!store.data) return
  const result = store.shuttle.manager.splitByFile(store.data)
  result.forEach((pairs, name) => {
    FileIO.downloadJson(pairs, name)
  })
  store.setStatus(`${result.size} ファイルに分割して処理しました`, 'success')
}

/** 文字数制限に基づいて分割して保存 */
function doSplitByLength() {
  if (!store.data) return
  const chunks = store.shuttle.manager.splitByLength(store.data, splitLength.value)
  chunks.forEach((chunk, i) => {
    FileIO.downloadJson(chunk, `chunk_${String(i).padStart(3, '0')}.json`)
  })
  store.setStatus(`${chunks.size} チャンクに分割しました`, 'success')
}

/** 全セグメントを JSONL 形式でエクスポート */
function doExportJsonl() {
  if (!store.data) return
  const jsonl = store.getManagedData('JSONL')
  FileIO.download(jsonl, 'export.jsonl')
  store.setStatus('JSONL を出力しました', 'success')
}

/** 文字数制限に基づいて分割した JSONL をエクスポート */
function doChunkJsonl() {
  if (!store.data) return
  const chunkedJsonl = store.getManagedData('JSONL_CHUNKED', chunkLength.value)
  FileIO.download(chunkedJsonl, 'chunked.jsonl')
  store.setStatus('分割 JSONL を出力しました', 'success')
}

/** 外部の JSONL ファイルを読み込んで、現在のデータの訳文を更新 */
async function doUpdateFromJsonl(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || !store.data) return

  try {
    const text = await file.text()
    const updated = store.shuttle.manager.updateFromJsonl(store.data, text)
    store.data.body.units = updated
    store.setStatus('JSONL から更新しました', 'success')
  } catch (e: any) {
    store.setStatus(`更新エラー: ${e.message}`, 'error')
  }
}

function doClear() {
  store.clear()
  store.setStatus('データをクリアしました', 'info')
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
            <!-- <div class="loaded-name">{{ store.fileName }}</div> -->
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

.flex-1 {
  flex: 1;
}

.viewer-area {
  min-width: 0;
}

.viewer-content {
  padding: 20px;
  flex: 1;
}
</style>
