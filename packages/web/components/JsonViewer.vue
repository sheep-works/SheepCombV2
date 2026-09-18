<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { X, ChevronLeft, ChevronRight, ChevronDown, ArrowRight, CornerDownRight, Database, Book, Layers, ExternalLink, Sparkles, Undo2 } from 'lucide-vue-next'
import type { ShWvData, ShWvUnit, ShWvMeta, ShWvRefTm } from '@sheep-family/types'

const isHighlightEnabled = ref(true)
const isQuotedOpen = ref(true)
const isTmOpen = ref(true)
const isTbOpen = ref(true)
const jumpHistory = ref<number[]>([])

const props = defineProps<{
  data: ShWvData | null
}>()

const page = ref(0)
const PAGE_SIZE = 50

const units = computed<ShWvUnit[]>(() => props.data?.body.units ?? [])
const meta = computed<ShWvMeta | null>(() => props.data?.meta ?? null)
const totalPages = computed(() => Math.ceil(units.value.length / PAGE_SIZE))
const pageItems = computed(() => {
  const start = page.value * PAGE_SIZE
  return units.value.slice(start, start + PAGE_SIZE)
})

// Fast index lookup map
const unitMap = computed(() => {
  const map = new Map<number, ShWvUnit>()
  for (const u of units.value) {
    map.set(u.idx, u)
  }
  return map
})

// Modal selection
const selectedIdx = ref<number | null>(null)
const selectedUnit = computed(() => {
  if (selectedIdx.value === null) return null
  return unitMap.value.get(selectedIdx.value) ?? null
})

const selectedUnitPosition = computed(() => {
  if (selectedIdx.value === null) return -1
  return units.value.findIndex(u => u.idx === selectedIdx.value)
})

const hasPrevUnit = computed(() => selectedUnitPosition.value > 0)
const hasNextUnit = computed(() => selectedUnitPosition.value >= 0 && selectedUnitPosition.value < units.value.length - 1)

function openModal(idx: number) {
  jumpHistory.value = []
  selectedIdx.value = idx
}

function closeModal() {
  jumpHistory.value = []
  selectedIdx.value = null
}

function selectUnitByIdx(idx: number) {
  selectedIdx.value = idx
  // Ensure the page contains the selected unit
  const pos = units.value.findIndex(u => u.idx === idx)
  if (pos !== -1) {
    const targetPage = Math.floor(pos / PAGE_SIZE)
    if (targetPage !== page.value) {
      page.value = targetPage
    }
  }
}

function jumpToUnit(targetIdx: number) {
  if (selectedIdx.value !== null && selectedIdx.value !== targetIdx) {
    jumpHistory.value.push(selectedIdx.value)
    if (jumpHistory.value.length > 3) {
      jumpHistory.value.shift()
    }
  }
  selectUnitByIdx(targetIdx)
}

function goBackHistory() {
  if (jumpHistory.value.length > 0) {
    const prevIdx = jumpHistory.value.pop()
    if (prevIdx !== undefined) {
      selectUnitByIdx(prevIdx)
    }
  }
}

function prevUnit() {
  jumpHistory.value = []
  if (hasPrevUnit.value) {
    const target = units.value[selectedUnitPosition.value - 1]
    if (target) {
      selectedIdx.value = target.idx
    }
  }
}

