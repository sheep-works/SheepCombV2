<script setup lang="ts">
/**
 * web/pages/parser.vue
 * 各種ファイル（XLIFF, TMX, Excel, DOCX等）をパースしてセグメント化するツール。
 * SheepShuttle コンポーネントを直接使用して解析を行います。
 */
definePageMeta({
  title: 'Parser',
  icon: 'database',
})

import { ref, computed } from 'vue'
import { FileUp, Search, Download, Database, Trash2, Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-vue-next'
// Note: Using relative paths instead of Nuxt aliases (~~, ~, @) to ensure stable resolution.
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { useShuttleStore } from '../../stores/shuttleStore'
import { SheepShuttle } from '../../../logic/shuttle/sheepShuttle.js'
import type { TranslationPair } from '../../../logic/types/shwv.js'
import { FileIO } from '../../utils/fileIO'


// ストアおよびコンポーネントの状態管理
const store = useShuttleStore()
const fileInput = ref<HTMLInputElement | null>(null)
const isProcessing = computed(() => store.isLoading || store.isProgressing)
const statusMsg = computed(() => {
  if (store.isProgressing) {
    return { text: store.progressText || 'Processing in background...', type: 'info' }
  }
  return store.statusMsg
})

// Pagination logic
const currentPage = ref(1)
const itemsPerPage = 100
const paginatedUnits = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return store.units.slice(start, end)
})
const totalPages = computed(() => Math.ceil(store.unitCount / itemsPerPage))

/**
 * Handle page changes
 */
const setPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    jumpPageInput.value = page
    // Scroll table to top on page change
    const container = document.querySelector('.table-container')
    if (container) container.scrollTop = 0
  }
}

const jumpPageInput = ref(1)
const handleJumpPage = () => {
  let page = Math.floor(jumpPageInput.value)
  if (page < 1) page = 1
  if (page > totalPages.value) page = totalPages.value
  setPage(page)
}

// 選択された File オブジェクトのリスト
const selectedFiles = ref<File[]>([])
const splitByNewline = ref(true)

/**
 * ドラッグ&ドロップによるファイル選択のハンドリング
 */
const handleFileDrop = (e: DragEvent) => {
  e.preventDefault()
  if (e.dataTransfer?.files) {
    selectedFiles.value = Array.from(e.dataTransfer.files)
  }
}

/**
 * ファイル選択ボタンによる選択のハンドリング
 */
const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files) {
    selectedFiles.value = Array.from(target.files)
  }
}

/**
 * 選択ファイルと結果ストアのクリア
 */
const clearFiles = () => {
  selectedFiles.value = []
  store.clear()
}

/**
 * 選択されたファイルをパースしてストアに保存
 * 内部で SheepShuttle インスタンスを生成して処理します
 */
const parseFiles = async () => {
  if (selectedFiles.value.length === 0) return

  try {
    store.setStatus(t('shuttle.parser.msg_parsing'), 'info')

    // File オブジェクトを Shuttle が受け取れる形式に変換
    const files = await Promise.all(selectedFiles.value.map(async file => {
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      const isText = ['xlf', 'xliff', 'mxliff', 'sdlxliff', 'mqxliff', 'tmx', 'tbx', 'csv', 'tsv', 'json', 'jsonl'].includes(ext)

      return {
        name: file.name,
        content: isText ? await file.text() : await file.arrayBuffer()
      }
    }))

    // ストア経由でパース実行
    await store.parseFiles(files, splitByNewline.value)

    // プロセッサ（フィルタ等）を実行してステートを更新
    store.process()
    currentPage.value = 1

    store.setStatus(t('shuttle.parser.msg_parse_success'), 'success')
  } catch (e: any) {
    console.error('Parse error:', e)
    store.setStatus(t('shuttle.parser.msg_error', { message: e.message }), 'error')
  }
}

/**
 * パース結果をファイルとしてエクスポート（ダウンロード）
 */
