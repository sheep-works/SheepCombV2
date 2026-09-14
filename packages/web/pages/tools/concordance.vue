<script setup lang="ts">
/**
 * web/pages/tools/concordance.vue
 * FlexSearch を使用したコンコーダンス（一致検索）ツール。
 * 読み込まれたデータ全体から、特定の単語やフレーズを含むセグメントを高速に検索します。
 */
definePageMeta({
  title: 'コンコーダンス',
  icon: 'search',
})

import { ref, watch, computed } from 'vue'
import { Search, Hash, FileText, Database, Info, Loader2, Download, Upload } from 'lucide-vue-next'
import { useShuttleStore } from '../../stores/shuttleStore'
import { useI18n } from 'vue-i18n'

const store = useShuttleStore()
const { t } = useI18n()
const searchQuery = ref('')
const searchFields = ref({
  src: true,
  tgt: true,
  note: true,
})
const results = ref<any[]>([])
const isSearching = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const indexStatus = computed<'unbuilt' | 'building' | 'ready'>(() => {
  if (store.isIndexBuilding) return 'building'
  if (store.isIndexReady) return 'ready'
  return 'unbuilt'
})

const indexStatusText = computed(() => {
  if (indexStatus.value === 'building') return t('tools.concordance.status_building')
  if (indexStatus.value === 'ready') return t('tools.concordance.status_ready')
  return t('tools.concordance.status_unbuilt')
})

/**
 * 検索の実行
 */
const performSearch = () => {
  if (!searchQuery.value || searchQuery.value.trim().length < 1) {
    results.value = []
    return
  }

  isSearching.value = true
  // FlexSearch による高速検索（対象フィールド指定）
  results.value = store.searchConcordance(searchQuery.value, 100, searchFields.value)
  isSearching.value = false
}

// クエリや検索対象フィールドの変更を監視して自動検索
watch([searchQuery, searchFields], () => {
  performSearch()
}, { deep: true })

/**
 * インデックスの再構築
 */
const reindex = () => {
  store.buildSearchIndex()
  performSearch()
}

/**
 * 検索データをJSONでダウンロード
 */