function nextUnit() {
  jumpHistory.value = []
  if (hasNextUnit.value) {
    const target = units.value[selectedUnitPosition.value + 1]
    if (target) {
      selectedIdx.value = target.idx
    }
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (selectedIdx.value === null) return
  if (e.key === 'Escape') {
    closeModal()
  } else if (e.key === 'ArrowLeft') {
    prevUnit()
  } else if (e.key === 'ArrowRight') {
    nextUnit()
  } else if (e.key === 'h' || e.key === 'H') {
    isHighlightEnabled.value = !isHighlightEnabled.value
  } else if (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowLeft') || e.key === 'b' || e.key === 'B') {
    if (jumpHistory.value.length > 0) {
      e.preventDefault()
      goBackHistory()
    }
  }
}

const modalBodyRef = ref<HTMLElement | null>(null)

function handleOverlayWheel(e: WheelEvent) {
  if (modalBodyRef.value) {
    modalBodyRef.value.scrollTop += e.deltaY
  }
}

// Lock body scroll while modal is open
watch(selectedIdx, (newVal) => {
  if (typeof document !== 'undefined') {
    if (newVal !== null) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }
})

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
  }
})

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightTerms(text: string, terms: string[]): string {
  if (!text) return ''
  const safeTerms = terms
    .filter(t => t && t.trim().length > 0)
    .map(t => t.trim())
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .sort((a, b) => b.length - a.length)

  if (safeTerms.length === 0) {
    return escapeHtml(text)
  }

  const pattern = new RegExp(`(${safeTerms.map(escapeRegExp).join('|')})`, 'gi')
  const parts = text.split(pattern)

  return parts
    .map(part => {
      const isMatch = safeTerms.some(t => t.toLowerCase() === part.toLowerCase())
      const escaped = escapeHtml(part)
      return isMatch ? `<mark class="jv-tb-highlight">${escaped}</mark>` : escaped
    })
    .join('')
}

const highlightedSrc = computed(() => {
  if (!selectedUnit.value) return ''
  if (!isHighlightEnabled.value) return escapeHtml(selectedUnit.value.src)
  const tbSrcs = selectedUnit.value.ref?.tb?.map(t => t.src) || []
  return highlightTerms(selectedUnit.value.src, tbSrcs)
})

const highlightedTgt = computed(() => {
  if (!selectedUnit.value) return ''
  if (!isHighlightEnabled.value) return escapeHtml(selectedUnit.value.tgt)
  const tbTgts = selectedUnit.value.ref?.tb?.flatMap(t => t.tgts) || []
  return highlightTerms(selectedUnit.value.tgt, tbTgts)
})

function resetPage() {
  page.value = 0
}

function formatTmRefLabel(tm: ShWvRefTm): string {
  if (tm.idx > 0) {
    return `REF #${tm.idx}`
  }
  const rowNum = Math.abs(tm.idx)
  const fileName = tm.file && tm.file !== 'Internal' ? tm.file : ''
  if (fileName) {
    return `TM #${rowNum} (${fileName})`
  }
  return `TM #${rowNum}`
}

defineExpose({ resetPage, openModal })
</script>