const exportResults = (format: 'json' | 'csv') => {
  if (!store.hasUnits) return
  if (format === 'json') {
    FileIO.downloadJson(store.units, 'parsed_results.json')
  } else {
    // getCsv() converts store.units directly to CSV string
    const csv = store.shuttle.getCsv()
    FileIO.downloadCsv(csv, 'parsed_results.csv')
  }
}

// --- フィルタ設定 ---
const filterOptions = ref({
  toFilterDuplicate: false,
  toFilterDnt: null as 'digit' | 'eng' | 'digit eng' | null,
  toFilterLock: false
})

/**
 * フィルタを適用してデータを再構成
 */
const applyFilters = () => {
  if (!store.hasUnits) return
  store.process(filterOptions.value)
  currentPage.value = 1
  store.setStatus(t('shuttle.parser.msg_filter_applied'), 'success')
}

// --- サンプリング設定 ---
const samplingTotalChars = ref(500)
const samplingSeed = ref<number | null>(null)

/**
 * サンプリングを適用してデータを抽出
 */
const applySampling = () => {
  if (!store.hasUnits) return
  if (!samplingTotalChars.value || samplingTotalChars.value <= 0) {
    store.setStatus(t('shuttle.parser.err_sampling_target'), 'error')
    return
  }

  // シード値が指定されていなければ自動生成
  const seed = (samplingSeed.value !== null && samplingSeed.value !== undefined && !isNaN(samplingSeed.value))
    ? samplingSeed.value
    : Math.floor(Math.random() * 1000000)

  samplingSeed.value = seed

  store.sampling(samplingTotalChars.value, seed)
  currentPage.value = 1
  store.setStatus(t('shuttle.parser.msg_sampling_applied', { chars: samplingTotalChars.value, seed }), 'success')
}



</script>