const downloadData = async () => {
  const data = await store.exportSearchData()
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `concordance-data-${new Date().getTime()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * インポートボタンクリック
 */
const triggerUpload = () => {
  fileInput.value?.click()
}

/**
 * ファイル選択時の処理
 */
const handleUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const data = JSON.parse(text)
    await store.importSearchData(data)
    performSearch()
    // Reset input
    target.value = ''
  } catch (e) {
    console.error('Import failed:', e)
    alert(t('tools.concordance.err_import'))
  }
}
</script>

<template>
  <div class="concordance-view">
    <div class="concordance-layout">
      <!-- Search Sidebar -->
      <aside class="search-sidebar">
        <div class="card">
          <div class="card-header">
            <h2>{{ $t('tools.concordance.title_settings') }}</h2>
          </div>
          <div class="search-input-area">
            <div class="input-with-icon">
              <Search :size="18" class="icon" />
              <input 
                type="text" 
                v-model="searchQuery" 
                :placeholder="$t('tools.concordance.placeholder_search')" 
                class="search-input"
                autoFocus
              />
            </div>
            <p class="search-hint">{{ $t('tools.concordance.search_hint') }}</p>

            <div class="search-targets-group">
              <span class="targets-label">{{ $t('tools.concordance.lbl_search_targets') }}</span>
              <div class="targets-checkboxes">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="searchFields.src" />
                  <span>{{ $t('tools.concordance.target_src') }}</span>
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" v-model="searchFields.tgt" />
                  <span>{{ $t('tools.concordance.target_tgt') }}</span>
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" v-model="searchFields.note" />
                  <span>{{ $t('tools.concordance.target_note') }}</span>
                </label>
              </div>
            </div>
          </div>

          <div class="data-status">
            <div class="status-item">
              <span class="label">{{ $t('tools.concordance.lbl_target_count') }}</span>
              <span class="value">{{ $t('tools.concordance.segments', { count: store.unitCount }) }}</span>
            </div>
            <div class="reindex-row">
              <button class="btn-text" @click="reindex" :disabled="store.isIndexBuilding">
                <Loader2 v-if="store.isIndexBuilding" :size="14" class="spin" />
                <Database v-else :size="14" />
                {{ $t('tools.concordance.btn_reindex') }}
              </button>
              <span class="index-status-tag" :class="indexStatus">
                <span class="status-dot"></span>
                {{ indexStatusText }}
              </span>
            </div>
            
            <div class="action-group-horizontal">
              <button class="btn-text" @click="downloadData">
                <Download :size="14" /> {{ $t('tools.concordance.btn_export') }}
              </button>
              <button class="btn-text" @click="triggerUpload">
                <Upload :size="14" /> {{ $t('tools.concordance.btn_import') }}
              </button>
              <input 
                type="file" 
                ref="fileInput" 
                style="display: none" 
                accept=".json" 
                @change="handleUpload" 
              />
            </div>
          </div>
        </div>

        <div class="info-card">
          <div class="info-header">
            <Info :size="16" />
            <h3>{{ $t('tools.concordance.title_info') }}</h3>
          </div>
          <p>
            {{ $t('tools.concordance.info_desc1') }}
          </p>
          <p class="mt-2">
            <strong>{{ $t('tools.concordance.info_desc2_title') }}</strong>{{ $t('tools.concordance.info_desc2') }}
          </p>
        </div>
      </aside>

      <!-- Main Results Area -->
      <main class="results-area">
        <div class="card full-height">
          <div class="card-header space-between">
            <div class="title-group">
              <h2>{{ $t('tools.concordance.title_result') }}</h2>
              <span class="badge" v-if="results.length > 0">
                {{ $t('tools.concordance.hits', { count: results.length }) }}
              </span>
            </div>
          </div>

          <div class="table-container" v-if="results.length > 0">
            <table class="search-table">
              <thead>
                <tr>
                  <th class="w-idx">#</th>
                  <th class="w-file" v-if="results.some(r => r.file)">File</th>
                  <th>Source</th>
                  <th>Target</th>
                  <th class="w-note" v-if="results.some(r => r.note)">Note</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in results" :key="item.id">
                  <td class="idx">{{ item.id + 1 }}</td>
                  <td class="file" v-if="results.some(r => r.file)">{{ item.file }}</td>
                  <td class="text src">{{ item.src }}</td>
                  <td class="text tgt">{{ item.tgt }}</td>
                  <td class="text note" v-if="results.some(r => r.note)">{{ item.note }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="empty-state" v-else-if="searchQuery.length > 0">
            <Search :size="48" class="empty-icon" />
            <p>{{ $t('tools.concordance.empty_not_found', { query: searchQuery }) }}</p>
          </div>

          <div class="empty-state" v-else>
            <Database :size="48" class="empty-icon" />
            <p>{{ $t('tools.concordance.empty_input') }}</p>
            <p class="sub-text">{{ $t('tools.concordance.empty_subtext', { count: store.unitCount }) }}</p>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.concordance-view {
  padding: 24px;
  height: calc(100vh - 60px);
}

.concordance-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 24px;
  height: 100%;
}

.search-sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.search-input-area {
  padding: 20px;
}

.input-with-icon {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-icon .icon {
  position: absolute;
  left: 12px;
  color: var(--text-muted);
}

.search-input {
  width: 100%;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 12px 12px 40px;
  color: var(--text-primary);
  font-size: 0.95rem;
  outline: none;
  transition: var(--transition);
}

.search-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-glow);
}

.search-hint {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 10px;
  line-height: 1.4;
}

.search-targets-group {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.targets-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.targets-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--text-muted);
  cursor: pointer;
  user-select: none;
  transition: var(--transition);
}

.checkbox-label:hover {
  color: var(--text-primary);
}

.checkbox-label input[type="checkbox"] {
  accent-color: var(--accent);
  cursor: pointer;
}

.data-status {
  padding: 0 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-top: 1px solid var(--border);
  padding-top: 20px;
  margin: 0 20px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
}

.status-item .label { color: var(--text-muted); }
.status-item .value { color: var(--accent); font-weight: 700; }

.action-group-horizontal {
  display: flex;
  gap: 16px;
  align-items: center;
}

.mt-2 {
  margin-top: 8px;
}

.btn-text {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 4px 0;
  transition: var(--transition);
}

.btn-text:hover {
  color: var(--accent);
}

.btn-text:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.reindex-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.index-status-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  letter-spacing: 0.02em;
  font-family: 'Inter', monospace;
  line-height: 1.2;
}

.index-status-tag .status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: currentColor;
}

.index-status-tag.unbuilt {
  background: rgba(156, 163, 175, 0.12);
  color: var(--text-muted);
  border: 1px solid rgba(156, 163, 175, 0.25);
}

.index-status-tag.building {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.index-status-tag.building .status-dot {
  animation: pulse 1.2s infinite;
}

.index-status-tag.ready {
  background: var(--accent-glow);
  color: var(--accent-light);
  border: 1px solid var(--border-accent);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.info-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
}

.info-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--accent);
  margin-bottom: 12px;
}

.info-header h3 {
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
}

.info-card p {
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.results-area {
  min-width: 0;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.table-container {
  flex: 1;
  overflow: auto;
}

.search-table {
  width: 100%;
  border-collapse: collapse;
}

.search-table th {
  position: sticky;
  top: 0;
  background: var(--bg-card);
  z-index: 10;
  padding: 12px 16px;
  text-align: left;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-muted);
  border-bottom: 2px solid var(--border);
}

.search-table td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  font-size: 0.88rem;
  vertical-align: top;
  line-height: 1.5;
}

.w-idx { width: 50px; }
.w-file { width: 120px; max-width: 120px; }
.w-note { width: 180px; max-width: 240px; }

.idx { color: var(--text-muted); font-size: 0.75rem; font-family: monospace; }
.file { font-size: 0.75rem; color: var(--text-muted); word-break: break-all; }
.src { color: var(--text-primary); font-weight: 500; }
.tgt { color: var(--text-secondary); }
.note { color: var(--text-muted); font-size: 0.8rem; line-height: 1.4; word-break: break-all; }

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  padding-bottom: 100px;
}

.empty-icon {
  margin-bottom: 20px;
  opacity: 0.2;
}

.sub-text {
  font-size: 0.8rem;
  margin-top: 8px;
}

@media (max-width: 900px) {
  .concordance-layout {
    grid-template-columns: 1fr;
  }
}
</style>