<template>
  <div class="jv-container" v-if="data">
    <!-- Meta Info Panel -->
    <div v-if="meta" class="jv-meta">
      <div class="jv-meta-row" v-if="meta.sourceLang || meta.targetLang">
        <span class="jv-meta-key">Languages</span>
        <span class="jv-meta-val">{{ meta.sourceLang || '(auto)' }} → {{ meta.targetLang || '(auto)' }}</span>
      </div>
      <div class="jv-meta-row">
        <span class="jv-meta-key">Files ({{ meta.files.length }})</span>
        <div class="jv-meta-files">
          <span v-for="(f, fi) in meta.files" :key="fi" class="jv-file-tag">
            {{ f.name }}
            <span class="jv-file-range">#{{ f.start }}–{{ f.end }}</span>
          </span>
        </div>
      </div>
      <div class="jv-meta-row">
        <span class="jv-meta-key">Units</span>
        <span class="jv-meta-val">{{ units.length }}</span>
      </div>
    </div>

    <!-- Pagination -->
    <div class="jv-controls" v-if="totalPages > 1">
      <button @click="page--" :disabled="page <= 0" class="jv-btn">← Prev</button>
      <span class="jv-page-info">{{ page + 1 }} / {{ totalPages }}</span>
      <button @click="page++" :disabled="page >= totalPages - 1" class="jv-btn">Next →</button>
    </div>

    <!-- Data Table -->
    <table class="jv-table">
      <thead>
        <tr>
          <th class="jv-th-idx">Idx</th>
          <th>Content</th>
        </tr>
      </thead>
      <tbody
        v-for="unit in pageItems"
        :key="unit.idx"
        class="jv-tbody"
        @click="openModal(unit.idx)"
        :class="{ 'jv-tbody-selected': selectedIdx === unit.idx }"
      >
        <tr class="jv-main-row">
          <td class="jv-td-idx">
            <span class="jv-idx-badge">{{ unit.idx }}</span>
          </td>
          <td class="jv-content">
            <div class="jv-field">
              <span class="jv-label jv-label-src">SRC</span>
              <pre>{{ unit.src }}</pre>
            </div>
            <div class="jv-field">
              <span class="jv-label jv-label-tgt">TGT</span>
              <pre>{{ unit.tgt || '---' }}</pre>
            </div>
            <div class="jv-field" v-if="unit.pre">
              <span class="jv-label jv-label-pre">PRE</span>
              <pre>{{ unit.pre }}</pre>
            </div>
          </td>
        </tr>
        <!-- TM References -->
        <tr v-for="(tm, ti) in unit.ref?.tms" :key="'tm' + String(ti)" class="jv-ref-row">
          <td class="jv-td-ref">
            TM <span class="jv-ratio">{{ (tm as ShWvRefTm).ratio }}%</span>
          </td>
          <td class="jv-content">
            <div class="jv-field jv-field-sm">
              <span class="jv-label jv-label-ref">
                {{ formatTmRefLabel(tm as ShWvRefTm) }}
              </span>
              <div>{{ (tm as ShWvRefTm).src }}</div>
            </div>
            <div class="jv-field jv-field-sm">
              <span class="jv-label jv-label-ref">TGT</span>
              <div>{{ (tm as ShWvRefTm).tgt }}</div>
            </div>
            <div class="jv-field jv-field-sm" v-if="(tm as ShWvRefTm).diff">
              <span class="jv-label jv-label-diff">DIFF</span>
              <div v-html="(tm as ShWvRefTm).diff"></div>
            </div>
          </td>
        </tr>
        <!-- TB References -->
        <tr v-for="(tb, tbi) in unit.ref?.tb" :key="'tb' + String(tbi)" class="jv-ref-row">
          <td class="jv-td-ref">TB</td>
          <td class="jv-content">
            <div class="jv-field jv-field-sm">
              <span class="jv-label jv-label-ref">{{ tb.src }}</span>
              <div>{{ tb.tgts.join(' / ') }}</div>
            </div>
          </td>
        </tr>
        <!-- Quoted References -->
        <tr v-if="unit.ref?.quoted?.length" class="jv-ref-row">
          <td class="jv-td-ref">QT</td>
          <td class="jv-content" style="padding: 8px 16px;">
            <span
              v-for="(q, qi) in unit.ref.quoted"
              :key="'q' + String(qi)"
              class="jv-quoted"
              @click.stop="openModal(q[0])"
              title="クリックしてこのユニットを参照している相手を確認"
            >
              #{{ q[0] }} ({{ q[1] }}%)
            </span>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Detail Modal -->
    <Teleport to="body">
      <div v-if="selectedUnit" class="jv-modal-overlay" @click.self="closeModal" @wheel.passive="handleOverlayWheel">
        <div class="jv-modal-card">
          <!-- Modal Header -->
          <div class="jv-modal-header">
            <div class="jv-modal-title">
              <span class="jv-modal-badge">Unit #{{ selectedUnit.idx }}</span>
              <span class="jv-modal-sub" v-if="selectedUnitPosition >= 0">
                ({{ selectedUnitPosition + 1 }} / {{ units.length }})
              </span>
            </div>
            <div class="jv-modal-nav">
              <button
                v-if="jumpHistory.length > 0"
                class="jv-nav-btn jv-back-btn"
                @click="goBackHistory"
                :title="'直前のユニット #' + jumpHistory[jumpHistory.length - 1] + ' に戻る (Backspace / B)'"
                type="button"
              >
                <Undo2 :size="14" />
                <span>#{{ jumpHistory[jumpHistory.length - 1] }} に戻る</span>
                <span class="jv-history-count" v-if="jumpHistory.length > 1">({{ jumpHistory.length }})</span>
              </button>
              <button
                class="jv-toggle-btn"
                :class="{ 'jv-toggle-active': isHighlightEnabled }"
                @click="isHighlightEnabled = !isHighlightEnabled"
                type="button"
                title="TB用語ハイライトのON/OFF (ショートカット: H)"
              >
                <Sparkles :size="14" />
                <span class="jv-toggle-label">Highlight</span>
                <span class="jv-toggle-switch">
                  <span class="jv-toggle-thumb"></span>
                </span>
              </button>
              <button class="jv-nav-btn" @click="prevUnit" :disabled="!hasPrevUnit" title="前のユニット (←)">
                <ChevronLeft :size="16" /> 前へ
              </button>
              <button class="jv-nav-btn" @click="nextUnit" :disabled="!hasNextUnit" title="次のユニット (→)">
                次へ <ChevronRight :size="16" />
              </button>
              <button class="jv-modal-close" @click="closeModal" title="閉じる (Esc)">
                <X :size="18" />
              </button>
            </div>
          </div>

          <!-- Modal Body -->
          <div class="jv-modal-body" ref="modalBodyRef">
            <!-- Main Content Area -->
            <div class="jv-section">
              <div class="jv-field-block">
                <div class="jv-field-header">
                  <span class="jv-label jv-label-src">SRC (原文)</span>
                </div>
                <div class="jv-text-box jv-text-src" v-html="highlightedSrc"></div>
              </div>

              <div class="jv-field-block">
                <div class="jv-field-header">
                  <span class="jv-label jv-label-tgt">TGT (訳文)</span>
                </div>
                <div class="jv-text-box jv-text-tgt" v-html="highlightedTgt || '(訳文なし)'"></div>
              </div>

              <div class="jv-field-block" v-if="selectedUnit.pre">
                <div class="jv-field-header">
                  <span class="jv-label jv-label-pre">PRE (事前翻訳 / MT)</span>
                </div>
                <div class="jv-text-box jv-text-pre">{{ selectedUnit.pre }}</div>
              </div>

              <div class="jv-field-block" v-if="selectedUnit.note">
                <div class="jv-field-header">
                  <span class="jv-label">NOTE (備考)</span>
                </div>
                <div class="jv-text-box jv-text-note">{{ selectedUnit.note }}</div>
              </div>
            </div>

            <!-- Quoted Section (このユニットを参照している相手) -->
            <div class="jv-section" v-if="selectedUnit.ref?.quoted?.length">
              <button
                type="button"
                class="jv-section-title jv-section-title-accordion"
                @click="isQuotedOpen = !isQuotedOpen"
                :aria-expanded="isQuotedOpen"
              >
                <div class="jv-section-title-left">
                  <CornerDownRight :size="16" class="jv-icon-quoted" />
                  <span>Quoted (このユニットを参照している相手)</span>
                  <span class="jv-count-badge">{{ selectedUnit.ref.quoted.length }}</span>
                </div>
                <ChevronDown :size="16" class="jv-accordion-chevron" :class="{ 'jv-chevron-collapsed': !isQuotedOpen }" />
              </button>
              <div v-show="isQuotedOpen" class="jv-relation-list">
                <div
                  v-for="([referencingIdx, ratio], qi) in selectedUnit.ref.quoted"
                  :key="'modal-q' + String(qi)"
                  class="jv-relation-card"
                  @click="jumpToUnit(referencingIdx)"
                >
                  <div class="jv-relation-header">
                    <span class="jv-relation-badge">
                      Unit #{{ referencingIdx }}
                    </span>
                    <span class="jv-ratio-pill">{{ ratio }}% Match</span>
                    <span class="jv-jump-hint">クリックして移動 <CornerDownRight :size="12" /></span>
                  </div>
                  <div class="jv-relation-body" v-if="unitMap.get(referencingIdx)">
                    <div class="jv-relation-line">
                      <span class="jv-label-mini src">SRC</span>
                      <span>{{ unitMap.get(referencingIdx)?.src }}</span>
                    </div>
                    <div class="jv-relation-line">
                      <span class="jv-label-mini tgt">TGT</span>
                      <span>{{ unitMap.get(referencingIdx)?.tgt || '---' }}</span>
                    </div>
                  </div>
                  <div class="jv-relation-missing" v-else>
                    ユニット #{{ referencingIdx }} は現在のデータに存在しません
                  </div>
                </div>
              </div>
            </div>

            <!-- TM Matches Section -->
            <div class="jv-section" v-if="selectedUnit.ref?.tms?.length">
              <button
                type="button"
                class="jv-section-title jv-section-title-accordion"
                @click="isTmOpen = !isTmOpen"
                :aria-expanded="isTmOpen"
              >
                <div class="jv-section-title-left">
                  <Database :size="16" class="jv-icon-tm" />
                  <span>TM (翻訳メモリ一致)</span>
                  <span class="jv-count-badge">{{ selectedUnit.ref.tms.length }}</span>
                </div>
                <ChevronDown :size="16" class="jv-accordion-chevron" :class="{ 'jv-chevron-collapsed': !isTmOpen }" />
              </button>
              <div v-show="isTmOpen" class="jv-tm-list">
                <div v-for="(tm, ti) in selectedUnit.ref.tms" :key="'modal-tm' + String(ti)" class="jv-tm-card">
                  <div class="jv-tm-header">
                    <span
                      class="jv-tm-ref-badge"
                      :class="{ 'jv-tm-ref-clickable': (tm as ShWvRefTm).idx > 0 }"
                      @click="(tm as ShWvRefTm).idx > 0 ? jumpToUnit((tm as ShWvRefTm).idx) : null"
                      :title="(tm as ShWvRefTm).idx > 0 ? 'クリックしてユニット #' + (tm as ShWvRefTm).idx + ' に移動' : ''"
                    >
                      {{ formatTmRefLabel(tm as ShWvRefTm) }}
                      <CornerDownRight v-if="(tm as ShWvRefTm).idx > 0" :size="11" style="display: inline-block; vertical-align: middle; margin-left: 2px;" />
                    </span>
                    <span class="jv-ratio-pill">{{ (tm as ShWvRefTm).ratio }}% Match</span>
                  </div>
                  <div class="jv-tm-body">
                    <div class="jv-tm-row">
                      <span class="jv-label-mini src">TM SRC</span>
                      <div>{{ (tm as ShWvRefTm).src }}</div>
                    </div>
                    <div class="jv-tm-row">
                      <span class="jv-label-mini tgt">TM TGT</span>
                      <div>{{ (tm as ShWvRefTm).tgt }}</div>
                    </div>
                    <div class="jv-tm-row" v-if="(tm as ShWvRefTm).diff">
                      <span class="jv-label-mini diff">DIFF</span>
                      <div class="jv-diff-box" v-html="(tm as ShWvRefTm).diff"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- TB Matches Section -->
            <div class="jv-section" v-if="selectedUnit.ref?.tb?.length">
              <button
                type="button"
                class="jv-section-title jv-section-title-accordion"
                @click="isTbOpen = !isTbOpen"
                :aria-expanded="isTbOpen"
              >
                <div class="jv-section-title-left">
                  <Book :size="16" class="jv-icon-tb" />
                  <span>TB (用語集一致)</span>
                  <span class="jv-count-badge">{{ selectedUnit.ref.tb.length }}</span>
                </div>
                <ChevronDown :size="16" class="jv-accordion-chevron" :class="{ 'jv-chevron-collapsed': !isTbOpen }" />
              </button>
              <div v-show="isTbOpen" class="jv-tb-grid">
                <div v-for="(tb, tbi) in selectedUnit.ref.tb" :key="'modal-tb' + String(tbi)" class="jv-tb-card">
                  <div class="jv-tb-src">{{ tb.src }}</div>
                  <div class="jv-tb-arrow">→</div>
                  <div class="jv-tb-tgt">{{ tb.tgts.join(' / ') }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.jv-container {
  width: 100%;
}

.jv-meta {
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 14px 18px;
  margin-bottom: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
}

.jv-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.jv-meta-key {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}

.jv-meta-val {
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.jv-meta-files {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.jv-file-tag {
  font-size: 0.72rem;
  background: var(--bg-card);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.jv-file-range {
  color: var(--text-muted);
  margin-left: 4px;
}

/* Controls */
.jv-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 16px;
}

.jv-btn {
  background: var(--accent);
  color: #fff;
  border: none;
  padding: 6px 14px;
  border-radius: var(--radius-xs);
  font-weight: 600;
  font-size: 0.82rem;
  cursor: pointer;
  transition: var(--transition);
}

.jv-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.jv-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.jv-page-info {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--accent);
}

/* Table */
.jv-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 6px;
}

.jv-table th {
  text-align: left;
  padding: 8px 16px;
  color: var(--text-muted);
  text-transform: uppercase;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.jv-th-idx {
  width: 76px;
  text-align: center !important;
}

.jv-tbody {
  background: var(--bg-card);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
}

.jv-tbody:nth-child(even) {
  background: var(--bg-hover);
}

.jv-tbody:hover {
  background: var(--bg-card-hover);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.jv-tbody:hover .jv-idx-badge {
  border-color: var(--accent);
  color: var(--accent);
}

.jv-tbody-selected {
  outline: 2px solid var(--accent);
  background: rgba(16, 185, 129, 0.08) !important;
}

.jv-main-row td {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
}

.jv-main-row td:first-child {
  border-radius: var(--radius-sm) 0 0 0;
}

.jv-main-row td:last-child {
  border-radius: 0 var(--radius-sm) 0 0;
}

.jv-td-idx {
  text-align: center;
  vertical-align: top;
  padding: 12px 8px !important;
}

.jv-idx-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 46px;
  padding: 4px 8px;
  border-radius: var(--radius-xs);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-family: 'Inter', monospace;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: var(--transition);
}

.jv-td-ref {
  text-align: center;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-muted);
  vertical-align: middle;
  padding: 8px;
}

.jv-ratio {
  display: block;
  font-size: 0.65rem;
  color: var(--accent);
}

.jv-content {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.jv-field {
  flex: 1;
  min-width: 180px;
}

.jv-field-sm {
  flex: 1;
  min-width: 140px;
}

.jv-field pre {
  font-size: 0.82rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-primary);
  font-family: 'Inter', sans-serif;
  margin: 0;
}

.jv-label {
  display: inline-block;
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 1px 6px;
  border-radius: 3px;
  margin-bottom: 4px;
}

.jv-label-src {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.jv-label-tgt {
  background: rgba(16, 185, 129, 0.15);
  color: #6ee7b7;
}

.jv-label-pre {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.jv-label-diff {
  background: rgba(244, 63, 94, 0.12);
  color: #fb7185;
}

.jv-ref-row td {
  padding: 6px 16px;
  border-top: 1px dashed var(--border);
  font-size: 0.8rem;
}

.jv-sub-label {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
}

.jv-sub-label-refby {
  color: #a78bfa;
}

.jv-quoted {
  display: inline-block;
  font-size: 0.72rem;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  padding: 2px 8px;
  border-radius: 4px;
  margin: 2px 4px 2px 0;
  color: var(--text-secondary);
  transition: var(--transition);
  cursor: pointer;
}

.jv-quoted:hover {
  background: var(--accent-glow);
  border-color: var(--accent);
  color: var(--accent-light);
}

.jv-quoted-refby {
  border-color: rgba(167, 139, 250, 0.3);
  background: rgba(167, 139, 250, 0.08);
  color: #c4b5fd;
}

.jv-quoted-refby:hover {
  background: rgba(167, 139, 250, 0.2);
  border-color: #a78bfa;
  color: #ddd6fe;
}

/* Modal Styles */
.jv-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: fadeIn 0.15s ease-out;
  overscroll-behavior: contain;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.jv-modal-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  width: 100%;
  max-width: 960px;
  height: 85vh;
  max-height: 85vh;
  min-height: 0;
  display: flex;
  flex-direction: column;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  animation: slideUp 0.15s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(12px) scale(0.98); }
  to { transform: translateY(0) scale(1); }
}

.jv-modal-header {
  flex-shrink: 0;
  padding: 18px 28px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-secondary);
}