<template>
  <div class="parser-view">
    <div class="parser-layout">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="card upload-section">
          <div class="card-header">
            <h2>{{ $t('shuttle.parser.upload_title') }}</h2>
          </div>
          <div class="drop-zone" @drop="handleFileDrop" @dragover.prevent @click="fileInput?.click()">
            <FileUp :size="24" class="drop-icon" />
            <p v-if="selectedFiles.length === 0">{{ $t('shuttle.parser.drag_drop') }}</p>
            <p v-else class="file-count">{{ $t('shuttle.parser.files_selected', { count: selectedFiles.length }) }}</p>
            <input type="file" ref="fileInput" hidden multiple @change="handleFileSelect" />
          </div>
          <div class="file-list" v-if="selectedFiles.length > 0">
            <div v-for="f in selectedFiles" :key="f.name" class="file-tag">
              {{ f.name }}
            </div>
            <button class="btn-clear" @click.stop="clearFiles">
              <Trash2 :size="14" />
            </button>
          </div>
        </div>

        <div class="card actions" :class="{ disabled: (selectedFiles.length === 0 && !store.hasUnits) || isProcessing }">
          <div class="card-header">
            <h2>{{ $t('shuttle.parser.actions_title') }}</h2>
          </div>
          <p class="hint-text">{{ $t('shuttle.parser.actions_hint') }}</p>

          <label class="checkbox-label" style="margin-bottom: 8px;">
            <input type="checkbox" v-model="splitByNewline" />
            <span>改行で分割してパースする</span>
          </label>

          <button class="btn primary" @click="parseFiles" :disabled="selectedFiles.length === 0 || isProcessing">
            <Loader2 v-if="isProcessing" class="spin" :size="18" />
            <span v-else>{{ $t('shuttle.parser.btn_parse') }}</span>
          </button>

          <!-- フィルタ設定エリア -->
          <div class="filter-settings" v-if="store.hasUnits">
            <div class="filter-divider"></div>
            <h3 class="filter-title">{{ $t('shuttle.parser.filter_title') }}</h3>

            <label class="checkbox-label">
              <input type="checkbox" v-model="filterOptions.toFilterDuplicate" />
              <span>{{ $t('shuttle.parser.filter_duplicate') }}</span>
            </label>

            <label class="checkbox-label">
              <input type="checkbox" v-model="filterOptions.toFilterLock" />
              <span>{{ $t('shuttle.parser.filter_lock') }}</span>
            </label>

            <div class="select-group">
              <span class="select-label">{{ $t('shuttle.parser.filter_dnt') }}</span>
              <select v-model="filterOptions.toFilterDnt" class="select-sm">
                <option :value="null">{{ $t('shuttle.parser.dnt_none') }}</option>
                <option value="digit">{{ $t('shuttle.parser.dnt_digit') }}</option>
                <option value="eng">{{ $t('shuttle.parser.dnt_eng') }}</option>
                <option value="digit eng">{{ $t('shuttle.parser.dnt_digit_eng') }}</option>
              </select>
            </div>

            <button class="btn-outline-action" @click="applyFilters">
              {{ $t('shuttle.parser.btn_apply_filter') }}
            </button>

            <div class="filter-divider"></div>
            <h3 class="filter-title">{{ $t('shuttle.parser.sampling_title') }}</h3>
            <p class="sampling-hint-text">
              {{ $t('shuttle.parser.sampling_hint') }}
            </p>

            <div class="input-group">
              <span class="input-label">{{ $t('shuttle.parser.sampling_target') }}</span>
              <input type="number" v-model.number="samplingTotalChars" class="input-sm full-width" min="1" />
            </div>

            <div class="input-group" style="margin-top: 8px;">
              <span class="input-label">{{ $t('shuttle.parser.sampling_seed') }}</span>
              <input type="number" v-model.number="samplingSeed" class="input-sm full-width" :placeholder="$t('shuttle.parser.sampling_seed_placeholder')" min="0" />
            </div>

            <button class="btn-outline-action btn-sampling" @click="applySampling" style="margin-top: 8px;">
              {{ $t('shuttle.parser.btn_apply_sampling') }}
            </button>
          </div>
        </div>

        <div class="status-msg" v-if="statusMsg.text" :class="statusMsg.type">
          {{ statusMsg.text }}
        </div>
      </aside>

      <!-- Main Content -->
      <section class="results-area">
        <div class="card full-height">
          <div class="card-header space-between">
            <div class="title-group">
              <h2>{{ $t('shuttle.parser.results_title') }}</h2>
              <span class="badge" v-if="store.hasUnits">
                {{ $t('shuttle.parser.segments', { count: store.unitCount }) }}
              </span>
            </div>
            <div class="export-actions" v-if="store.hasUnits">
              <button class="btn-outline" @click="exportResults('csv')">
                <Download :size="14" /> CSV
              </button>
              <button class="btn-outline" @click="exportResults('json')">
                <Database :size="14" /> JSON
              </button>
            </div>
          </div>

          <div class="table-container" v-if="store.hasUnits">
            <table>
              <thead>
                <tr>
                  <th class="w-10">#</th>
                  <th>Source</th>
                  <th>Target</th>
                  <th v-if="store.units.some((s: TranslationPair) => s.note)">Note</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="seg in paginatedUnits" :key="seg.idx">
                  <td class="idx">{{ seg.idx + 1 }}</td>
                  <td class="text">{{ seg.src }}</td>
                  <td class="text">{{ seg.tgt }}</td>
                  <td class="note" v-if="store.units.some((s: TranslationPair) => s.note)">
                    {{ seg.note }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination Controls -->
          <div class="pagination-footer" v-if="store.hasUnits && totalPages > 1">
            <div class="pagination-info">
              Showing {{ (currentPage - 1) * itemsPerPage + 1 }} to {{ Math.min(currentPage * itemsPerPage,
                store.unitCount) }} of {{ store.unitCount }} entries
            </div>
            <div class="pagination-controls">
              <button class="btn-page" :disabled="currentPage === 1" @click="setPage(1)" title="First Page">
                <ChevronsLeft :size="16" />
              </button>
              <button class="btn-page" :disabled="currentPage === 1" @click="setPage(currentPage - 1)"
                title="Previous Page">
                <ChevronLeft :size="16" />
              </button>

              <div class="page-jump">
                <input type="number" v-model.number="jumpPageInput" @keyup.enter="handleJumpPage" @blur="handleJumpPage"
                  min="1" :max="totalPages" class="input-jump" />
                <span class="page-divider">/</span>
                <span class="page-total">{{ totalPages }}</span>
              </div>

              <button class="btn-page" :disabled="currentPage === totalPages" @click="setPage(currentPage + 1)"
                title="Next Page">
                <ChevronRight :size="16" />
              </button>
              <button class="btn-page" :disabled="currentPage === totalPages" @click="setPage(totalPages)"
                title="Last Page">
                <ChevronsRight :size="16" />
              </button>
            </div>
          </div>

          <div class="empty-state" v-else>
            <Search :size="48" class="empty-icon" />
            <p>{{ $t('shuttle.parser.empty_results') }}</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.parser-view {
  padding: 24px;
}

.parser-layout {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 24px;
}

@media (max-width: 900px) {
  .parser-layout {
    grid-template-columns: 1fr;
  }
}

.upload-section {
  padding: 16px 20px;
}

.file-count {
  color: var(--accent);
  font-weight: 600;
}

.file-list {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  max-height: 200px;
  overflow-y: auto;
  padding: 6px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: var(--radius-xs);
}

.file-tag {
  font-size: 0.68rem;
  background: var(--bg-secondary);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-secondary);
}

