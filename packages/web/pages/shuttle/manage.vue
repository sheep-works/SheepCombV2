<script setup lang="ts">
/**
 * web/pages/shuttle/manage.vue
 * 解析済みデータ（ShWvData）の管理・QAチェック・分割・エクスポートを行う画面。
 */
definePageMeta({
  title: '管理・QA',
  icon: 'settings',
})
import { ref, computed } from 'vue'
import { FileUp, Download, Scissors, Merge, FileText, FileJson, Trash2, Settings2, ShieldCheck, AlertTriangle, CheckCircle2, Filter } from 'lucide-vue-next'
import { useShuttleStore } from '../../stores/shuttleStore'
import { FileIO } from '../../utils/fileIO'
import { restorePlaceholders } from '@sheep-family/core'
import JsonViewer from '../../components/JsonViewer.vue'
import type { QaConfig, QaIssue, QaIssueType } from '@sheep-family/types'
import { useI18n } from 'vue-i18n'

const store = useShuttleStore()
const { t } = useI18n()

// UI 状態
const fileInput = ref<HTMLInputElement | null>(null)
const jsonlInput = ref<HTMLInputElement | null>(null)
const splitLength = ref(2000)
const chunkLength = ref(2000)

const activeTab = ref<'viewer' | 'qa'>('viewer')

// QA 状態
const qaConfig = ref<QaConfig>({
  check_numbers: true,
  check_tags: true,
  check_terms: true,
  check_consistency: true,
  check_unmodified_pe: true,
})
const qaIssues = ref<QaIssue[]>([])
const hasRunQa = ref(false)
const selectedIssueFilter = ref<QaIssueType | 'ALL'>('ALL')

const isProcessing = computed(() => store.isLoading)
const statusMsg = computed(() => store.statusMsg)
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
async function loadFile(file: File) {
  try {
    store.setStatus(t('shuttle.manage.msg_loading'), 'info')
    const text = await file.text()
    const data = JSON.parse(text)
    await store.loadShwvData(data, file.name)
    store.setStatus(t('shuttle.manage.msg_read_complete', { count: store.shwvUnitCount }), 'success')
    // 新しいデータを読み込んだら QA 結果をリセット
    qaIssues.value = []
    hasRunQa.value = false
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    store.setStatus(t('shuttle.manage.msg_error', { msg }), 'error')
  }
}

// --- QA チェック処理 ---
function doRunQa() {
  if (!store.hasData) return
  qaIssues.value = store.runQa(qaConfig.value)
  hasRunQa.value = true
  activeTab.value = 'qa'
  if (qaIssues.value.length === 0) {
    store.setStatus('QAチェック完了: 問題は検出されませんでした', 'success')
  } else {
    store.setStatus(`QAチェック完了: ${qaIssues.value.length} 件の問題が検出されました`, 'info')
  }
}

function doExportQaReport() {
  if (qaIssues.value.length === 0) return
  FileIO.downloadJson(qaIssues.value, 'qa_issues.json')
  store.setStatus('qa_issues.json をエクスポートしました', 'success')
}

// カテゴリ別集計
const qaCounts = computed(() => {
  const counts: Record<string, number> = { Number: 0, Tag: 0, Term: 0, Consistency: 0, UnmodifiedPe: 0 }
  for (const issue of qaIssues.value) {
    counts[issue.issue_type] = (counts[issue.issue_type] || 0) + 1
  }
  return counts
})

// フィルタ済み Issue リスト
const filteredQaIssues = computed(() => {
  if (selectedIssueFilter.value === 'ALL') {
    return qaIssues.value
  }
  return qaIssues.value.filter(issue => issue.issue_type === selectedIssueFilter.value)
})

// ユニット参照用ヘルパー（プレースホルダーを元のタグに復元してプレビュー）
function getUnitText(idx: number) {
  if (!store.data?.body.units) return null
  const u = store.data.body.units.find(unit => unit.idx === idx)
  if (!u) return null
  return {
    src: restorePlaceholders(u.src, u.placeholders),
    tgt: restorePlaceholders(u.tgt, u.placeholders),
  }
}

// --- エクスポート処理 ---

/** ShWvData 形式として保存 (SheepWeave 互換 project.json) */
function doExportShwv() {
  if (!store.hasData || !store.data) return
  FileIO.downloadJson(store.data, 'project.json')
  store.setStatus('project.json (ShWvData) をエクスポートしました', 'success')
}

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
  const result = store.shuttle.manager.splitByLength(store.data, splitLength.value)
  result.forEach((pairs, name) => {
    FileIO.downloadJson(pairs, name)
  })
  store.setStatus(t('shuttle.manage.msg_split_chunks', { count: result.size }), 'success')
}

