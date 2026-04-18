<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { FileUp, Book, Search, CheckCircle, Download, Database, Loader2, Trash2 } from 'lucide-vue-next'
import { initWasm, getWasm } from './logic/wasm'
import { parseXliff, parseTmx, parseXlsx, parseDocx, type Segment, stripTags } from './logic/parsers'

const srcInput = ref<HTMLInputElement | null>(null)
const tmInput = ref<HTMLInputElement | null>(null)
const isWasmReady = ref(false)
const isLoading = ref(false)
const statusMsg = ref({ text: '', type: 'info' })

const srcFiles = ref<File[]>([])
const tmFiles = ref<File[]>([])
const segments = ref<Segment[]>([])
const isMatched = ref(false)

// --- Lifecycle ---
onMounted(async () => {
  try {
    statusMsg.value = { text: 'WASM Runtime を初期化中...', type: 'info' }
    await initWasm()
    isWasmReady.value = true
    statusMsg.value = { text: '準備完了', type: 'success' }
  } catch (e) {
    statusMsg.value = { text: 'WASM の初期化に失敗しました', type: 'error' }
  }
})

// --- Handlers ---
const handleFileDrop = (e: DragEvent, type: 'src' | 'tm') => {
  e.preventDefault()
  const files = Array.from(e.dataTransfer?.files || [])
  if (type === 'src') srcFiles.value = files
  else tmFiles.value = [...tmFiles.value, ...files]
}

const handleFileSelect = (e: Event, type: 'src' | 'tm') => {
  const target = e.target as HTMLInputElement
  const files = Array.from(target.files || [])
  if (type === 'src') srcFiles.value = files
  else tmFiles.value = [...tmFiles.value, ...files]
}

const clearFiles = (type: 'src' | 'tm') => {
  if (type === 'src') srcFiles.value = []
  else tmFiles.value = []
}

const readFile = async (file: File): Promise<Segment[]> => {
  const ext = file.name.split('.').pop()?.toLowerCase()
  const arrayBuffer = await file.arrayBuffer()
  
  if (['xlf', 'xliff', 'mxliff', 'mqxliff', 'sdlxliff'].includes(ext!)) {
    const text = new TextDecoder().decode(arrayBuffer)
    return parseXliff(text)
  } else if (ext === 'tmx') {
    const text = new TextDecoder().decode(arrayBuffer)
    return parseTmx(text)
  } else if (ext === 'xlsx') {
    return parseXlsx(arrayBuffer)
  } else if (ext === 'docx') {
    return parseDocx(arrayBuffer)
  }
  return []
}

const execParse = async () => {
  if (srcFiles.value.length === 0) return
  isLoading.value = true
  statusMsg.value = { text: '解析中...', type: 'info' }
  
  try {
    let all: Segment[] = []
    for (const f of srcFiles.value) {
      all = [...all, ...(await readFile(f))]
    }
    segments.value = all
    statusMsg.value = { text: `抽出完了: ${all.length} 件`, type: 'success' }
  } catch (e: any) {
    statusMsg.value = { text: `エラー: ${e.message}`, type: 'error' }
  } finally {
    isLoading.value = false
  }
}

const execConsistency = async () => {
  if (segments.value.length === 0) return
  
  isLoading.value = true
  statusMsg.value = { text: 'ゆれチェック計算中 (WASM)...', type: 'info' }
  
  try {
    const wasm = getWasm()
    // 常に現在の segments.value を対象にする
    const input = segments.value.map((s, i) => ({
      idx: i,
      src: stripTags(s.src),
      tgt: stripTags(s.tgt)
    }))
    
    const groups = wasm.get_consistency_groups(input, 80.0)
    
    const flat: Segment[] = []
    groups.forEach((group: any[], i: number) => {
      group.forEach(item => {
        const original = segments.value[item.idx]
        flat.push({
          ...original,
          note: `${original.note || ''} [Group ${i + 1}]`.trim()
        })
      })
    })
    
    segments.value = flat
    statusMsg.value = { text: `ゆれチェック完了: ${groups.length} グループ`, type: 'success' }
  } catch (e: any) {
    statusMsg.value = { text: `計算エラー: ${e.message}`, type: 'error' }
  } finally {
    isLoading.value = false
  }
}


