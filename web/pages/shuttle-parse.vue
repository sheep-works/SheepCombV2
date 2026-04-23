<script setup lang="ts">
definePageMeta({
  title: '構造化',
  icon: 'layers',
})

import { ref, computed } from 'vue'
import { FileUp, Trash2, Play, FileText, CheckCircle, AlertCircle, Layers } from 'lucide-vue-next'
// Note: Using relative paths instead of Nuxt aliases (~~, ~, @) to ensure stable resolution.
import { useShuttleStore } from '../stores/shuttleStore'
import { SheepShuttle } from '../../logic/shuttle/sheepShuttle.js'
import { FileIO } from '../utils/fileIO'

const store = useShuttleStore()
const router = useRouter()

const fileInput = ref<HTMLInputElement | null>(null)
const selectedFiles = ref<File[]>([])
const isProcessing = ref(false)
const statusMsg = ref({ text: '', type: 'info' as 'info' | 'success' | 'error' })

const hasUnitsInStore = computed(() => store.unitCount > 0)
const hasFiles = computed(() => selectedFiles.value.length > 0)

// --- ファイル読み込み（直接構造化する場合用） ---
function addFiles(files: File[]) {
  const validExtensions = ['.xlf', '.xliff', '.mxliff', '.sdlxliff', '.mqxliff', '.tmx', '.tbx', '.xlsx', '.csv', '.json', '.jsonl']
  const newFiles = files.filter(f => {
    const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase()
    return validExtensions.includes(ext)
  })
  selectedFiles.value = [...selectedFiles.value, ...newFiles]
}

const handleFileDrop = (e: DragEvent) => { e.preventDefault(); if (e.dataTransfer?.files) addFiles(Array.from(e.dataTransfer.files)) }
const handleFileSelect = (e: Event) => { const target = e.target as HTMLInputElement; if (target.files) addFiles(Array.from(target.files)) }
function removeFile(index: number) { selectedFiles.value.splice(index, 1) }
function clearFiles() { selectedFiles.value = []; statusMsg.value = { text: '', type: 'info' } }

/**
 * 構造化を実行
 */
async function doConvert() {
  try {
    isProcessing.value = true
    statusMsg.value = { text: '構造化を実行中...', type: 'info' }

    // ファイルが選択されている場合はまずパース
    if (selectedFiles.value.length > 0) {
      const filesWithContent = await Promise.all(selectedFiles.value.map(async file => {
        const ext = file.name.split('.').pop()?.toLowerCase() || ''
        const isBinary = ['xlsx', 'docx'].includes(ext)
        const isText = ['xlf', 'xliff', 'mxliff', 'sdlxliff', 'mqxliff', 'tmx', 'tbx', 'csv', 'tsv', 'json', 'jsonl'].includes(ext)
        const content = isText ? await file.text() : await file.arrayBuffer()
        return { name: file.name, content: content as any }
      }))
      await store.parseFiles(filesWithContent)
    }

    if (!store.hasUnits) {
      throw new Error('構造化するユニットがありません。解析ページでファイルを読み込んでください。')
    }

    // 構造化（ShWvData への変換）実行
    store.convert()

    statusMsg.value = { text: '構造化完了！解析ページに移動します。', type: 'success' }
    setTimeout(() => {
      router.push('/shuttle-analyze')
    }, 800)

  } catch (e: any) {
    console.error('Convert error:', e)
    statusMsg.value = { text: `エラー: ${e.message}`, type: 'error' }
  } finally {
    isProcessing.value = false
  }
}
</script>