.jv-modal-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.jv-modal-badge {
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--accent);
  letter-spacing: -0.02em;
}

.jv-modal-sub {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.jv-modal-nav {
  display: flex;
  align-items: center;
  gap: 10px;
}

.jv-nav-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 8px 14px;
  border-radius: var(--radius-xs);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
}

.jv-nav-btn:hover:not(:disabled) {
  background: var(--border);
  color: var(--text-primary);
}

.jv-nav-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.jv-back-btn {
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(59, 130, 246, 0.35);
  color: #60a5fa;
  animation: jv-pulse-fade 0.25s ease;
}

.jv-back-btn:hover {
  background: rgba(59, 130, 246, 0.22);
  border-color: #60a5fa;
  color: #93c5fd;
}

.jv-history-count {
  font-size: 0.72rem;
  opacity: 0.8;
  margin-left: 2px;
}

@keyframes jv-pulse-fade {
  0% {
    opacity: 0;
    transform: translateX(4px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

.jv-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  color: var(--text-muted);
  padding: 6px 12px;
  border-radius: var(--radius-xs);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
  user-select: none;
  margin-right: 4px;
}

.jv-toggle-btn:hover {
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.jv-toggle-btn.jv-toggle-active {
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.4);
  color: #fbbf24;
}

.jv-toggle-label {
  font-size: 0.8rem;
  letter-spacing: 0.02em;
}

.jv-toggle-switch {
  width: 26px;
  height: 15px;
  background: var(--bg-tertiary, #27272a);
  border-radius: 9999px;
  position: relative;
  transition: background-color 0.2s ease, border-color 0.2s ease;
  display: inline-block;
  border: 1px solid var(--border);
}

.jv-toggle-active .jv-toggle-switch {
  background: #f59e0b;
  border-color: #f59e0b;
}

.jv-toggle-thumb {
  position: absolute;
  top: 1.5px;
  left: 2px;
  width: 10px;
  height: 10px;
  background: #ffffff;
  border-radius: 50%;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.jv-toggle-active .jv-toggle-thumb {
  transform: translateX(11px);
}

.jv-modal-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 8px;
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
  margin-left: 8px;
}

.jv-modal-close:hover {
  background: rgba(239, 68, 68, 0.15);
  color: var(--error);
}

.jv-modal-body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 32px 36px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 36px;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.jv-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.jv-section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border);
  padding-bottom: 10px;
}

.jv-section-title-accordion {
  width: 100%;
  background: none;
  border: none;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px 10px 8px;
  border-radius: var(--radius-xs);
  transition: var(--transition);
  user-select: none;
  text-align: left;
}

.jv-section-title-accordion:hover {
  background: var(--bg-hover);
  border-bottom-color: var(--border-hover);
}

.jv-section-title-left {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--text-primary);
}