const exportResults = (format: 'csv' | 'json') => {
  if (segments.value.length === 0) return
  
  let content = ""
  let type = ""
  let fileName = "results." + format
  
  if (format === 'json') {
    content = JSON.stringify(segments.value, null, 2)
    type = "application/json"
  } else {
    const headers = ["src", "tgt", "note"]
    const rows = segments.value.map(s => [s.src, s.tgt, s.note || ""])
    content = [headers, ...rows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n")
    type = "text/csv"
  }
  
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

</script>

<template>
  <div class="app-container">
    <!-- Header -->
    <header class="header">
      <div class="logo-area">
        <h1>SheepComb<span>v2</span></h1>
        <p>Advanced File Parser & Checker</p>
      </div>
      <div class="status-badge" :class="isWasmReady ? 'success' : 'loading'">
        {{ isWasmReady ? 'WASM READY' : 'WASM LOADING' }}
      </div>
    </header>

    <main class="main-content">
      <!-- Sidebar -->
      <aside class="sidebar">
        <!-- Step 1: Input -->
        <div class="card">
          <div class="card-header">
            <Database :size="16" />
            <h2>1. データ読み込み</h2>
          </div>

          <div class="upload-section">
            <div 
              class="drop-zone"
              @dragover.prevent
              @drop="handleFileDrop($event, 'src')"
              @click="srcInput?.click()"
            >
              <input type="file" ref="srcInput" multiple hidden @change="handleFileSelect($event, 'src')">
              <FileUp :size="32" class="icon" />
              <p v-if="srcFiles.length === 0">対象ファイルをドロップ</p>
              <p v-else class="file-count">{{ srcFiles.length }} 個選択中</p>
            </div>
            <div class="file-list" v-if="srcFiles.length > 0">
               <span v-for="f in srcFiles" :key="f.name" class="file-tag">{{ f.name }}</span>
               <button @click.stop="clearFiles('src')" class="btn-clear"><Trash2 :size="12" /></button>
            </div>
          </div>

          <div class="actions">
            <button class="btn primary" @click="execParse" :disabled="isLoading || srcFiles.length === 0">
              <Loader2 v-if="isLoading" class="spin" :size="18" />
              <Search v-else :size="18" />
              <span>パース実行</span>
            </button>
          </div>
        </div>

        <!-- Step 2: Analysis (Only active when data exists) -->
        <div class="card" :class="{ disabled: segments.length === 0 }">
          <div class="card-header">
            <Search :size="16" />
            <h2>2. 解析・アクション</h2>
          </div>
          
          <div class="actions" style="padding-top: 20px;">
            <p v-if="segments.length === 0" class="hint-text">先にデータを読み込んでください</p>
            
            <button class="btn warning" @click="execConsistency" :disabled="isLoading || segments.length === 0">
              <CheckCircle :size="18" />
              <span>ゆれチェックを実行</span>
            </button>
            
            <!-- Future features will go here -->
            <button class="btn-outline-dashed" disabled>
              <Loader2 :size="16" />
              <span>Vertex AI 連携 (準備中)</span>
            </button>
          </div>

          <div class="status-msg" v-if="statusMsg.text" :class="statusMsg.type">
            {{ statusMsg.text }}
          </div>
        </div>
      </aside>

      <!-- Results Area -->
      <section class="results-area">
        <div class="card full-height">
          <div class="card-header space-between">
            <div class="title-group">
              <h2>解析結果</h2>
              <span class="badge" v-if="segments.length > 0">{{ segments.length }} segments</span>
            </div>
            <div class="export-actions" v-if="segments.length > 0">
              <button class="btn-outline" @click="exportResults('csv')"><Download :size="14" /> CSV</button>
              <button class="btn-outline" @click="exportResults('json')"><Database :size="14" /> JSON</button>
            </div>
          </div>

          <div class="table-container" v-if="segments.length > 0">
            <table>
              <thead>
                <tr>
                  <th class="w-10">#</th>
                  <th>Source</th>
                  <th>Target</th>
                  <th v-if="segments.some(s => s.note)">Note</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(seg, idx) in segments" :key="idx">
                  <td class="idx">{{ idx + 1 }}</td>
                  <td class="text">{{ seg.src }}</td>
                  <td class="text">{{ seg.tgt }}</td>
                  <td class="note" v-if="segments.some(s => s.note)">{{ seg.note }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="empty-state" v-else>
            <Search :size="48" class="icon" />
            <p>ファイルをアップロードして解析を開始してください</p>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 0;
  background: var(--bg-primary);
}

.header {
  height: 64px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.logo-area h1 {
  font-size: 1.5rem;
  font-weight: 800;
  background: linear-gradient(to right, var(--accent), var(--accent-light));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.logo-area span {
  font-size: 0.8rem;
  padding: 2px 6px;
  background: var(--accent-glow);
  -webkit-text-fill-color: var(--accent-light);
  border-radius: 4px;
  font-family: monospace;
}

.logo-area p {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: -4px;
}

.status-badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 20px;
  border: 1px solid var(--border);
}

.status-badge.success {
  background: var(--accent-glow);
  color: var(--accent-light);
  border-color: var(--border-accent);
}

.main-content {
  flex: 1;
  display: grid;
  grid-template-columns: 350px 1fr;
  padding: 24px;
  gap: 24px;
  /* overflow: hidden を削除 */
}

@media (max-width: 900px) {
  .main-content {
    grid-template-columns: 1fr;
  }
}

.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  /* overflow: hidden を削除 */
}

.full-height {
  height: max-content;
  min-height: calc(100vh - 112px);
}

.card-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-header.space-between {
  justify-content: space-between;
}

.card-header h2 {
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 24px;
  position: sticky;
  top: 88px; /* Header 64px + Padding 24px */
  align-self: start;
}

.upload-section {
  padding: 16px 20px;
}

.section-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.drop-zone {
  border: 2px dashed var(--border);
  border-radius: var(--radius-sm);
  padding: 24px;
  text-align: center;
  cursor: pointer;
  transition: var(--transition);
  color: var(--text-secondary);
}

.drop-zone:hover {
  border-color: var(--accent);
  background: var(--accent-glow);
}

.drop-zone.secondary:hover {
  border-color: var(--warning);
  background: rgba(251, 191, 36, 0.05);
}

.drop-zone .icon {
  margin-bottom: 8px;
  opacity: 0.6;
}

.drop-zone p {
  font-size: 0.8rem;
}

.file-list {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  max-height: 250px;
  overflow-y: auto;
  padding: 4px;
  background: rgba(0,0,0,0.1);
  border-radius: 4px;
}

.file-tag {
  font-size: 0.7rem;
  background: var(--bg-secondary);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn-clear {
  background: none;
  border: none;
  color: var(--error);
  cursor: pointer;
  padding: 4px;
  opacity: 0.6;
}

.actions {
  padding: 0 20px 20px;
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
  font-size: 0.85rem;
  cursor: pointer;
  transition: var(--transition);
}

.btn.primary {
  background: var(--accent);
  color: #fff;
}

.btn.warning {
  background: var(--warning);
  color: #000;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.status-msg {
  margin: 0 20px 20px;
  padding: 10px;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
}

.status-msg.info { background: var(--bg-hover); color: var(--text-primary); }
.status-msg.success { background: rgba(16, 185, 129, 0.1); color: var(--success); }
.status-msg.error { background: rgba(244, 63, 94, 0.1); color: var(--error); }

.table-container {
  flex: 1;
  overflow: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  position: sticky;
  top: 0;
  background: var(--bg-hover);
  padding: 12px 16px;
  text-align: left;
  font-size: 0.7rem;
  text-transform: uppercase;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  z-index: 10;
}

td {
  padding: 12px 16px;
  font-size: 0.85rem;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}

tr:hover td {
  background: rgba(255, 255, 255, 0.02);
}

.idx { color: var(--text-muted); font-family: monospace; width: 40px; }
.text { color: var(--text-primary); }
.note { color: var(--text-secondary); font-style: italic; font-size: 0.8rem; }

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  gap: 16px;
}

.empty-state .icon {
  opacity: 0.2;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.badge {
  font-size: 0.7rem;
  padding: 2px 8px;
  background: var(--bg-primary);
  border-radius: 12px;
  color: var(--text-muted);
}

.btn-outline {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
}

.card.disabled {
  opacity: 0.6;
}

.hint-text {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-align: center;
  margin-bottom: 12px;
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
  font-size: 0.85rem;
  cursor: not-allowed;
}
</style>
