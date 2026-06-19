<script setup lang="ts">
/**
 * web/pages/shuttle/manage.vue
 * 解析済みデータ（ShWvData）の管理・分割・エクスポートを行う画面。
 */
definePageMeta({
  title: '管理',
  icon: 'settings',
})
import { ref, computed } from 'vue'
import { FileUp, Download, Scissors, Merge, FileText, FileJson, Trash2, Settings2 } from 'lucide-vue-next'
// Note: Using relative paths instead of Nuxt aliases (~~, ~, @) to ensure stable resolution.
import { useShuttleStore } from '../../stores/shuttleStore'
import { SheepShuttle } from '@sheep-family/core'
import { FileIO } from '../../utils/fileIO'
import JsonViewer from '../../components/JsonViewer.vue'
import { useI18n } from 'vue-i18n'

// ストアの初期化
const store = useShuttleStore()
const { t } = useI18n()

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
    store.setStatus(t('shuttle.manage.msg_loading'), 'info')
    const text = await file.text()
    const data = JSON.parse(text)
    await store.loadShwvData(data, file.name)
    store.setStatus(t('shuttle.manage.msg_read_complete', { count: store.shwvUnitCount }), 'success')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    store.setStatus(t('shuttle.manage.msg_error', { msg }), 'error')
  }
}

// --- エクスポート処理 ---

/** JSON (src/tgt ペア) として保存 */
function doExportJson() {
  if (!store.hasData) return
  const jsonStr = store.getManagedData('UNITS')
  FileIO.downloadJson(JSON.parse(jsonStr), 'export.json')
  store.setStatus(t('shuttle.manage.msg_export_json'), 'success')
}

/** CSV として保存 */
function doExportCsv() {
  if (!store.hasData) return
  const csv = store.getManagedData('CSV')
  FileIO.downloadCsv(csv, 'export.csv')
  store.setStatus(t('shuttle.manage.msg_export_csv'), 'success')
}

/** 翻訳メモリー (TM) 形式として保存 */
function doExportTm() {
  if (!store.hasData) return
  const tmStr = store.getManagedData('TMS')
  FileIO.downloadJson(JSON.parse(tmStr), 'export_tm.json')
  store.setStatus(t('shuttle.manage.msg_export_tm'), 'success')
}

/** 用語集 (TB) 形式として保存 */
function doExportTb() {
  if (!store.hasData) return
  const tbStr = store.getManagedData('TBS')
  FileIO.downloadJson(JSON.parse(tbStr), 'export_tb.json')
  store.setStatus(t('shuttle.manage.msg_export_tb'), 'success')
}

/** 元のファイル単位に分割して保存 */
function doSplitByFile() {
  if (!store.data) return
  const result = store.shuttle.manager.splitByFile(store.data)
  result.forEach((pairs, name) => {
    FileIO.downloadJson(pairs, name)
  })
  store.setStatus(t('shuttle.manage.msg_split_files', { count: result.size }), 'success')
}

/** 文字数制限に基づいて分割して保存 */
function doSplitByLength() {
  if (!store.data) return
  const chunks = store.shuttle.manager.splitByLength(store.data, splitLength.value)
  chunks.forEach((chunk, i) => {
    FileIO.downloadJson(chunk, `chunk_${String(i).padStart(3, '0')}.json`)
  })
  store.setStatus(t('shuttle.manage.msg_split_chunks', { count: chunks.size }), 'success')
}

/** 全セグメントを JSONL 形式でエクスポート */
function doExportJsonl() {
  if (!store.data) return
  const jsonl = store.getManagedData('JSONL')
  FileIO.download(jsonl, 'export.jsonl')
  store.setStatus(t('shuttle.manage.msg_export_jsonl'), 'success')
}

