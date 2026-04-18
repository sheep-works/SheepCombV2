<script setup lang="ts">
import { ref, computed } from 'vue'

// --- Types ---
interface HistoryItem {
  src: string
  tgt: string
}

interface ChunkItem {
  index?: number
  src?: string
  tgt?: string
  pre?: string
  history?: HistoryItem[]
}

interface RefItem {
  idx: number
  src: string
  tgt: string
  ratio: number
  diff: string
}

interface RawUnit {
  idx: number
  src: string
  pre: string
  tgt: string
  ref: {
    tms: RefItem[]
    tb: RefItem[]
    quoted: number[][]
  }
}

interface RawMeta {
  bilingualPath: string
  files: { name: string; start: number; end: number }[]
  sourceLang: string
  targetLang: string
}

type Mode = 'chunked' | 'jsonl' | 'raw' | 'pinia'

// --- State ---
const mode = ref<Mode>('chunked')
const isDragging = ref(false)
const fileName = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

// Chunked-JSONL data
const chunks = ref<ChunkItem[][]>([])
const crtChunkIdx = ref(0)

// Plain JSONL data
const jsonlItems = ref<ChunkItem[]>([])
const jsonlPage = ref(0)

// Raw JSON data
const rawMeta = ref<RawMeta | null>(null)
const rawUnits = ref<RawUnit[]>([])
const rawPage = ref(0)

// Pinia State debug data
const piniaInput = ref('')
const piniaMeta = ref<RawMeta | null>(null)
const piniaUnits = ref<RawUnit[]>([])
const piniaCrtPos = ref(0)
const piniaMaxPos = ref(0)
const piniaPage = ref(0)
const piniaError = ref('')

const PAGE_SIZE = 50

// --- Computed ---
const currentChunk = computed(() => chunks.value[crtChunkIdx.value] || null)
const crtChunkChars = computed(() => {
  if (!currentChunk.value) return 0
  return currentChunk.value.reduce((acc, item) => {
    const srcLen = item.src ? item.src.length : 0
    const tgtText = item.tgt || item.pre || ''
    return acc + srcLen + tgtText.length
  }, 0)
})

const jsonlTotalPages = computed(() => Math.ceil(jsonlItems.value.length / PAGE_SIZE))
const jsonlPageItems = computed(() => {
  const start = jsonlPage.value * PAGE_SIZE
  return jsonlItems.value.slice(start, start + PAGE_SIZE)
})

const rawTotalPages = computed(() => Math.ceil(rawUnits.value.length / PAGE_SIZE))
const rawPageItems = computed(() => {
  const start = rawPage.value * PAGE_SIZE
  return rawUnits.value.slice(start, start + PAGE_SIZE)
})

const piniaTotalPages = computed(() => Math.ceil(piniaUnits.value.length / PAGE_SIZE))
const piniaPageItems = computed(() => {
  const start = piniaPage.value * PAGE_SIZE
  return piniaUnits.value.slice(start, start + PAGE_SIZE)
})
const piniaHasData = computed(() => piniaUnits.value.length > 0)

const hasData = computed(() => {
  if (mode.value === 'chunked') return chunks.value.length > 0
  if (mode.value === 'jsonl') return jsonlItems.value.length > 0
  if (mode.value === 'raw') return rawUnits.value.length > 0
  return false
})

const acceptedExt = computed(() => {
  if (mode.value === 'raw') return '.json'
  return '.jsonl'
})

const dropLabel = computed(() => {
  if (mode.value === 'raw') return 'JSON ファイルをドロップまたはクリックして選択'
  return 'JSONL ファイルをドロップまたはクリックして選択'
})

// --- Methods ---
function switchMode(m: Mode) {
  resetAll()
  mode.value = m
}

function handleDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) loadFile(file)
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) loadFile(file)
}

function triggerFileInput() {
  fileInput.value?.click()
}

function loadFile(file: File) {
  fileName.value = file.name
  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    if (mode.value === 'chunked') parseChunkedJsonl(text)
    else if (mode.value === 'jsonl') parsePlainJsonl(text)
    else parseRawJson(text)
  }
  reader.readAsText(file)
}