/** JSONL としてエクスポート */
function doExportJsonl() {
  if (!store.hasData) return
  const jsonl = store.getManagedData('JSONL')
  FileIO.download(jsonl, 'export.jsonl')
  store.setStatus(t('shuttle.manage.msg_export_jsonl'), 'success')
}

/** 分割 JSONL としてエクスポート */
function doChunkJsonl() {
  if (!store.data) return
  const chunkedJsonl = store.shuttle.manager.chunkJsonl(store.data, chunkLength.value)
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
  qaIssues.value = []
  hasRunQa.value = false
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
            <h2>{{ $t('shuttle.manage.title_load', 'ShWvData 読み込み') }}</h2>
          </div>
          <div v-if="!hasData" class="drop-zone" @drop="handleFileDrop" @dragover.prevent @click="fileInput?.click()">
            <FileUp :size="24" class="drop-icon" />
            <p>{{ $t('shuttle.manage.drop_json', 'ShWvData (.json) をドロップ') }}</p>
            <input type="file" ref="fileInput" hidden accept=".json" @change="handleFileSelect" />
          </div>
          <div v-else class="loaded-info">
            <div class="loaded-label">{{ $t('shuttle.manage.active_data', 'ACTIVE DATA') }}</div>
            <div class="loaded-count">{{ $t('shuttle.manage.segments', { count: store.shwvUnitCount }) }}</div>
            <button class="btn-clear-full" @click="doClear">
              <Trash2 :size="14" /> {{ $t('shuttle.manage.btn_clear', 'クリア') }}
            </button>
          </div>
        </div>

        <!-- QA Card -->
        <div class="card" :class="{ disabled: !hasData }">
          <div class="card-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <ShieldCheck :size="18" style="color: var(--accent);" />
              <h2>QA (品質チェック)</h2>
            </div>
          </div>
          <div class="action-list">
            <div class="qa-toggles">
              <label class="checkbox-label">
                <input type="checkbox" v-model="qaConfig.check_numbers" :disabled="!hasData" />
                <span>数字不一致</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="qaConfig.check_tags" :disabled="!hasData" />
                <span>タグ / プレースホルダー</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="qaConfig.check_terms" :disabled="!hasData" />
                <span>用語集 (TB) 含有</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="qaConfig.check_consistency" :disabled="!hasData" />
                <span>整合性 (100%一致行)</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="qaConfig.check_unmodified_pe" :disabled="!hasData" />
                <span>PE修正漏れ (未編集の下訳)</span>
              </label>
            </div>

            <button class="btn-qa-run" @click="doRunQa" :disabled="!hasData">
              <ShieldCheck :size="16" /> QAチェック実行
            </button>

            <button v-if="qaIssues.length > 0" class="action-btn" @click="doExportQaReport" style="margin-top: 4px;">
              <Download :size="14" /> QAレポート (JSON)
            </button>
          </div>
        </div>

        <!-- Action Card -->
        <div class="card" :class="{ disabled: !hasData }">
          <div class="card-header space-between" style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <Settings2 :size="18" />
              <h2>{{ $t('shuttle.manage.title_operations', 'データ操作・変換') }}</h2>
            </div>
            <ManualLink
              href="https://lambuage.com/sheep-comb/02_steps_desc.html#%E3%82%B9%E3%83%86%E3%83%83%E3%83%95%E3%82%9A-5-%E3%83%86%E3%82%99%E3%83%BC%E3%82%BF%E3%81%AE%E5%88%86%E5%89%B2%E3%81%A8%E7%AE%A1%E7%90%86-%E7%AE%A1%E7%90%86%E3%83%98%E3%82%9A%E3%83%BC%E3%82%B7%E3%82%99"
              :label="$t('manual.steps.manage', 'マニュアル')"
              compact
            />
          </div>
          <div class="action-list">
            <div class="action-group">
              <h3 class="group-title">{{ $t('shuttle.manage.group_export') }}</h3>
              <div class="action-grid" style="grid-template-columns: repeat(2, 1fr);">
                <button class="action-btn" @click="doExportShwv" :disabled="!hasData" style="grid-column: span 2; background: var(--accent-glow); color: var(--accent-light); border-color: var(--border-accent);">
                  <FileJson :size="16" /> ShWvData (JSON)
                </button>
                <button class="action-btn" @click="doExportJson" :disabled="!hasData">
                  <FileJson :size="16" /> Raw JSON
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

      <!-- Main content -->
      <section class="viewer-area">
        <div class="card full-height">
          <div class="card-header space-between" style="display: flex; justify-content: space-between; align-items: center;">
            <!-- Tabs -->
            <div class="view-tabs">
              <button class="tab-btn" :class="{ active: activeTab === 'viewer' }" @click="activeTab = 'viewer'">
                <FileJson :size="16" />
                <span>{{ $t('shuttle.manage.title_viewer', 'ShWvData ビューワー') }}</span>
              </button>
              <button class="tab-btn" :class="{ active: activeTab === 'qa' }" @click="activeTab = 'qa'">
                <ShieldCheck :size="16" />
                <span>QA レポート</span>
                <span v-if="hasRunQa" class="tab-badge" :class="qaIssues.length > 0 ? 'badge-warn' : 'badge-pass'">
                  {{ qaIssues.length }}
                </span>
              </button>
            </div>
          </div>

          <div class="viewer-content">
            <!-- ShWvData Viewer Tab -->
            <template v-if="activeTab === 'viewer'">
              <JsonViewer v-if="hasData" :data="store.data" />
              <div class="empty-state" v-else>
                <FileJson :size="48" class="empty-icon" />
                <p style="white-space: pre-line">{{ $t('shuttle.manage.empty_viewer') }}</p>
              </div>
            </template>

            <!-- QA Report Tab -->
            <template v-else-if="activeTab === 'qa'">
              <div v-if="!hasData" class="empty-state">
                <AlertTriangle :size="48" class="empty-icon" />
                <p>データを読み込んでから QA チェックを実行してください。</p>
              </div>
              <div v-else-if="!hasRunQa" class="empty-state">
                <ShieldCheck :size="48" class="empty-icon" style="color: var(--accent);" />
                <p>左パネルの「QAチェック実行」ボタンをクリックすると、数字・タグ・用語・整合性の検証結果がここに表示されます。</p>
                <button class="btn-qa-run" @click="doRunQa" style="margin-top: 16px; width: auto; padding: 8px 24px;">
                  QAチェック実行
                </button>
              </div>
              <div v-else class="qa-results-container">
                <!-- Summary Chips -->
                <div class="qa-summary-bar">
                  <div class="chip" :class="{ active: selectedIssueFilter === 'ALL' }" @click="selectedIssueFilter = 'ALL'">
                    <span>合計</span>
                    <strong>{{ qaIssues.length }}</strong>
                  </div>
                  <div class="chip chip-number" :class="{ active: selectedIssueFilter === 'Number' }" @click="selectedIssueFilter = 'Number'">
                    <span>数字 (Number)</span>
                    <strong>{{ qaCounts.Number }}</strong>
                  </div>
                  <div class="chip chip-tag" :class="{ active: selectedIssueFilter === 'Tag' }" @click="selectedIssueFilter = 'Tag'">
                    <span>タグ (Tag)</span>
                    <strong>{{ qaCounts.Tag }}</strong>
                  </div>
                  <div class="chip chip-term" :class="{ active: selectedIssueFilter === 'Term' }" @click="selectedIssueFilter = 'Term'">
                    <span>用語 (Term)</span>
                    <strong>{{ qaCounts.Term }}</strong>
                  </div>
                  <div class="chip chip-consistency" :class="{ active: selectedIssueFilter === 'Consistency' }" @click="selectedIssueFilter = 'Consistency'">
                    <span>整合性 (Consistency)</span>
                    <strong>{{ qaCounts.Consistency }}</strong>
                  </div>
                  <div class="chip chip-unmodifiedpe" :class="{ active: selectedIssueFilter === 'UnmodifiedPe' }" @click="selectedIssueFilter = 'UnmodifiedPe'">
                    <span>PE修正漏れ (UnmodifiedPe)</span>
                    <strong>{{ qaCounts.UnmodifiedPe }}</strong>
                  </div>
                </div>

                <!-- Issues Table / List -->
                <div v-if="qaIssues.length === 0" class="qa-pass-box">
                  <CheckCircle2 :size="32" style="color: var(--success);" />
                  <div>
                    <h4>すべてチェックをクリアしました！</h4>
                    <p>数字、タグ、用語集、100%一致行の整合性に不整合は見つかりませんでした。</p>
                  </div>
                </div>

                <div v-else class="qa-issue-list">
                  <div v-for="(issue, idx) in filteredQaIssues" :key="idx" class="qa-issue-card">
                    <div class="qa-issue-header">
                      <span class="issue-idx">行 {{ issue.idx }}</span>
                      <span :class="['issue-type-tag', issue.issue_type.toLowerCase()]">{{ issue.issue_type }}</span>
                      <span class="issue-msg">{{ issue.message }}</span>
                    </div>
                    <!-- 原文と訳文のプレビュー -->
                    <div class="qa-segment-preview" v-if="getUnitText(issue.idx)">
                      <div class="preview-row">
                        <span class="preview-lbl">原文:</span>
                        <span class="preview-text">{{ getUnitText(issue.idx)?.src }}</span>
                      </div>
                      <div class="preview-row">
                        <span class="preview-lbl">訳文:</span>
                        <span class="preview-text highlight">{{ getUnitText(issue.idx)?.tgt }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
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

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.card.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.card.full-height {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 120px);
}

.card-header {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}

.card-header h2 {
  font-size: 0.92rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
}

.drop-zone {
  border: 2px dashed var(--border);
  border-radius: var(--radius-sm);
  margin: 16px;
  padding: 24px 16px;
  text-align: center;
  cursor: pointer;
  transition: var(--transition);
}

.drop-zone:hover {
  border-color: var(--accent);
  background: var(--accent-glow);
}

.drop-icon {
  color: var(--text-muted);
  margin-bottom: 8px;
}

.drop-zone p {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0;
}

.loaded-info {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.loaded-label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--accent);
}

