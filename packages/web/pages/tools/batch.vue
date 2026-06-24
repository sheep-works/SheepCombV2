<script setup lang="ts">
definePageMeta({
  title: '一括差分',
  icon: 'diff',
})

import { ref, computed } from 'vue'
import { Split, Play, Trash2, Import, FileText, CheckCircle, AlertCircle, Download } from 'lucide-vue-next'
import { useDiffStore } from '../../stores/diffStore'
import { useI18n } from 'vue-i18n'

const store = useDiffStore()
const { t } = useI18n()
const isChecked = ref(false)
const errorMsg = ref('')
const showAllLines = ref(false)

const srcLines = computed(() => store.srcText.split('\n').filter(l => l !== '').length)
const tgtLines = computed(() => store.tgtText.split('\n').filter(l => l !== '').length)

const filteredDiff = computed(() => {
  if (showAllLines.value) {
    return store.batchDiff
  } else {
    return store.batchDiff.filter(item => item.hasDiff)
  }
})

const diffCount = computed(() => store.batchDiff.filter(item => item.hasDiff).length)

const handleImport = () => {
  const success = store.importFromShuttle()
  if (success) {
    errorMsg.value = ''
  } else {
    errorMsg.value = t('tools.batch.err_no_data')
  }
}

const runCheckLines = () => {
  errorMsg.value = ''
  // 行数が極端に違う場合の警告（空行等でズレる可能性があるため）
  if (store.srcText.split('\n').length !== store.tgtText.split('\n').length) {
    if (!confirm(t('tools.batch.confirm_diff_lines'))) {
      return
    }
  }

  store.batchCheck()
  isChecked.value = true
}

const runCheckBlock = () => {
  errorMsg.value = ''
  store.batchCheckBlock()
  isChecked.value = true
}

const clearAll = () => {
  store.clear()
  isChecked.value = false
  errorMsg.value = ''
  showAllLines.value = false
}