function parseChunkedJsonl(content: string) {
  const lines = content.split('\n').filter(l => l.trim())
  const newChunks: ChunkItem[][] = []
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line)
      if (Array.isArray(parsed)) newChunks.push(parsed)
      else newChunks.push([parsed])
    } catch (err) {
      console.error('Line parse error:', err)
    }
  }
  chunks.value = newChunks
  crtChunkIdx.value = 0
}

function parsePlainJsonl(content: string) {
  const lines = content.split('\n').filter(l => l.trim())
  const items: ChunkItem[] = []
  for (const line of lines) {
    try {
      items.push(JSON.parse(line))
    } catch (err) {
      console.error('Line parse error:', err)
    }
  }
  jsonlItems.value = items
  jsonlPage.value = 0
}

function parseRawJson(content: string) {
  try {
    const parsed = JSON.parse(content)
    rawMeta.value = parsed.meta || null
    rawUnits.value = parsed.body?.units || []
    rawPage.value = 0
  } catch (err) {
    console.error('JSON parse error:', err)
  }
}

function parsePiniaState() {
  piniaError.value = ''
  const text = piniaInput.value.trim()
  if (!text) return
  try {
    const parsed = JSON.parse(text)
    piniaMeta.value = parsed.meta || null
    piniaUnits.value = parsed.units || parsed.body?.units || []
    piniaCrtPos.value = parsed.crtPos ?? 0
    piniaMaxPos.value = parsed.maxPos ?? 0
    piniaPage.value = 0
  } catch (err) {
    piniaError.value = String(err)
    console.error('Pinia state parse error:', err)
  }
}

function resetPinia() {
  piniaInput.value = ''
  piniaMeta.value = null
  piniaUnits.value = []
  piniaCrtPos.value = 0
  piniaMaxPos.value = 0
  piniaPage.value = 0
  piniaError.value = ''
}

function resetAll() {
  chunks.value = []
  crtChunkIdx.value = 0
  jsonlItems.value = []
  jsonlPage.value = 0
  rawMeta.value = null
  rawUnits.value = []
  rawPage.value = 0
  fileName.value = ''
  resetPinia()
}
</script>