.loaded-count {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--text-primary);
}

.btn-clear-full {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: var(--error);
  border-radius: var(--radius-xs);
  font-size: 0.75rem;
  cursor: pointer;
  margin-top: 4px;
}

.btn-clear-full:hover {
  background: rgba(239, 68, 68, 0.2);
}

.action-list {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.qa-toggles {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--bg-secondary);
  padding: 12px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.btn-qa-run {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  background: var(--accent-gradient);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  transition: var(--transition);
}

.btn-qa-run:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-qa-run:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-title {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  margin: 0;
}

.action-grid {
  display: grid;
  gap: 6px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  color: var(--text-primary);
  font-size: 0.78rem;
  cursor: pointer;
  transition: var(--transition);
}

.action-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.input-row {
  display: flex;
  gap: 6px;
}

.flex-1 {
  flex: 1;
}

.input-sm {
  width: 70px;
  padding: 6px 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  color: var(--text-primary);
  font-size: 0.78rem;
}

.status-msg {
  padding: 8px 12px;
  border-radius: var(--radius-xs);
  font-size: 0.78rem;
  margin-top: 8px;
}

.status-msg.info { background: var(--bg-hover); color: var(--text-secondary); }
.status-msg.success { background: rgba(16, 185, 129, 0.1); color: var(--success); }
.status-msg.error { background: rgba(239, 68, 68, 0.1); color: var(--error); }

.viewer-area {
  min-width: 0;
}

.view-tabs {
  display: flex;
  gap: 8px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-xs);
  color: var(--text-muted);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
}