.btn-clear {
  background: none;
  border: none;
  color: var(--error);
  cursor: pointer;
  padding: 4px;
  opacity: 0.6;
  transition: var(--transition);
}

.btn-clear:hover {
  opacity: 1;
}

.actions {
  padding: 0 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn-outline-dashed {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--border);
  background: none;
  color: var(--text-muted);
  font-weight: 500;
  font-size: 0.82rem;
  cursor: not-allowed;
  font-family: 'Inter', sans-serif;
}

.hint-text {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-align: center;
  margin-bottom: 10px;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.export-actions {
  display: flex;
  gap: 6px;
}

.table-container {
  flex: 1;
  overflow: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

th,
td {
  padding: 12px 20px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

th {
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: rgba(255, 255, 255, 0.02);
}

td.idx {
  color: var(--text-muted);
  font-family: 'Inter', monospace;
  font-size: 0.75rem;
}

td.text {
  color: var(--text-primary);
  line-height: 1.5;
}

td.note {
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-style: italic;
}

.w-10 {
  width: 10%;
}

/* Filters UI */
.filter-settings {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-divider {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

.filter-title {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.05em;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.checkbox-label input {
  accent-color: var(--accent);
}

.select-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.select-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.select-sm {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  color: var(--text-primary);
  padding: 6px;
  font-size: 0.8rem;
  outline: none;
}

.select-sm:focus {
  border-color: var(--accent);
}

.btn-outline-action {
  background: none;
  border: 1px solid var(--accent);
  color: var(--accent);
  padding: 8px;
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
}

.btn-outline-action:hover {
  background: var(--accent-glow);
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.input-sm.full-width {
  width: 100%;
}

.sampling-hint-text {
  font-size: 0.7rem;
  color: var(--text-muted);
  line-height: 1.4;
  margin-bottom: 2px;
}

.btn-sampling {
  border-color: #3b82f6;
  color: #3b82f6;
}

.btn-sampling:hover {
  background: rgba(59, 130, 246, 0.12);
}

/* Pagination Styles */
.pagination-footer {
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.1);
}

.pagination-info {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-page {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 6px;
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--transition);
}

.btn-page:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.btn-page:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-jump {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  padding: 2px 8px;
  border-radius: var(--radius-xs);
  transition: var(--transition);
}

.page-jump:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-glow);
}

.input-jump {
  background: none;
  border: none;
  color: var(--accent);
  font-weight: 700;
  width: 40px;
  text-align: center;
  font-size: 0.85rem;
  outline: none;
  padding: 2px 0;
}

/* Remove arrows from number input */
.input-jump::-webkit-outer-spin-button,
.input-jump::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.page-divider {
  color: var(--text-muted);
  font-size: 0.75rem;
}

.page-total {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 500;
}
</style>