<template>
  <div class="parse-view">
    <div class="content-card">
      <div class="card-header">
        <div class="header-main">
          <Layers :size="24" class="header-icon" />
          <div class="header-text">
            <h1>構造化 (Structuring)</h1>
            <p>解析済みのユニットを統合し、構造化データを作成します</p>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn-clear" @click="clearFiles" :disabled="!hasFiles || isProcessing">
            <Trash2 :size="16" /> クリア
          </button>
        </div>
      </div>

      <!-- ストアの状態表示 -->
      <div class="store-status" v-if="hasUnitsInStore">
        <div class="status-badge">
          <CheckCircle :size="16" />
          <span>解析済みユニット: {{ store.unitCount }} 件</span>
        </div>
        <p class="status-desc">これらのユニットを一つのプロジェクトデータに統合します。</p>
      </div>

      <div class="drop-zone" v-if="!hasUnitsInStore" @drop="handleFileDrop" @dragover.prevent
        @click="fileInput?.click()">
        <FileUp :size="48" class="drop-icon" />
        <p class="drop-text">追加でファイルを読み込む</p>
        <p class="drop-hint">XLIFF, TMX, TBX, XLSX, CSV 等をサポート</p>
        <input type="file" ref="fileInput" hidden multiple @change="handleFileSelect" />
      </div>

      <div v-if="hasFiles" class="file-list-section">
        <h2 class="section-title">追加ファイル ({{ selectedFiles.length }})</h2>
        <div class="file-list">
          <div v-for="(file, index) in selectedFiles" :key="index" class="file-item">
            <div class="file-info">
              <FileText :size="18" class="file-icon" />
              <span class="file-name">{{ file.name }}</span>
              <span class="file-size">{{ (file.size / 1024).toFixed(1) }} KB</span>
            </div>
            <button class="btn-remove" @click.stop="removeFile(index)" :disabled="isProcessing">
              <Trash2 :size="14" />
            </button>
          </div>
        </div>
      </div>

      <div class="action-footer">
        <div v-if="statusMsg.text" :class="['status-box', statusMsg.type]">
          <CheckCircle v-if="statusMsg.type === 'success'" :size="18" />
          <AlertCircle v-else-if="statusMsg.type === 'error'" :size="18" />
          <span>{{ statusMsg.text }}</span>
        </div>
        <div v-else-if="!hasUnitsInStore && !hasFiles" class="status-box info">
          <AlertCircle :size="18" />
          <span>解析ページでファイルを読み込んでください</span>
        </div>

        <button class="btn-run" @click="doConvert" :disabled="isProcessing || (!hasUnitsInStore && !hasFiles)">
          <Play v-if="!isProcessing" :size="18" />
          <span v-else class="loader"></span>
          {{ isProcessing ? '実行中...' : '構造化を実行' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.parse-view {
  padding: 32px;
  max-width: 1000px;
  margin: 0 auto;
}

.content-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
}

.card-header {
  padding: 24px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon {
  color: var(--accent);
}

.header-text h1 {
  font-size: 1.25rem;
  font-weight: 800;
  margin: 0;
  color: var(--text-primary);
}

.header-text p {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin: 4px 0 0;
}

.drop-zone {
  margin: 24px;
  padding: 60px 40px;
  border: 2px dashed var(--border);
  border-radius: var(--radius-sm);
  text-align: center;
  cursor: pointer;
  transition: var(--transition);
  background: rgba(255, 255, 255, 0.02);
}

.drop-zone:hover {
  border-color: var(--accent);
  background: var(--accent-glow);
}

.drop-icon {
  margin-bottom: 16px;
  color: var(--text-muted);
  opacity: 0.5;
}

.drop-text {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 0;
}

.drop-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 8px 0 0;
}

.file-list-section {
  padding: 0 24px 24px;
}

.section-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 24px;
}

.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  transition: var(--transition);
}

.file-item:hover {
  border-color: var(--border-hover);
}

.file-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-icon {
  color: var(--text-muted);
}

.file-name {
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--text-primary);
}

.file-size {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.btn-remove,
.btn-clear {
  background: none;
  border: none;
  color: var(--error);
  cursor: pointer;
  opacity: 0.6;
  transition: var(--transition);
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-remove:hover,
.btn-clear:hover {
  opacity: 1;
}

.btn-clear {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 6px 12px;
  border: 1px solid transparent;
  border-radius: 4px;
}

.btn-clear:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: var(--error);
}

.action-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  border-top: 1px solid var(--border);
  padding-top: 24px;
  margin: 0 24px 24px;
}

.status-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.88rem;
  font-weight: 500;
  padding: 10px 16px;
  border-radius: var(--radius-sm);
}

.status-box.info {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.status-box.success {
  background: rgba(16, 185, 129, 0.1);
  color: var(--success);
}

.status-box.error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error);
}

.btn-run {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px 32px;
  background: var(--accent-gradient);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: var(--transition);
  box-shadow: 0 4px 12px var(--accent-glow);
}

.btn-run:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px var(--accent-glow);
}

.btn-run:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(1);
}

.loader {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Structuring Specific Styles */
.store-status {
  margin: 24px;
  padding: 20px;
  background: var(--bg-hover);
  border-radius: var(--radius-sm);
  border-left: 4px solid var(--accent);
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--accent);
  font-weight: 700;
  font-size: 1rem;
  margin-bottom: 4px;
}

.status-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
}
</style>