<template>
  <div class="jc-container">
    <h2 class="jc-title">Sheep JSON Viewer</h2>
    <p class="jc-license">This tool uses Vue.js (MIT License).</p>

    <!-- Mode Tabs -->
    <div class="jc-tabs">
      <button
        class="jc-tab"
        :class="{ active: mode === 'chunked' }"
        @click="switchMode('chunked')"
      >Chunked JSONL</button>
      <button
        class="jc-tab"
        :class="{ active: mode === 'jsonl' }"
        @click="switchMode('jsonl')"
      >Plain JSONL</button>
      <button
        class="jc-tab"
        :class="{ active: mode === 'raw' }"
        @click="switchMode('raw')"
      >Raw JSON</button>
      <button
        class="jc-tab"
        :class="{ active: mode === 'pinia' }"
        @click="switchMode('pinia')"
      >Pinia State</button>
    </div>

    <!-- D&D Area (file-based modes only) -->
    <div
      v-if="mode !== 'pinia'"
      class="jc-drop-area"
      :class="{ 'jc-highlight': isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
      @click="triggerFileInput"
    >
      <p v-if="!hasData" class="jc-drop-label">{{ dropLabel }}</p>
      <div v-else>
        <p class="jc-loaded-label">✓ File Loaded</p>
        <p class="jc-file-name">{{ fileName }}</p>
      </div>
      <input
        type="file"
        ref="fileInput"
        @change="handleFileSelect"
        style="display: none"
        :accept="acceptedExt"
      />
    </div>

    <!-- Paste Area (pinia mode) -->
    <div v-if="mode === 'pinia' && !piniaHasData" class="jc-paste-area">
      <textarea
        v-model="piniaInput"
        class="jc-textarea"
        placeholder="Pinia ストアの JSON 文字列をここに貼り付け…"
        rows="6"
      ></textarea>
      <p v-if="piniaError" class="jc-parse-error">⚠ {{ piniaError }}</p>
      <button @click="parsePiniaState" class="jc-btn jc-btn-parse" :disabled="!piniaInput.trim()">解析</button>
    </div>

    <!-- ===================== MODE 1: Chunked JSONL ===================== -->
    <template v-if="mode === 'chunked' && chunks.length">
      <div class="jc-controls">
        <button @click="crtChunkIdx--" :disabled="crtChunkIdx <= 0" class="jc-btn">← Previous</button>
        <div class="jc-chunk-info">
          Chunk {{ crtChunkIdx + 1 }} / {{ chunks.length }}
          <span class="jc-chunk-chars">({{ crtChunkChars.toLocaleString() }} chars)</span>
        </div>
        <button @click="crtChunkIdx++" :disabled="crtChunkIdx >= chunks.length - 1" class="jc-btn">Next →</button>
        <button @click="resetAll" class="jc-btn jc-btn-danger">Clear</button>
      </div>

      <table v-if="currentChunk" class="jc-data-table">
        <thead>
          <tr>
            <th class="jc-th-id">Id</th>
            <th>Dynamic Content Breakdown</th>
          </tr>
        </thead>
        <tbody v-for="(item, i) in currentChunk" :key="item.index ?? i" class="jc-chunk-tbody">
          <tr class="jc-chunk-row">
            <td class="jc-td-id">{{ item.index }}</td>
            <td class="jc-content-row">
              <div class="jc-side-box">
                <span class="jc-label jc-label-src">SOURCE</span>
                <pre>{{ item.src }}</pre>
              </div>
              <div class="jc-side-box">
                <span class="jc-label jc-label-tgt">TARGET / PRE-TRANS</span>
                <pre>{{ item.tgt || item.pre || '---' }}</pre>
              </div>
            </td>
          </tr>
          <tr v-for="(hist, hi) in item.history" :key="'h' + String(hi)" class="jc-history-row">
            <td class="jc-td-ref">Ref {{ Number(hi) + 1 }}</td>
            <td class="jc-content-row">
              <div class="jc-side-box jc-side-box-small">
                <span class="jc-label jc-label-his">REF SRC</span>
                <div>{{ hist.src }}</div>
              </div>
              <div class="jc-side-box jc-side-box-small">
                <span class="jc-label jc-label-his">REF TGT</span>
                <div>{{ hist.tgt }}</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </template>

    <!-- ===================== MODE 2: Plain JSONL ===================== -->
    <template v-if="mode === 'jsonl' && jsonlItems.length">
      <div class="jc-controls">
        <button @click="jsonlPage--" :disabled="jsonlPage <= 0" class="jc-btn">← Previous</button>
        <div class="jc-chunk-info">
          Page {{ jsonlPage + 1 }} / {{ jsonlTotalPages }}
          <span class="jc-chunk-chars">({{ jsonlItems.length }} items)</span>
        </div>
        <button @click="jsonlPage++" :disabled="jsonlPage >= jsonlTotalPages - 1" class="jc-btn">Next →</button>
        <button @click="resetAll" class="jc-btn jc-btn-danger">Clear</button>
      </div>

      <table class="jc-data-table">
        <thead>
          <tr>
            <th class="jc-th-id">#</th>
            <th>Dynamic Content Breakdown</th>
          </tr>
        </thead>
        <tbody v-for="(item, i) in jsonlPageItems" :key="jsonlPage * PAGE_SIZE + i" class="jc-chunk-tbody">
          <tr class="jc-chunk-row">
            <td class="jc-td-id">{{ jsonlPage * PAGE_SIZE + Number(i) + 1 }}</td>
            <td class="jc-content-row">
              <div class="jc-side-box">
                <span class="jc-label jc-label-src">SOURCE</span>
                <pre>{{ item.src }}</pre>
              </div>
              <div class="jc-side-box">
                <span class="jc-label jc-label-tgt">TARGET</span>
                <pre>{{ item.tgt || '---' }}</pre>
              </div>
            </td>
          </tr>
          <tr v-for="(hist, hi) in item.history" :key="'h' + String(hi)" class="jc-history-row">
            <td class="jc-td-ref">Ref {{ Number(hi) + 1 }}</td>
            <td class="jc-content-row">
              <div class="jc-side-box jc-side-box-small">
                <span class="jc-label jc-label-his">REF SRC</span>
                <div>{{ hist.src }}</div>
              </div>
              <div class="jc-side-box jc-side-box-small">
                <span class="jc-label jc-label-his">REF TGT</span>
                <div>{{ hist.tgt }}</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </template>

    <!-- ===================== MODE 3: Raw JSON ===================== -->
    <template v-if="mode === 'raw' && rawUnits.length">
      <!-- Meta Info Panel -->
      <div v-if="rawMeta" class="jc-meta-panel">
        <h3 class="jc-meta-title">Meta Information</h3>
        <div class="jc-meta-grid">
          <div class="jc-meta-row" v-if="rawMeta.sourceLang || rawMeta.targetLang">
            <span class="jc-meta-key">Languages</span>
            <span class="jc-meta-val">{{ rawMeta.sourceLang || '(auto)' }} → {{ rawMeta.targetLang || '(auto)' }}</span>
          </div>
          <div class="jc-meta-row">
            <span class="jc-meta-key">Files ({{ rawMeta.files.length }})</span>
            <div class="jc-meta-files">
              <div v-for="(f, fi) in rawMeta.files" :key="fi" class="jc-meta-file">
                <span class="jc-meta-file-name">{{ f.name }}</span>
                <span class="jc-meta-file-range">#{{ f.start }}–{{ f.end }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Controls -->
      <div class="jc-controls">
        <button @click="rawPage--" :disabled="rawPage <= 0" class="jc-btn">← Previous</button>
        <div class="jc-chunk-info">
          Page {{ rawPage + 1 }} / {{ rawTotalPages }}
          <span class="jc-chunk-chars">({{ rawUnits.length }} units)</span>
        </div>
        <button @click="rawPage++" :disabled="rawPage >= rawTotalPages - 1" class="jc-btn">Next →</button>
        <button @click="resetAll" class="jc-btn jc-btn-danger">Clear</button>
      </div>

      <table class="jc-data-table">
        <thead>
          <tr>
            <th class="jc-th-id">Idx</th>
            <th>Content</th>
          </tr>
        </thead>
        <tbody v-for="unit in rawPageItems" :key="unit.idx" class="jc-chunk-tbody">
          <tr class="jc-chunk-row">
            <td class="jc-td-id">{{ unit.idx }}</td>
            <td class="jc-content-row">
              <div class="jc-side-box">
                <span class="jc-label jc-label-src">SOURCE</span>
                <pre>{{ unit.src }}</pre>
              </div>
              <div class="jc-side-box">
                <span class="jc-label jc-label-tgt">TARGET</span>
                <pre>{{ unit.tgt || '---' }}</pre>
              </div>
              <div class="jc-side-box">
                <span class="jc-label jc-label-pre">PRE-TRANS</span>
                <pre>{{ unit.pre || '---' }}</pre>
              </div>
            </td>
          </tr>
          <!-- TM References -->
          <tr v-for="(tm, ti) in unit.ref.tms" :key="'tm' + String(ti)" class="jc-history-row">
            <td class="jc-td-ref">
              TM
              <span class="jc-ref-ratio">{{ tm.ratio }}%</span>
            </td>
            <td class="jc-content-row">
              <div class="jc-side-box jc-side-box-small">
                <span class="jc-label jc-label-his">REF SRC (#{{ tm.idx }})</span>
                <div>{{ tm.src }}</div>
              </div>
              <div class="jc-side-box jc-side-box-small">
                <span class="jc-label jc-label-his">REF TGT</span>
                <div>{{ tm.tgt }}</div>
              </div>
              <div class="jc-side-box jc-side-box-small">
                <span class="jc-label jc-label-diff">DIFF</span>
                <div v-html="tm.diff"></div>
              </div>
            </td>
          </tr>
          <!-- Quoted References -->
          <tr v-if="unit.ref.quoted.length" class="jc-history-row">
            <td class="jc-td-ref">QT</td>
            <td style="padding: 0.5rem 1rem;">
              <span
                v-for="(q, qi) in unit.ref.quoted"
                :key="'q' + String(qi)"
                class="jc-quoted-badge"
              >#{{ q[0] }} ({{ q[1] }}%)</span>
            </td>
          </tr>
        </tbody>
      </table>
    </template>

    <!-- ===================== MODE 4: Pinia State ===================== -->
    <template v-if="mode === 'pinia' && piniaHasData">
      <!-- Position & Meta Info -->
      <div class="jc-meta-panel">
        <h3 class="jc-meta-title">Pinia State</h3>
        <div class="jc-meta-grid">
          <div class="jc-meta-row">
            <span class="jc-meta-key">Position</span>
            <span class="jc-meta-val">
              <strong>{{ piniaCrtPos }}</strong> / {{ piniaMaxPos }}
            </span>
          </div>
          <div class="jc-meta-row" v-if="piniaMeta">
            <span class="jc-meta-key">Languages</span>
            <span class="jc-meta-val">{{ piniaMeta.sourceLang || '(auto)' }} → {{ piniaMeta.targetLang || '(auto)' }}</span>
          </div>
          <div class="jc-meta-row" v-if="piniaMeta">
            <span class="jc-meta-key">Files ({{ piniaMeta.files.length }})</span>
            <div class="jc-meta-files">
              <div v-for="(f, fi) in piniaMeta.files" :key="fi" class="jc-meta-file">
                <span class="jc-meta-file-name">{{ f.name }}</span>
                <span class="jc-meta-file-range">#{{ f.start }}–{{ f.end }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Controls -->
      <div class="jc-controls">
        <button @click="piniaPage--" :disabled="piniaPage <= 0" class="jc-btn">← Previous</button>
        <div class="jc-chunk-info">
          Page {{ piniaPage + 1 }} / {{ piniaTotalPages }}
          <span class="jc-chunk-chars">({{ piniaUnits.length }} units)</span>
        </div>
        <button @click="piniaPage++" :disabled="piniaPage >= piniaTotalPages - 1" class="jc-btn">Next →</button>
        <button @click="resetPinia" class="jc-btn jc-btn-danger">Clear</button>
      </div>

      <table class="jc-data-table">
        <thead>
          <tr>
            <th class="jc-th-id">Idx</th>
            <th>Content</th>
          </tr>
        </thead>
        <tbody v-for="unit in piniaPageItems" :key="unit.idx" class="jc-chunk-tbody"
               :class="{ 'jc-row-current': unit.idx === piniaCrtPos }">
          <tr class="jc-chunk-row">
            <td class="jc-td-id">
              {{ unit.idx }}
              <span v-if="unit.idx === piniaCrtPos" class="jc-pos-badge">▶</span>
            </td>
            <td class="jc-content-row">
              <div class="jc-side-box">
                <span class="jc-label jc-label-src">SOURCE</span>
                <pre>{{ unit.src }}</pre>
              </div>
              <div class="jc-side-box">
                <span class="jc-label jc-label-tgt">TARGET</span>
                <pre>{{ unit.tgt || '---' }}</pre>
              </div>
              <div class="jc-side-box">
                <span class="jc-label jc-label-pre">PRE-TRANS</span>
                <pre>{{ unit.pre || '---' }}</pre>
              </div>
            </td>
          </tr>
          <!-- TM References -->
          <tr v-for="(tm, ti) in unit.ref.tms" :key="'tm' + String(ti)" class="jc-history-row">
            <td class="jc-td-ref">
              TM
              <span class="jc-ref-ratio">{{ tm.ratio }}%</span>
            </td>
            <td class="jc-content-row">
              <div class="jc-side-box jc-side-box-small">
                <span class="jc-label jc-label-his">REF SRC (#{{ tm.idx }})</span>
                <div>{{ tm.src }}</div>
              </div>
              <div class="jc-side-box jc-side-box-small">
                <span class="jc-label jc-label-his">REF TGT</span>
                <div>{{ tm.tgt }}</div>
              </div>
              <div class="jc-side-box jc-side-box-small">
                <span class="jc-label jc-label-diff">DIFF</span>
                <div v-html="tm.diff"></div>
              </div>
            </td>
          </tr>
          <!-- Quoted References -->
          <tr v-if="unit.ref.quoted.length" class="jc-history-row">
            <td class="jc-td-ref">QT</td>
            <td style="padding: 0.5rem 1rem;">
              <span
                v-for="(q, qi) in unit.ref.quoted"
                :key="'q' + String(qi)"
                class="jc-quoted-badge"
              >#{{ q[0] }} ({{ q[1] }}%)</span>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<style scoped>
.jc-container {
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 24px 0;
  color: var(--vp-c-text-1);
}

.jc-title {
  text-align: center;
  font-weight: 700;
  background: linear-gradient(135deg, var(--vp-c-brand-1), var(--vp-c-brand-3));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 0.25rem;
  font-size: 1.75rem;
  letter-spacing: -0.02em;
}

.jc-license {
  text-align: center;
  font-size: 0.75rem;
  color: var(--vp-c-text-3);
  margin-top: 0;
  margin-bottom: 1.5rem;
}

/* ── Mode Tabs ── */
.jc-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 1.5rem;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}

.jc-tab {
  flex: 1;
  padding: 0.65rem 1rem;
  background: transparent;
  color: var(--vp-c-text-2);
  border: none;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: color 0.25s, background-color 0.25s;
  font-family: var(--vp-font-family-base);
  position: relative;
}

.jc-tab:not(:last-child) {
  border-right: 1px solid var(--vp-c-divider);
}

.jc-tab:hover {
  color: var(--vp-c-text-1);
  background: var(--vp-c-brand-soft);
}

.jc-tab.active {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.jc-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--vp-c-brand-1);
}