/** 文字数制限に基づいて分割した JSONL をエクスポート */
function doChunkJsonl() {
  if (!store.data) return
  const chunkedJsonl = store.getManagedData('JSONL_CHUNKED', chunkLength.value)
  FileIO.download(chunkedJsonl, 'chunked.jsonl')
  store.setStatus(t('shuttle.manage.msg_export_jsonl_chunked'), 'success')
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
    store.setStatus(t('shuttle.manage.msg_update_jsonl'), 'success')
  } catch (e: any) {
    store.setStatus(t('shuttle.manage.msg_update_error', { msg: e.message }), 'error')
  }
}

function doClear() {
  store.clear()
  store.setStatus(t('shuttle.manage.msg_cleared'), 'info')
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
            <h2>{{ $t('shuttle.manage.title_load') }}</h2>
          </div>
          <div v-if="!hasData" class="drop-zone" @drop="handleFileDrop" @dragover.prevent @click="fileInput?.click()">
            <FileUp :size="24" class="drop-icon" />
            <p>{{ $t('shuttle.manage.drop_json') }}</p>
            <input type="file" ref="fileInput" hidden accept=".json" @change="handleFileSelect" />
          </div>
          <div v-else class="loaded-info">
            <div class="loaded-label">{{ $t('shuttle.manage.active_data') }}</div>
            <!-- <div class="loaded-name">{{ store.fileName }}</div> -->
            <div class="loaded-count">{{ $t('shuttle.manage.segments', { count: store.unitCount }) }}</div>
            <button class="btn-clear-full" @click="doClear">
              <Trash2 :size="14" /> {{ $t('shuttle.manage.btn_clear') }}
            </button>
          </div>
        </div>

        <!-- Action Card -->
        <div class="card" :class="{ disabled: !hasData }">
          <div class="card-header">
            <Settings2 :size="18" />
            <h2>{{ $t('shuttle.manage.title_operations') }}</h2>
          </div>
          <div class="action-list">
            <div class="action-group">
              <h3 class="group-title">{{ $t('shuttle.manage.group_export') }}</h3>
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
              <h3 class="group-title">{{ $t('shuttle.manage.group_split') }}</h3>
              <button class="action-btn" @click="doSplitByFile" :disabled="!hasData">
                <Scissors :size="16" /> {{ $t('shuttle.manage.btn_split_file') }}
              </button>
              <div class="input-row">
                <input type="number" v-model.number="splitLength" class="input-sm" :placeholder="$t('shuttle.manage.placeholder_chars')" />
                <button class="action-btn flex-1" @click="doSplitByLength" :disabled="!hasData">
                  <Scissors :size="16" /> {{ $t('shuttle.manage.btn_split_length') }}
                </button>
              </div>
            </div>

            <div class="action-group">
              <h3 class="group-title">{{ $t('shuttle.manage.group_jsonl') }}</h3>
              <button class="action-btn" @click="doExportJsonl" :disabled="!hasData">
                <FileText :size="16" /> {{ $t('shuttle.manage.btn_export_jsonl') }}
              </button>
              <div class="input-row">
                <input type="number" v-model.number="chunkLength" class="input-sm" :placeholder="$t('shuttle.manage.placeholder_chars')" />
                <button class="action-btn flex-1" @click="doChunkJsonl" :disabled="!hasData">
                  <Merge :size="16" /> {{ $t('shuttle.manage.btn_chunk_jsonl') }}
                </button>
              </div>
              <div class="input-row">
                <input type="file" ref="jsonlInput" hidden accept=".jsonl" @change="doUpdateFromJsonl" />
                <button class="action-btn flex-1" @click="jsonlInput?.click()" :disabled="!hasData">
                  <FileUp :size="16" /> {{ $t('shuttle.manage.btn_update_jsonl') }}
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
            <h2>{{ $t('shuttle.manage.title_viewer') }}</h2>
          </div>
          <div class="viewer-content">
            <JsonViewer v-if="hasData" :data="store.data" />
            <div class="empty-state" v-else>
              <FileJson :size="48" class="empty-icon" />
              <p style="white-space: pre-line">{{ $t('shuttle.manage.empty_viewer') }}</p>
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
