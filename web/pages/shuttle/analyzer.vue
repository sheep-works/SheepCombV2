<script setup lang="ts">
/**
 * web/pages/shuttle/analyzer.vue
 */
definePageMeta({
  title: '解析',
  icon: 'zap',
})

import { ref, computed } from 'vue'
import { FileUp, Trash2, Play, FileSearch, CheckCircle, AlertCircle, Database, Book } from 'lucide-vue-next'
import { useShuttleStore } from '../../stores/shuttleStore'
import { initWasm, getWasm } from '../../../logic/wasm.js'
import { useI18n } from 'vue-i18n'

const store = useShuttleStore()
const router = useRouter()
const { t } = useI18n()

const isProcessing = ref(false)
const statusMsg = ref({ text: '', type: 'info' as 'info' | 'success' | 'error' })

const tmFiles = ref<File[]>([])
const tbFiles = ref<File[]>([])

const hasTm = computed(() => tmFiles.value.length > 0)
const hasTb = computed(() => tbFiles.value.length > 0)
const hasDataInStore = computed(() => store.hasData)

// --- ファイル管理 ---
function addTmFiles(files: File[]) { tmFiles.value = [...tmFiles.value, ...files] }
function addTbFiles(files: File[]) { tbFiles.value = [...tbFiles.value, ...files] }
function removeTm(index: number) { tmFiles.value.splice(index, 1) }
function removeTb(index: number) { tbFiles.value.splice(index, 1) }

/**
 * 解析を実行 (TM/TB 追加 -> 分析)
 */
async function doAnalyze() {
  if (!store.hasData) {
    statusMsg.value = { text: t('shuttle.analyzer.msg_no_data'), type: 'error' }
    return
  }

  try {
    isProcessing.value = true
    statusMsg.value = { text: t('shuttle.analyzer.msg_init_wasm'), type: 'info' }

    // WASM の初期化（初回のみ）
    let wasm: any
    try {
      wasm = await initWasm()
    } catch (e) {
      console.error('WASM Init:', e)
      throw new Error(t('shuttle.analyzer.err_init_wasm'))
    }

    statusMsg.value = { text: t('shuttle.analyzer.msg_loading_tmtb'), type: 'info' }

    // TM 読み込み
    if (tmFiles.value.length > 0) {
      const tms = await Promise.all(tmFiles.value.map(async f => ({
        name: f.name,
        content: await f.text()
      })))
      await store.addTms(tms)
    }

    // TB 読み込み
    if (tbFiles.value.length > 0) {
      const tbs = await Promise.all(tbFiles.value.map(async f => ({
        name: f.name,
        content: await f.text()
      })))
      await store.addTbs(tbs)
    }

    statusMsg.value = { text: t('shuttle.analyzer.msg_analyzing'), type: 'info' }
    // 分析（WASM エンジン等の呼び出し）
    const { analyze_all } = getWasm()
    await store.analyze(analyze_all)

    statusMsg.value = { text: t('shuttle.analyzer.msg_analyze_success'), type: 'success' }
    setTimeout(() => {
      router.push('/shuttle/manage')
    }, 800)

  } catch (e: any) {
    console.error('Analyze error:', e)
    statusMsg.value = { text: t('shuttle.analyzer.msg_error', { message: e.message }), type: 'error' }
  } finally {
    isProcessing.value = false
  }
}
</script>

