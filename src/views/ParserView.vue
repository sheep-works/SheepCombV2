<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { FileUp, Search, CheckCircle, Download, Database, Loader2, Trash2 } from 'lucide-vue-next'
import { useParserStore } from '@/stores/parserStore'
import { initWasm, getWasm, isWasmReady as checkWasm } from '@/logic/wasm'
import { parseXliff, parseTmx, parseXlsx, parseDocx, stripTags, type Segment } from '@/logic/parsers'
import { FileIO } from '@/utils/fileIO'

const store = useParserStore()
const srcInput = ref<HTMLInputElement | null>(null)
const isWasmReady = ref(checkWasm())

onMounted(async () => {
  if (!isWasmReady.value) {
    try {
      store.setStatus('WASM Runtime を初期化中...', 'info')
      await initWasm()
      isWasmReady.value = true
      store.setStatus('準備完了', 'success')
    } catch {
      store.setStatus('WASM の初期化に失敗しました', 'error')
    }
  }
})

const handleFileDrop = (e: DragEvent) => {
  e.preventDefault()
  const files = Array.from(e.dataTransfer?.files || [])
  store.setSrcFiles(files)
}

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  const files = Array.from(target.files || [])
  store.setSrcFiles(files)
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
  if (!store.hasSrcFiles) return
  store.setLoading(true)
  store.setStatus('解析中...', 'info')

  try {
    let all: Segment[] = []
    for (const f of store.srcFiles) {
      all = [...all, ...(await readFile(f))]
    }
    store.setSegments(all)
    store.setStatus(`抽出完了: ${all.length} 件`, 'success')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    store.setStatus(`エラー: ${msg}`, 'error')
  } finally {
    store.setLoading(false)
  }
}

const execConsistency = async () => {
  if (!store.hasSegments) return

  store.setLoading(true)
  store.setStatus('ゆれチェック計算中 (WASM)...', 'info')

  try {
    const wasm = getWasm()
    const input = store.segments.map((s: Segment, i: number) => ({
      idx: i,
      src: stripTags(s.src),
      tgt: stripTags(s.tgt),
    }))

    const groups = wasm.get_consistency_groups(input, 80.0)
    const flat: Segment[] = []
    groups.forEach((group: { idx: number }[], i: number) => {
      group.forEach((item: { idx: number }) => {
        const original = store.segments[item.idx]
        flat.push({
          ...original,
          note: `${original.note || ''} [Group ${i + 1}]`.trim(),
        })
      })
    })

    store.setSegments(flat)
    store.setMatched(true)
    store.setStatus(`ゆれチェック完了: ${groups.length} グループ`, 'success')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    store.setStatus(`計算エラー: ${msg}`, 'error')
  } finally {
    store.setLoading(false)
  }
}

const exportResults = (format: 'csv' | 'json') => {
  if (!store.hasSegments) return

  if (format === 'json') {
    FileIO.downloadJson(store.segments, 'results.json')
  } else {
    const headers = ['src', 'tgt', 'note']
    const rows = store.segments.map((s: Segment) => [s.src, s.tgt, (s.note as string) || ''])
    const content = [headers, ...rows]
      .map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(','))
      .join('\n')
    FileIO.downloadCsv(content, 'results.csv')
  }
}
</script>

<template>
  <div class="parser-view">
    <div class="parser-layout">
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
              @drop="handleFileDrop"
              @click="srcInput?.click()"
            >
              <input
                type="file"
                ref="srcInput"
                multiple
                hidden
                @change="handleFileSelect"
              />
              <FileUp :size="28" class="drop-icon" />
              <p v-if="!store.hasSrcFiles">対象ファイルをドロップ</p>
              <p v-else class="file-count">{{ store.srcFiles.length }} 個選択中</p>
            </div>
            <div class="file-list" v-if="store.hasSrcFiles">
              <span v-for="f in store.srcFiles" :key="f.name" class="file-tag">{{ f.name }}</span>
              <button @click.stop="store.clearSrcFiles()" class="btn-clear">
                <Trash2 :size="12" />
              </button>
            </div>
          </div>

          <div class="actions">
            <button
              class="btn primary"
              @click="execParse"
              :disabled="store.isLoading || !store.hasSrcFiles"
            >
              <Loader2 v-if="store.isLoading" class="spin" :size="18" />
              <Search v-else :size="18" />
              <span>パース実行</span>
            </button>
          </div>
        </div>

        <!-- Step 2: Analysis -->
        <div class="card" :class="{ disabled: !store.hasSegments }">
          <div class="card-header">
            <Search :size="16" />
            <h2>2. 解析・アクション</h2>
          </div>

          <div class="actions" style="padding-top: 16px;">
            <p v-if="!store.hasSegments" class="hint-text">
              先にデータを読み込んでください
            </p>

            <button
              class="btn warning"
              @click="execConsistency"
              :disabled="store.isLoading || !store.hasSegments"
            >
              <CheckCircle :size="18" />
              <span>ゆれチェックを実行</span>
            </button>

            <button class="btn-outline-dashed" disabled>
              <Loader2 :size="16" />
              <span>Vertex AI 連携 (準備中)</span>
            </button>
          </div>

          <div
            class="status-msg"
            v-if="store.statusMsg.text"
            :class="store.statusMsg.type"
          >
            {{ store.statusMsg.text }}
          </div>
        </div>
      </aside>

      <!-- Results Area -->
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
                  <th v-if="store.segments.some((s: Segment) => s.note)">Note</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(seg, idx) in store.segments" :key="idx">
                  <td class="idx">{{ idx + 1 }}</td>
                  <td class="text">{{ seg.src }}</td>
                  <td class="text">{{ seg.tgt }}</td>
                  <td
                    class="note"
                    v-if="store.segments.some((s: Segment) => s.note)"
                  >
                    {{ seg.note }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="empty-state" v-else>
            <Search :size="48" class="empty-icon" />
            <p>ファイルをアップロードして解析を開始してください</p>
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

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  position: sticky;
  top: 0;
  background: var(--bg-hover);
  padding: 10px 16px;
  text-align: left;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  z-index: 10;
  font-weight: 700;
}

td {
  padding: 10px 16px;
  font-size: 0.82rem;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}

tr:hover td {
  background: rgba(255, 255, 255, 0.015);
}

.idx {
  color: var(--text-muted);
  font-family: 'Inter', monospace;
  width: 40px;
  font-size: 0.75rem;
}

.text {
  color: var(--text-primary);
  line-height: 1.5;
}

.note {
  color: var(--text-secondary);
  font-style: italic;
  font-size: 0.78rem;
}

/* Empty state */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  gap: 16px;
  padding: 60px 20px;
}

.empty-icon {
  opacity: 0.15;
}

.empty-state p {
  font-size: 0.88rem;
}

/* Spinner */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
