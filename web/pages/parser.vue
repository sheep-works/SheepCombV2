<script setup lang="ts">
/**
 * web/pages/parser.vue
 * Port of Parser tools to the Web UI.
 */
definePageMeta({
  title: 'Parser',
  icon: 'database',
})

import { ref, computed } from 'vue'
import { FileUp, Search, Download, Database, Trash2, Loader2 } from 'lucide-vue-next'
// Note: Using relative paths instead of Nuxt aliases (~~, ~, @) to ensure stable resolution.
import { useParserStore } from '../stores/parserStore'
import { SheepShuttle } from '../../logic/shuttle/sheepShuttle.js'
import type { TranslationPair } from '../../logic/types/shwv.js'
import { FileIO } from '../utils/fileIO'


const store = useParserStore()
const fileInput = ref<HTMLInputElement | null>(null)
const isProcessing = ref(false)
const statusMsg = ref({ text: '', type: 'info' as 'info' | 'success' | 'error' })

const selectedFiles = ref<File[]>([])

const handleFileDrop = (e: DragEvent) => {
  e.preventDefault()
  if (e.dataTransfer?.files) {
    selectedFiles.value = Array.from(e.dataTransfer.files)
  }
}

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files) {
    selectedFiles.value = Array.from(target.files)
  }
}

const clearFiles = () => {
  selectedFiles.value = []
  store.clear()
  statusMsg.value = { text: '', type: 'info' }
}

const parseFiles = async () => {
  if (selectedFiles.value.length === 0) return

  try {
    isProcessing.value = true
    statusMsg.value = { text: '解析中...', type: 'info' }

    const shuttle = new SheepShuttle()
    const files = await Promise.all(selectedFiles.value.map(async file => ({
      name: file.name,
      content: await file.arrayBuffer()
    })))
    
    const result = await shuttle.parser.parse(files)
    // Filter the units through processor if needed, but for raw parsing, we can just use the units
    const filtered = shuttle.processor.filter(result.units)

    store.setSegments(filtered)
    statusMsg.value = { text: '解析が完了しました', type: 'success' }
  } catch (e: any) {
    console.error('Parse error:', e)
    statusMsg.value = { text: `エラー: ${e.message}`, type: 'error' }
  } finally {
    isProcessing.value = false
  }
}

const exportResults = (format: 'json' | 'csv') => {
  if (!store.hasSegments) return
  if (format === 'json') {
    FileIO.downloadJson(store.segments, 'parsed_results.json')
  } else {
    const csv = FileIO.toCsv(store.segments)
    FileIO.downloadCsv(csv, 'parsed_results.csv')
  }
}


</script>

<template>
  <div class="parser-view">
    <div class="parser-layout">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="card upload-section">
          <div class="card-header">
            <h2>ファイルアップロード</h2>
          </div>
          <div class="drop-zone" @drop="handleFileDrop" @dragover.prevent @click="fileInput?.click()">
            <FileUp :size="24" class="drop-icon" />
            <p v-if="selectedFiles.length === 0">ファイルをドラッグ＆ドロップ</p>
            <p v-else class="file-count">{{ selectedFiles.length }} 個を選択中</p>
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

        <div class="card actions" :class="{ disabled: selectedFiles.length === 0 || isProcessing }">
          <div class="card-header">
            <h2>アクション</h2>
          </div>
          <p class="hint-text">各ファイルを順次解析し、一つのリストに統合します。</p>
          <button class="btn primary" @click="parseFiles" :disabled="selectedFiles.length === 0 || isProcessing">
            <Loader2 v-if="isProcessing" class="spin" :size="18" />
            <span v-else>解析を実行</span>
          </button>
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
              <h2>解析結果</h2>
              <span class="badge" v-if="store.hasSegments">
                {{ store.segmentCount }} segments
              </span>
            </div>
            <div class="export-actions" v-if="store.hasSegments">
              <button class="btn-outline" @click="exportResults('csv')">
                <Download :size="14" /> CSV
              </button>
              <button class="btn-outline" @click="exportResults('json')">
                <Database :size="14" /> JSON
              </button>
            </div>
          </div>

          <div class="table-container" v-if="store.hasSegments">
            <table>
              <thead>
                <tr>
                  <th class="w-10">#</th>
                  <th>Source</th>
                  <th>Target</th>
                  <th v-if="store.segments.some((s: TranslationPair) => s.note)">Note</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(seg, idx) in store.segments" :key="idx">
                  <td class="idx">{{ idx + 1 }}</td>
                  <td class="text">{{ seg.src }}</td>
                  <td class="text">{{ seg.tgt }}</td>
                  <td class="note" v-if="store.segments.some((s: TranslationPair) => s.note)">
                    {{ seg.note }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="empty-state" v-else>
            <Search :size="48" class="empty-icon" />
            <p>ファイルをロードして解析を開始してください</p>
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

/* Cards */
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

.card-header.space-between {
  justify-content: space-between;
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
  padding: 28px;
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
  margin-bottom: 8px;
  opacity: 0.5;
}

.drop-zone p {
  font-size: 0.8rem;
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

/* Actions */
.actions {
  padding: 0 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px;
  border-radius: var(--radius-sm);
  border: none;
  font-weight: 600;
  font-size: 0.82rem;
  cursor: pointer;
  transition: var(--transition);
  font-family: 'Inter', sans-serif;
}

.btn.primary {
  background: var(--accent);
  color: #fff;
}

.btn.primary:hover:not(:disabled) {
  background: var(--accent-hover);
  box-shadow: var(--shadow-glow);
}

.btn.warning {
  background: var(--warning);
  color: #000;
}

.btn.warning:hover:not(:disabled) {
  background: #fbbf24;
}

.btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
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

.card.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.hint-text {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-align: center;
  margin-bottom: 10px;
}

/* Results */
.title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.badge {
  font-size: 0.68rem;
  padding: 2px 10px;
  background: var(--bg-primary);
  border-radius: var(--radius-full);
  color: var(--text-muted);
  font-weight: 600;
}

.export-actions {
  display: flex;
  gap: 6px;
}

.btn-outline {
  display: flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 4px 12px;
  border-radius: var(--radius-xs);
  font-size: 0.72rem;
  cursor: pointer;
  transition: var(--transition);
  font-family: 'Inter', sans-serif;
}

.btn-outline:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.table-container {
  flex: 1;
  overflow: auto;
}
</style>
