<script setup lang="ts">
definePageMeta({
  title: '一括差分',
  icon: 'diff',
})

import { ref, computed } from 'vue'
import { Split, Play, Trash2, Import, FileText, CheckCircle, AlertCircle } from 'lucide-vue-next'
import { useDiffStore } from '../../stores/diffStore'

const store = useDiffStore()
const isChecked = ref(false)
const errorMsg = ref('')

const srcLines = computed(() => store.srcText.split('\n').filter(l => l !== '').length)
const tgtLines = computed(() => store.tgtText.split('\n').filter(l => l !== '').length)

const handleImport = () => {
  const success = store.importFromShuttle()
  if (success) {
    errorMsg.value = ''
  } else {
    errorMsg.value = 'パーサーにデータがありません。'
  }
}

const runCheck = () => {
  errorMsg.value = ''
  // 行数が極端に違う場合の警告（空行等でズレる可能性があるため）
  if (store.srcText.split('\n').length !== store.tgtText.split('\n').length) {
    if (!confirm('左右で行数が異なります。ズレが発生する可能性がありますが、実行しますか？')) {
      return
    }
  }

  store.batchCheck()
  isChecked.value = true
}

const clearAll = () => {
  store.clear()
  isChecked.value = false
  errorMsg.value = ''
}
</script>

<template>
  <div class="batch-view">
    <div class="batch-layout">
      <!-- Sidebar: Controls -->
      <aside class="sidebar">
        <div class="card">
          <div class="card-header">
            <h2>一括差分ツール</h2>
          </div>
          <div class="action-list">
            <button class="btn primary" @click="runCheck" :disabled="!store.srcText && !store.tgtText">
              <Play :size="18" /> 差分を確認
            </button>

            <button class="btn secondary" @click="handleImport">
              <Import :size="18" /> パーサーから読み込む
            </button>

            <button class="btn outline" @click="clearAll">
              <Trash2 :size="18" /> クリア
            </button>
          </div>

          <div class="stats-box" v-if="srcLines || tgtLines">
            <div class="stat-item">
              <span class="stat-label">旧テキスト:</span>
              <span class="stat-value">{{ srcLines }} lines</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">新テキスト:</span>
              <span class="stat-value">{{ tgtLines }} lines</span>
            </div>
          </div>
        </div>

        <div class="alert-info">
          <AlertCircle :size="16" />
          <p>左右の行を1対1で比較します。Excelからの貼り付け時にセル内改行が含まれないようご注意ください。</p>
        </div>
      </aside>

      <!-- Main Content -->
      <div class="main-content">
        <!-- Input Area -->
        <div class="input-grid" v-if="!isChecked">
          <div class="card">
            <div class="card-header">
              <h3>旧テキスト (Old)</h3>
            </div>
            <textarea v-model="store.srcText" class="diff-textarea" placeholder="比較元のテキストを貼り付け"></textarea>
          </div>
          <div class="card">
            <div class="card-header">
              <h3>新テキスト (New)</h3>
            </div>
            <textarea v-model="store.tgtText" class="diff-textarea" placeholder="比較先のテキストを貼り付け"></textarea>
          </div>
        </div>

        <!-- Result Area -->
        <div class="card result-card" v-else>
          <div class="card-header space-between">
            <h2>比較結果 ({{ store.batchDiff.length }} 件の差異)</h2>
            <button class="btn-sm" @click="isChecked = false">
              <FileText :size="14" /> 入力を編集
            </button>
          </div>
          <div class="table-container">
            <table class="diff-table">
              <thead>
                <tr>
                  <th class="w-idx">No.</th>
                  <th class="w-text">旧 (Old)</th>
                  <th class="w-text">新 (New)</th>
                  <th class="w-diff">比較結果</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, idx) in store.batchDiff" :key="idx">
                  <td class="idx">{{ idx + 1 }}</td>
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
}

.diff-rendered {
  line-height: 1.6;
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
</style>