const escapeHtml = (text: string): string => {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const downloadHtml = () => {
  const items = filteredDiff.value
  if (items.length === 0) return

  let htmlContent = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${t('tools.batch.html_title')}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 24px;
      color: #1a1a1a;
      background-color: #fcfcfc;
    }
    h2 {
      font-size: 1.5rem;
      margin-bottom: 16px;
      color: #111;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      border-radius: 4px;
      overflow: hidden;
    }
    th, td {
      border: 1px solid #e1e4e8;
      padding: 12px 16px;
      text-align: left;
      font-size: 14px;
      vertical-align: top;
      word-break: break-all;
    }
    th {
      background-color: #f6f8fa;
      font-weight: 600;
      color: #57606a;
    }
    tr:nth-child(even) {
      background-color: #fafbfc;
    }
    ins {
      background-color: #dafbe1;
      color: #1a7f37;
      text-decoration: none;
      padding: 2px 4px;
      border-radius: 2px;
    }
    del {
      background-color: #ffebe9;
      color: #cf222e;
      text-decoration: line-through;
      padding: 2px 4px;
      border-radius: 2px;
    }
  </style>
</head>
<body>
  <h2>${t('tools.batch.html_header', { count: items.filter(item => item.hasDiff).length })}</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 30%;">${t('tools.batch.html_th_old')}</th>
        <th style="width: 30%;">${t('tools.batch.html_th_new')}</th>
        <th style="width: 40%;">${t('tools.batch.html_th_diff')}</th>
      </tr>
    </thead>
    <tbody>
`

  for (const item of items) {
    const escapedSrc = escapeHtml(item.s)
    const escapedTgt = escapeHtml(item.t)
    htmlContent += `      <tr>
        <td>${escapedSrc}</td>
        <td>${escapedTgt}</td>
        <td>${item.d}</td>
      </tr>\n`
  }

  htmlContent += `    </tbody>
  </table>
</body>
</html>`

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'diff_results.html')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="batch-view">
    <div class="batch-layout">
      <!-- Sidebar: Controls -->
      <aside class="sidebar">
        <div class="card">
          <div class="card-header">
            <h2>{{ $t('tools.batch.title_tool') }}</h2>
          </div>
          <div class="action-list">
            <button class="btn primary" @click="runCheckBlock" :disabled="!store.srcText && !store.tgtText">
              <Play :size="18" /> {{ $t('tools.batch.btn_check_block') }}
            </button>
            <button class="btn outline" @click="runCheckLines" :disabled="!store.srcText && !store.tgtText">
              <Split :size="18" /> {{ $t('tools.batch.btn_check_lines') }}
            </button>

            <button class="btn secondary" @click="handleImport">
              <Import :size="18" /> {{ $t('tools.batch.btn_import') }}
            </button>

            <button class="btn outline" @click="clearAll">
              <Trash2 :size="18" /> {{ $t('tools.batch.btn_clear') }}
            </button>

            <div class="result-settings" v-if="isChecked">
              <div class="filter-divider"></div>
              <label class="checkbox-label">
                <input type="checkbox" v-model="showAllLines" />
                <span>{{ $t('tools.batch.lbl_show_all') }}</span>
              </label>

              <button class="btn-outline-action" @click="downloadHtml">
                <Download :size="14" /> {{ $t('tools.batch.btn_download_html') }}
              </button>
            </div>
          </div>

          <div class="stats-box" v-if="srcLines || tgtLines">
            <div class="stat-item">
              <span class="stat-label">{{ $t('tools.batch.lbl_old_text') }}</span>
              <span class="stat-value">{{ $t('tools.batch.lines', { count: srcLines }) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">{{ $t('tools.batch.lbl_new_text') }}</span>
              <span class="stat-value">{{ $t('tools.batch.lines', { count: tgtLines }) }}</span>
            </div>
          </div>
        </div>

        <div class="alert-info">
          <AlertCircle :size="16" />
          <p>{{ $t('tools.batch.alert_hint') }}</p>
        </div>
      </aside>

      <!-- Main Content -->
      <div class="main-content">
        <!-- Input Area -->
        <div class="input-grid" v-if="!isChecked">
          <div class="card">
            <div class="card-header">
              <h3>{{ $t('tools.batch.title_old') }}</h3>
            </div>
            <textarea v-model="store.srcText" class="diff-textarea" :placeholder="$t('tools.batch.placeholder_old')"></textarea>
          </div>
          <div class="card">
            <div class="card-header">
              <h3>{{ $t('tools.batch.title_new') }}</h3>
            </div>
            <textarea v-model="store.tgtText" class="diff-textarea" :placeholder="$t('tools.batch.placeholder_new')"></textarea>
          </div>
        </div>

        <!-- Result Area -->
        <div class="card result-card" v-else>
          <div class="card-header space-between">
            <h2>{{ $t('tools.batch.title_result', { count: diffCount }) }}</h2>
            <button class="btn-sm" @click="isChecked = false">
              <FileText :size="14" /> {{ $t('tools.batch.btn_edit_input') }}
            </button>
          </div>
          <div class="table-container">
            <table class="diff-table">
              <thead>
                <tr>
                  <th class="w-idx">No.</th>
                  <th class="w-text">{{ $t('tools.batch.html_th_old') }}</th>
                  <th class="w-text">{{ $t('tools.batch.html_th_new') }}</th>
                  <th class="w-diff">{{ $t('tools.batch.th_result') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, idx) in filteredDiff" :key="idx">
                  <td class="idx">{{ item.lineNo }}</td>
                  <td class="text-source">{{ item.s }}</td>
                  <td class="text-source">{{ item.t }}</td>
                  <td class="text-diff">
                    <div v-html="item.d" class="diff-rendered"></div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Error Toast -->
    <Transition name="slide-up">
      <div class="error-toast" v-if="errorMsg">
        <AlertCircle :size="18" />
        <span>{{ errorMsg }}</span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.batch-view {
  padding: 24px;
}

.batch-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 24px;
  align-items: start;
}

.action-list {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stats-box {
  margin: 0 20px 20px;
  padding: 12px;
  background: var(--bg-hover);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
}

.stat-label {
  color: var(--text-muted);
}

.stat-value {
  color: var(--accent);
  font-weight: 700;
}

.alert-info {
  margin-top: 16px;
  padding: 12px;
  background: rgba(59, 130, 246, 0.05);
  border: 1px solid rgba(59, 130, 246, 0.1);
  border-radius: var(--radius-sm);
  display: flex;
  gap: 10px;
  color: var(--text-secondary);
  font-size: 0.75rem;
}

.input-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  height: calc(100vh - 140px);
}

.diff-textarea {
  width: 100%;
  height: 100%;
  padding: 20px;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-family: 'Inter', monospace;
  font-size: 0.85rem;
  line-height: 1.6;
  resize: none;
  outline: none;
}

.result-card {
  height: calc(100vh - 140px);
}

.table-container {
  overflow: auto;
  flex: 1;
}

.diff-table {
  width: 100%;
  border-collapse: collapse;
}

.diff-table th {
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

.diff-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  font-size: 0.85rem;
  vertical-align: top;
}

.w-idx {
  width: 50px;
}

.w-text {
  width: 30%;
}

.w-diff {
  width: 40%;
}

.idx {
  color: var(--text-muted);
  font-size: 0.75rem;
}

.text-source {
  color: var(--text-secondary);
  word-break: break-all;
  white-space: pre-wrap;
}

.diff-rendered {
  line-height: 1.6;
  white-space: pre-wrap;
}

/* diff tags style - standard for the app */
:deep(ins) {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  text-decoration: none;
  padding: 0 2px;
  border-radius: 2px;
}

:deep(del) {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  text-decoration: line-through;
  padding: 0 2px;
  border-radius: 2px;
}

.error-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: var(--error);
  color: white;
  padding: 12px 24px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

.btn-sm {
  padding: 6px 12px;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  font-size: 0.75rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}

.space-between {
  justify-content: space-between;
}

.filter-divider {
  height: 1px;
  background: var(--border);
  margin: 12px 0;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--text-secondary);
  cursor: pointer;
  margin-bottom: 12px;
}

.checkbox-label input {
  accent-color: var(--accent);
}

.result-settings {
  margin-top: 8px;
}

.btn-outline-action {
  width: 100%;
  background: none;
  border: 1px solid var(--accent);
  color: var(--accent);
  padding: 10px;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-outline-action:hover {
  background: var(--accent-glow);
}
</style>