.jv-count-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 9999px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-muted);
}

.jv-accordion-chevron {
  color: var(--text-muted);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s ease;
  flex-shrink: 0;
}

.jv-section-title-accordion:hover .jv-accordion-chevron {
  color: var(--text-primary);
}

.jv-chevron-collapsed {
  transform: rotate(-90deg);
}

.jv-icon-quoted {
  color: #60a5fa;
}

.jv-icon-tm {
  color: #34d399;
}

.jv-icon-tb {
  color: #fbbf24;
}

.jv-field-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.jv-field-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.jv-text-box {
  padding: 16px 20px;
  border-radius: var(--radius-sm);
  font-size: 0.95rem;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  color: var(--text-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.jv-text-src {
  border-left: 4px solid #3b82f6;
}

.jv-text-tgt {
  border-left: 4px solid #10b981;
}

.jv-text-pre {
  border-left: 4px solid #f59e0b;
}

.jv-text-note {
  border-left: 4px solid var(--text-muted);
  font-style: italic;
  font-size: 0.88rem;
}

/* Relation Cards */
.jv-relation-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.jv-relation-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 16px 20px;
  cursor: pointer;
  transition: var(--transition);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.jv-relation-card:hover {
  border-color: #60a5fa;
  background: rgba(59, 130, 246, 0.05);
  transform: translateX(4px);
}

.jv-relation-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.jv-relation-badge {
  font-weight: 800;
  font-size: 0.9rem;
  color: #60a5fa;
  font-family: 'Inter', monospace;
}

.jv-ratio-pill {
  font-size: 0.75rem;
  font-weight: 700;
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  padding: 3px 10px;
  border-radius: 12px;
}

.jv-jump-hint {
  margin-left: auto;
  font-size: 0.78rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.jv-relation-card:hover .jv-jump-hint {
  opacity: 1;
}

.jv-relation-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-left: 12px;
  border-left: 2px solid var(--border);
}

.jv-relation-line {
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--text-secondary);
}

.jv-relation-line span:last-child {
  flex: 1;
  word-break: break-word;
}

.jv-label-mini {
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 3px;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

.jv-label-mini.src {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.jv-label-mini.tgt {
  background: rgba(16, 185, 129, 0.15);
  color: #6ee7b7;
}

.jv-label-mini.diff {
  background: rgba(244, 63, 94, 0.12);
  color: #fb7185;
}

.jv-relation-missing {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-style: italic;
}

/* TM List in Modal */
.jv-tm-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.jv-tm-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.jv-tm-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.jv-tm-ref-badge {
  font-weight: 700;
  font-size: 0.88rem;
  color: var(--text-secondary);
}

.jv-tm-ref-clickable {
  color: #60a5fa;
  cursor: pointer;
  transition: var(--transition);
}

.jv-tm-ref-clickable:hover {
  color: #93c5fd;
  text-decoration: underline;
}

.jv-tm-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-left: 12px;
  border-left: 2px solid var(--border);
}

.jv-tm-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--text-secondary);
}

.jv-tm-row div {
  flex: 1;
  word-break: break-word;
}

.jv-diff-box {
  background: var(--bg-hover);
  padding: 8px 12px;
  border-radius: var(--radius-xs);
  font-family: 'Inter', monospace;
  font-size: 0.88rem;
  line-height: 1.6;
}

/* TB Grid in Modal */
.jv-tb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}

.jv-tb-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.9rem;
}

.jv-tb-src {
  font-weight: 700;
  color: #fbbf24;
}

.jv-tb-arrow {
  color: var(--text-muted);
}

.jv-tb-tgt {
  color: var(--text-primary);
}

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

:deep(.jv-tb-highlight) {
  background: rgba(245, 158, 11, 0.22);
  color: #fde68a;
  border-bottom: 2px solid #f59e0b;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 600;
}
</style>
