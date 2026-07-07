<script setup lang="ts">
definePageMeta({
  title: '確率チェック',
  icon: 'percent',
})

import { ref } from 'vue'
import { Percent, Play, Trash2, CheckCircle, XCircle } from 'lucide-vue-next'
// Note: We avoid importing from vue-i18n for simple tools if not strictly required, 
// but we will use raw text if translation keys aren't defined.

const inputText = ref('')
const results = ref<any>(null)

const PATTERN = /(\d+(?:\.\d+)?)\s*(?:%|％)/g

const escapeHtml = (text: string): string => {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function getDecimalPlaces(value: string): number {
  if (!value.includes('.')) return 0
  return value.split('.')[1].length
}

function percentToScaledInt(value: string, scale: number): number {
  let [integer, decimal = ''] = value.split('.')
  decimal = decimal.padEnd(scale, '0')
  return parseInt(integer, 10) * (10 ** scale) + parseInt(decimal || '0', 10)
}

const runCheck = () => {
  if (!inputText.value.trim()) {
    results.value = null
    return
  }

  const text = inputText.value
  const matches = [...text.matchAll(PATTERN)]

  if (matches.length === 0) {
    results.value = {
      error: '確率表記（例: 10.5%、20%）が見つかりませんでした。'
    }
    return
  }

  const valuesStr = matches.map(m => m[1])
  const scale = Math.max(...valuesStr.map(v => getDecimalPlaces(v)))

  const scaledValues = valuesStr.map(v => percentToScaledInt(v, scale))
  const scaledTotal = scaledValues.reduce((a, b) => a + b, 0)

  const factor = 10 ** scale
  const expectedTotal = 100 * factor

  const escapedText = escapeHtml(text)
  const highlightedText = escapedText.replace(PATTERN, '<span class="highlight">$&</span>')

  results.value = {
    error: null,
    matches: matches.map(m => ({ text: m[0], value: parseFloat(m[1]) })),
    count: valuesStr.length,
    total: scaledTotal / factor,
    is100: scaledTotal === expectedTotal,
    difference: (scaledTotal - expectedTotal) / factor,
    highlightedText
  }
}

const clearAll = () => {
  inputText.value = ''
  results.value = null
}
</script>

<template>
  <div class="tool-view">
    <div class="tool-layout">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="card">
          <div class="card-header">
            <h2>確率チェック</h2>
          </div>
          <div class="action-list">
            <button class="btn primary" @click="runCheck" :disabled="!inputText">
              <Play :size="18" /> チェック実行
            </button>
            <button class="btn outline" @click="clearAll" :disabled="!inputText">
              <Trash2 :size="18" /> クリア
            </button>
          </div>
          <div class="alert-info" style="margin: 20px;">
            テキスト内の「数字＋%」または「数字＋％」を自動抽出し、合計が正確に100%になるか検証します。
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <div class="main-content">
        <div class="card input-card">
          <div class="card-header">
            <h3>検証テキストを入力</h3>
          </div>
          <textarea v-model="inputText" class="diff-textarea" placeholder="ガチャの提供割合などのテキストを貼り付けてください..."></textarea>
        </div>

        <div class="card result-card" v-if="results">
          <div class="card-header space-between">
            <h2>検証結果</h2>
          </div>
          <div class="result-body">
            <div v-if="results.error" class="error-msg">
              {{ results.error }}
            </div>
            <div v-else>
              <div class="summary-box compact" :class="results.is100 ? 'pass' : 'fail'">
                <div class="status-icon">
                  <CheckCircle v-if="results.is100" :size="24" />
                  <XCircle v-else :size="24" />
                </div>
                <div class="status-text-compact">
                  <h3 v-if="results.is100">PASS: 合計 100%</h3>
                  <h3 v-else>FAIL: 合計が 100% ではありません</h3>
                  
                  <div class="details-compact">
                    <span>抽出: <strong>{{ results.count }}</strong> 件</span>
                    <span class="divider">|</span>
                    <span>計算合計: <strong>{{ results.total }}%</strong></span>
                    <template v-if="!results.is100">
                      <span class="divider">|</span>
                      <span class="diff-text">
                        差分: <strong>{{ results.difference > 0 ? '+' : '' }}{{ results.difference }}%</strong>
                      </span>
                    </template>
                  </div>
                </div>
              </div>

              <div class="highlighted-text-section">
                <h4 class="matches-title">入力テキスト（ハイライト）</h4>
                <div class="highlighted-text" v-html="results.highlightedText"></div>
              </div>

              <h4 class="matches-title">抽出された値一覧</h4>
              <ul class="match-list">
                <li v-for="(match, idx) in results.matches" :key="idx">
                  <span class="match-text">{{ match.text }}</span>
                  <span class="match-value">{{ match.value }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tool-view {
  padding: 24px;
}

.tool-layout {
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

.alert-info {
  padding: 12px;
  background: rgba(59, 130, 246, 0.05);
  border: 1px solid rgba(59, 130, 246, 0.1);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 0.8rem;
  line-height: 1.5;
}

.main-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.input-card {
  height: 300px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.diff-textarea {
  flex: 1;
  width: 100%;
  padding: 20px;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 0.95rem;
  line-height: 1.6;
  resize: none;
  outline: none;
}

.result-card {
  flex: 1;
}

.result-body {
  padding: 24px;
}

.error-msg {
  color: var(--error, #ef4444);
  background: rgba(239, 68, 68, 0.1);
  padding: 16px;
  border-radius: 8px;
  text-align: center;
  font-weight: bold;
}

.summary-box.compact {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  border-radius: 8px;
  margin-bottom: 24px;
}

.summary-box.pass {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #059669;
}
.summary-box.pass .status-icon {
  color: #10b981;
}

.summary-box.fail {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #b91c1c;
}
.summary-box.fail .status-icon {
  color: #ef4444;
}

.status-text-compact {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.status-text-compact h3 {
  font-size: 1.1rem;
  margin: 0;
}

.details-compact {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.95rem;
}

.divider {
  color: var(--border, #d1d5db);
}

.diff-text {
  color: #ef4444;
  font-weight: bold;
}

.highlighted-text-section {
  margin-bottom: 24px;
}

.highlighted-text {
  white-space: pre-wrap;
  word-break: break-all;
  background: var(--bg-hover, #f9fafb);
  border: 1px solid var(--border, #e5e7eb);
  padding: 16px;
  border-radius: 8px;
  font-family: 'Inter', monospace;
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--text-secondary);
  max-height: 200px;
  overflow-y: auto;
}

:deep(.highlight) {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  font-weight: 700;
  padding: 0 4px;
  border-radius: 4px;
}

.matches-title {
  font-size: 1.1rem;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border, #e5e7eb);
  color: var(--text-primary);
}

.match-list {
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.match-list li {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-hover, #f3f4f6);
  border-radius: 6px;
  font-size: 0.9rem;
}

.match-text {
  color: var(--text-muted);
}

.match-value {
  font-weight: bold;
  color: var(--text-primary);
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
</style>