.tab-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.tab-btn.active {
  color: var(--accent);
  background: var(--accent-glow);
  border-color: var(--border-accent);
}

.tab-badge {
  font-size: 0.7rem;
  padding: 1px 6px;
  border-radius: 10px;
  font-weight: 700;
}

.tab-badge.badge-warn {
  background: var(--warning);
  color: black;
}

.tab-badge.badge-pass {
  background: var(--success);
  color: white;
}

.viewer-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: var(--text-muted);
}

.empty-icon {
  margin-bottom: 12px;
  opacity: 0.5;
}

/* QA Result Styles */
.qa-results-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.qa-summary-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  cursor: pointer;
  transition: var(--transition);
  color: var(--text-secondary);
}

.chip:hover {
  border-color: var(--accent);
}

.chip.active {
  background: var(--accent-glow);
  border-color: var(--border-accent);
  color: var(--accent-light);
}

.chip-number strong { color: #60a5fa; }
.chip-tag strong { color: #f59e0b; }
.chip-term strong { color: #a78bfa; }
.chip-consistency strong { color: #ec4899; }
.chip-unmodifiedpe strong { color: #f97316; }

.qa-pass-box {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: var(--radius-sm);
}

.qa-pass-box h4 {
  font-size: 1rem;
  color: var(--success);
  margin: 0 0 4px;
}

.qa-pass-box p {
  font-size: 0.82rem;
  color: var(--text-secondary);
  margin: 0;
}

.qa-issue-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.qa-issue-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.qa-issue-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.84rem;
}

.issue-idx {
  font-family: monospace;
  font-weight: 700;
  color: var(--text-muted);
  background: var(--bg-card);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--border);
}

.issue-type-tag {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
}

.issue-type-tag.number { background: rgba(96, 165, 250, 0.15); color: #60a5fa; }
.issue-type-tag.tag { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
.issue-type-tag.term { background: rgba(167, 139, 250, 0.15); color: #a78bfa; }
.issue-type-tag.consistency { background: rgba(236, 72, 153, 0.15); color: #ec4899; }
.issue-type-tag.unmodifiedpe { background: rgba(249, 115, 22, 0.15); color: #f97316; }

.issue-msg {
  color: var(--text-primary);
  font-size: 0.82rem;
}

.qa-segment-preview {
  background: var(--bg-card);
  padding: 8px 10px;
  border-radius: 4px;
  font-size: 0.78rem;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-row {
  display: flex;
  gap: 8px;
}

.preview-lbl {
  color: var(--text-muted);
  min-width: 32px;
}

.preview-text {
  color: var(--text-secondary);
  word-break: break-all;
}

.preview-text.highlight {
  color: var(--text-primary);
  font-weight: 500;
}
</style>