<template>
  <div class="analyze-view">
    <div class="content-card">
      <div class="card-header">
        <div class="header-main">
          <Database :size="24" class="header-icon" />
          <div class="header-text">
            <h1>{{ $t('shuttle.analyzer.title') }}</h1>
            <p>{{ $t('shuttle.analyzer.subtitle') }}</p>
          </div>
        </div>
      </div>

      <!-- プロジェクト状態 -->
      <div class="project-status" v-if="hasDataInStore">
        <CheckCircle :size="16" class="status-icon" />
        <span>{{ $t('shuttle.analyzer.status_data', { count: store.shwvUnitCount }) }}</span>
      </div>
      <div class="project-status warning" v-else>
        <AlertCircle :size="16" class="status-icon" />
        <span>{{ $t('shuttle.analyzer.status_no_data') }}</span>
      </div>

      <div class="analyze-grid">
        <!-- TM Section -->
        <div class="drop-card">
          <div class="drop-header">
            <Database :size="18" />
            <h3>{{ $t('shuttle.analyzer.tm_title') }}</h3>
          </div>
          <div class="drop-area" @drop.prevent="(e) => addTmFiles(Array.from(e.dataTransfer?.files || []))" @dragover.prevent>
            <input type="file" multiple hidden @change="(e) => addTmFiles(Array.from((e.target as HTMLInputElement).files || []))" ref="tmInput" />
            <div class="drop-label" @click="($refs.tmInput as HTMLInputElement).click()">
              <FileUp :size="32" />
              <p>{{ $t('shuttle.analyzer.tm_drop') }}</p>
            </div>
          </div>
          <div class="file-mini-list" v-if="hasTm">
            <div v-for="(f, i) in tmFiles" :key="i" class="mini-item">
              <span>{{ f.name }}</span>
              <button @click="removeTm(i)"><Trash2 :size="12" /></button>
            </div>
          </div>
        </div>

        <!-- TB Section -->
        <div class="drop-card">
          <div class="drop-header">
            <Book :size="18" />
            <h3>{{ $t('shuttle.analyzer.tb_title') }}</h3>
          </div>
          <div class="drop-area" @drop.prevent="(e) => addTbFiles(Array.from(e.dataTransfer?.files || []))" @dragover.prevent>
            <input type="file" multiple hidden @change="(e) => addTbFiles(Array.from((e.target as HTMLInputElement).files || []))" ref="tbInput" />
            <div class="drop-label" @click="($refs.tbInput as HTMLInputElement).click()">
              <FileUp :size="32" />
              <p>{{ $t('shuttle.analyzer.tb_drop') }}</p>
            </div>
          </div>
          <div class="file-mini-list" v-if="hasTb">
            <div v-for="(f, i) in tbFiles" :key="i" class="mini-item">
              <span>{{ f.name }}</span>
              <button @click="removeTb(i)"><Trash2 :size="12" /></button>
            </div>
          </div>
        </div>
      </div>

      <div class="action-footer">
        <div v-if="statusMsg.text" :class="['status-box', statusMsg.type]">
          <span>{{ statusMsg.text }}</span>
        </div>
        <button class="btn-run" @click="doAnalyze" :disabled="isProcessing || !hasDataInStore">
          <Play v-if="!isProcessing" :size="18" />
          <span v-else class="loader"></span>
          {{ isProcessing ? $t('shuttle.analyzer.btn_analyzing') : $t('shuttle.analyzer.btn_analyze') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.analyze-view {
  padding: 32px;
  max-width: 1100px;
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
}

.header-main {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon { color: var(--accent); }
.header-text h1 { font-size: 1.25rem; font-weight: 800; margin: 0; color: var(--text-primary); }
.header-text p { font-size: 0.85rem; color: var(--text-muted); margin: 4px 0 0; }

.project-status {
  margin: 20px 24px 0;
  padding: 10px 16px;
  background: var(--bg-hover);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--accent);
}

.project-status.warning {
  color: var(--warning);
  background: rgba(245, 158, 11, 0.05);
}

.analyze-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  padding: 24px;
}

.drop-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.drop-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
}

.drop-header h3 { font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }

.drop-area {
  border: 2px dashed var(--border);
  border-radius: var(--radius-xs);
  padding: 30px 20px;
  text-align: center;
  transition: var(--transition);
}

.drop-area:hover { border-color: var(--accent); background: var(--accent-glow); }

.drop-label { cursor: pointer; color: var(--text-muted); }
.drop-label p { font-size: 0.75rem; margin-top: 8px; }

.file-mini-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 120px;
  overflow-y: auto;
}

.mini-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: var(--bg-secondary);
  border-radius: 4px;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.mini-item button {
  background: none;
  border: none;
  color: var(--error);
  cursor: pointer;
  opacity: 0.6;
}

.mini-item button:hover { opacity: 1; }

.action-footer {
  padding: 24px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.status-box {
  flex: 1;
  padding: 10px 16px;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  background: var(--bg-hover);
}

.status-box.success { color: var(--success); background: rgba(16, 185, 129, 0.1); }
.status-box.error { color: var(--error); background: rgba(239, 68, 68, 0.1); }

.btn-run {
  display: flex;
  align-items: center;
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

.btn-run:hover:not(:disabled) { transform: translateY(-2px); }
.btn-run:disabled { opacity: 0.5; cursor: not-allowed; filter: grayscale(1); }

.loader {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