/* ── Drop Area ── */
.jc-drop-area {
  border: 2px dashed var(--vp-c-brand-1);
  border-radius: 12px;
  background: var(--vp-c-brand-soft);
  padding: 2.5rem 1rem;
  text-align: center;
  transition: background-color 0.25s, border-color 0.25s, transform 0.2s;
  cursor: pointer;
  margin-bottom: 1.5rem;
}

.jc-drop-area.jc-highlight {
  background: var(--vp-c-brand-soft);
  border-color: var(--vp-c-brand-2);
  transform: scale(1.01);
}

.jc-drop-label {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
  margin: 0;
}

.jc-loaded-label {
  color: var(--vp-c-green-1, #10b981);
  font-weight: 700;
  font-size: 1rem;
  margin: 0 0 0.25rem 0;
}

.jc-file-name {
  color: var(--vp-c-text-2);
  margin: 0;
  font-size: 0.9rem;
}

/* ── Pagination Controls ── */
.jc-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  background: var(--vp-c-bg-soft);
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
}

.jc-btn {
  background-color: var(--vp-c-brand-1);
  color: var(--vp-c-white, #fff);
  border: none;
  padding: 0.45rem 1rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.15s;
  font-family: var(--vp-font-family-base);
  font-size: 0.85rem;
  line-height: 1.4;
}

.jc-btn:hover:not(:disabled) {
  background-color: var(--vp-c-brand-2);
  transform: translateY(-1px);
}

.jc-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.jc-btn-danger {
  background-color: var(--vp-c-danger-1, #ef4444);
  margin-left: auto;
}

.jc-btn-danger:hover:not(:disabled) {
  background-color: var(--vp-c-danger-2, #dc2626);
}

.jc-chunk-info {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--vp-c-brand-1);
}

.jc-chunk-chars {
  font-size: 0.8rem;
  color: var(--vp-c-text-3);
  margin-left: 6px;
}

/* ── Data Table ── */
.jc-data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 8px;
}

.jc-data-table th {
  text-align: left;
  padding: 0.5rem 1rem;
  color: var(--vp-c-text-3);
  text-transform: uppercase;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.jc-th-id {
  width: 70px;
  text-align: center !important;
}

.jc-chunk-tbody {
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
}

.jc-chunk-row td {
  padding: 1rem;
}

.jc-td-id {
  width: 60px;
  font-weight: 700;
  color: var(--vp-c-brand-1);
  font-size: 1rem;
  text-align: center;
  vertical-align: middle;
}

.jc-td-ref {
  text-align: center;
  color: var(--vp-c-text-3);
  font-size: 0.75rem;
  vertical-align: top;
  padding-top: 0.75rem;
}

.jc-ref-ratio {
  display: block;
  font-size: 0.7rem;
  color: var(--vp-c-brand-1);
  font-weight: 700;
  margin-top: 2px;
}

.jc-history-row {
  background: var(--vp-c-bg-alt);
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}

.jc-history-row td {
  padding: 0.6rem 1rem;
  border-top: 1px solid var(--vp-c-divider);
}

/* ── Labels ── */
.jc-label {
  display: inline-block;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  margin-bottom: 4px;
  letter-spacing: 0.03em;
}

.jc-label-src {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.jc-label-tgt {
  background: rgba(139, 92, 246, 0.1);
  color: var(--vp-c-purple-1, #8b5cf6);
}

.jc-label-pre {
  background: rgba(16, 185, 129, 0.1);
  color: var(--vp-c-green-1, #10b981);
}

.jc-label-his {
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-3);
}

.jc-label-diff {
  background: rgba(245, 158, 11, 0.1);
  color: var(--vp-c-yellow-1, #f59e0b);
}

/* ── Content Layout ── */
pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--vp-font-family-mono);
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--vp-c-text-1);
}

.jc-content-row {
  display: flex;
  gap: 1rem;
}

.jc-side-box {
  flex: 1;
  min-width: 0;
}

.jc-side-box-small {
  font-size: 0.85rem;
}

/* ── Meta Panel ── */
.jc-meta-panel {
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
  padding: 1rem 1.25rem;
  margin-bottom: 1.25rem;
  border: 1px solid var(--vp-c-divider);
}

.jc-meta-title {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--vp-c-brand-1);
  margin: 0 0 0.6rem 0;
}

.jc-meta-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.jc-meta-row {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.jc-meta-key {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--vp-c-text-2);
  min-width: 90px;
  flex-shrink: 0;
}

.jc-meta-val {
  font-size: 0.85rem;
  color: var(--vp-c-text-1);
}

.jc-meta-files {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.jc-meta-file {
  background: var(--vp-c-brand-soft);
  border-radius: 4px;
  padding: 0.2rem 0.5rem;
  font-size: 0.8rem;
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

.jc-meta-file-name {
  color: var(--vp-c-text-1);
  font-weight: 600;
}

.jc-meta-file-range {
  color: var(--vp-c-text-3);
  font-size: 0.75rem;
}

/* ── Quoted badges ── */
.jc-quoted-badge {
  display: inline-block;
  background: var(--vp-c-default-soft);
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 0.75rem;
  color: var(--vp-c-text-2);
  margin: 2px 4px 2px 0;
}

/* ── Diff styling ── */
:deep(del) {
  background: rgba(239, 68, 68, 0.15);
  color: var(--vp-c-danger-1, #ef4444);
  text-decoration: line-through;
  padding: 0 2px;
  border-radius: 2px;
}

:deep(ins) {
  background: rgba(16, 185, 129, 0.15);
  color: var(--vp-c-green-1, #10b981);
  text-decoration: none;
  padding: 0 2px;
  border-radius: 2px;
}

/* ── Pinia paste area ── */
.jc-paste-area {
  margin-bottom: 1.5rem;
  text-align: center;
}

.jc-textarea {
  width: 100%;
  padding: 0.75rem 1rem;
  font-family: var(--vp-font-family-mono);
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  resize: vertical;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.jc-textarea:focus {
  outline: none;
  border-color: var(--vp-c-brand-1);
}

.jc-textarea::placeholder {
  color: var(--vp-c-text-3);
}

.jc-btn-parse {
  margin-top: 0.75rem;
}

.jc-parse-error {
  color: var(--vp-c-danger-1, #ef4444);
  font-size: 0.8rem;
  margin: 0.5rem 0 0 0;
  word-break: break-all;
}

/* Current position highlight */
.jc-row-current {
  border-left: 3px solid var(--vp-c-brand-1) !important;
}

.jc-pos-badge {
  display: block;
  color: var(--vp-c-brand-1);
  font-size: 0.7rem;
  margin-top: 2px;
}
</style>
