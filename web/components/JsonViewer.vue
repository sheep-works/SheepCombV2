<script setup lang="ts">
// Note: Using relative paths instead of Nuxt aliases (~~, ~, @) to ensure stable resolution.
import { ref, computed } from 'vue'
import type { ShWvData, ShWvUnit, ShWvMeta, ShWvRefTm } from '../../logic/types/shwv.js'



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

function resetPage() {
  page.value = 0
}

defineExpose({ resetPage })
</script>

<template>
  <div class="jv-container" v-if="data">
    <!-- Meta Info Panel -->
    <div v-if="meta" class="jv-meta">
      <div class="jv-meta-row" v-if="meta.sourceLang || meta.targetLang">
        <span class="jv-meta-key">Languages</span>
        <span class="jv-meta-val">{{ meta.sourceLang || '(auto)' }} ↁE{{ meta.targetLang || '(auto)' }}</span>
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
      <button @click="page--" :disabled="page <= 0" class="jv-btn">ↁEPrev</button>
      <span class="jv-page-info">{{ page + 1 }} / {{ totalPages }}</span>
      <button @click="page++" :disabled="page >= totalPages - 1" class="jv-btn">Next </button>
    </div>

    <!-- Data Table -->
    <table class="jv-table">
      <thead>
        <tr>
          <th class="jv-th-idx">Idx</th>
          <th>Content</th>
        </tr>
      </thead>
      <tbody v-for="unit in pageItems" :key="unit.idx" class="jv-tbody">
        <tr class="jv-main-row">
          <td class="jv-td-idx">{{ unit.idx }}</td>
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
              <span class="jv-label jv-label-ref">REF #{{ (tm as ShWvRefTm).idx }}</span>
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
            <span v-for="(q, qi) in unit.ref.quoted" :key="'q' + String(qi)" class="jv-quoted">
              #{{ q[0] }} ({{ q[1] }}%)
            </span>
          </td>
        </tr>
      </tbody>
    </table>
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
  width: 60px;
  text-align: center !important;
}

.jv-tbody {
  background: var(--bg-card);
  border-radius: var(--radius-sm);
}

.jv-tbody:hover {
  background: var(--bg-card-hover);
}

.jv-main-row td {
  padding: 10px 16px;
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
  font-family: 'Inter', monospace;
  font-size: 0.78rem;
  color: var(--text-muted);
  font-weight: 600;
  vertical-align: top;
}

.jv-td-ref {
  text-align: center;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--text-muted);
  vertical-align: top;
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

.jv-label-ref {
  background: rgba(139, 92, 246, 0.15);
  color: #a78bfa;
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

.jv-quoted {
  display: inline-block;
  font-size: 0.72rem;
  background: var(--bg-hover);
  padding: 2px 8px;
  border-radius: 4px;
  margin: 2px 4px 2px 0;
  color: var(--text-secondary);
}
</style>
