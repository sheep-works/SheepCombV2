<script setup lang="ts">
/**
 * web/pages/shuttle/constructor.vue
 */
definePageMeta({
  title: '構造化',
  icon: 'layers',
})

import { ref, computed } from 'vue'
import { FileUp, Trash2, Play, FileText, CheckCircle, AlertCircle, Layers } from 'lucide-vue-next'
// Note: Using relative paths instead of Nuxt aliases (~~, ~, @) to ensure stable resolution.
import { useShuttleStore } from '../../stores/shuttleStore'
import { SheepShuttle } from '../../../logic/shuttle/sheepShuttle.js'
import { FileIO } from '../../utils/fileIO'
import { useI18n } from 'vue-i18n'

const store = useShuttleStore()
const router = useRouter()
const { t } = useI18n()

const fileInput = ref<HTMLInputElement | null>(null)
const selectedFiles = ref<File[]>([])

const isProcessing = computed(() => store.isLoading || store.isProgressing)
const statusMsg = computed(() => {
  if (store.isProgressing) {
    return { text: store.progressText, type: 'info' as const }
  }
  return { text: store.statusMsg.text, type: store.statusMsg.type as 'info' | 'success' | 'error' }
})

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
function clearFiles() { selectedFiles.value = []; store.setStatus('', 'info') }

const includeProjectInfo = ref(false)
const projectName = ref('SheepWeaveProject')
const sourceLang = ref('en-US')
const targetLang = ref('ja-JP')

/**
 * 構造化を実行
 */
async function doConvert() {
  try {
    store.setStatus(t('shuttle.constructor.msg_processing'), 'info')

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
      throw new Error(t('shuttle.constructor.err_no_units_throw'))
    }

    // 構造化（ShWvData への変換）実行
    let projectInfo = undefined
    if (includeProjectInfo.value) {
      projectInfo = {
        version: 2,
        projectName: projectName.value,
        sourceLanguage: sourceLang.value,
        targetLanguage: targetLang.value,
        sourceFiles: selectedFiles.value.length > 0 ? selectedFiles.value.map(f => f.name) : store.fileList.map(f => f.name),
        okapi: [
          {
            filter: "auto",
            files: (selectedFiles.value.length > 0 ? selectedFiles.value.map(f => f.name) : store.fileList.map(f => f.name)).map(name => ({
              source: `Data/${name}`,
              xliff: `Working/03_XLF_JSON/${name}`,
              status: "extracted" as const
            }))
          }
        ]
      }
    }
    store.convert(projectInfo)

    store.setStatus(t('shuttle.constructor.msg_success'), 'success')
    setTimeout(() => {
      router.push('/shuttle/analyzer')
    }, 800)

  } catch (e: any) {
    console.error('Convert error:', e)
    store.setStatus(t('shuttle.constructor.msg_error', { message: e.message }), 'error')
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
            <h1>{{ $t('shuttle.constructor.title') }}</h1>
            <p>{{ $t('shuttle.constructor.subtitle') }}</p>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn-clear" @click="clearFiles" :disabled="!hasFiles || isProcessing">
            <Trash2 :size="16" /> {{ $t('shuttle.constructor.clear') }}
          </button>
        </div>
      </div>

      <!-- ストアの状態表示 -->
      <div class="store-status" v-if="hasUnitsInStore">
        <div class="status-badge">
          <CheckCircle :size="16" />
          <span>{{ $t('shuttle.constructor.parsed_units', { count: store.unitCount }) }}</span>
        </div>
        <p class="status-desc">{{ $t('shuttle.constructor.parsed_units_desc') }}</p>
      </div>

      <div class="drop-zone" v-if="!hasUnitsInStore" @drop="handleFileDrop" @dragover.prevent
        @click="fileInput?.click()">
        <FileUp :size="48" class="drop-icon" />
        <p class="drop-text">{{ $t('shuttle.constructor.drop_text') }}</p>
        <p class="drop-hint">{{ $t('shuttle.constructor.drop_hint') }}</p>
        <input type="file" ref="fileInput" hidden multiple @change="handleFileSelect" />
      </div>

      <div v-if="hasFiles" class="file-list-section">
        <h2 class="section-title">{{ $t('shuttle.constructor.additional_files', { count: selectedFiles.length }) }}</h2>
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

      <!-- ProjectInfo 入力フォーム -->
      <div class="project-info-section">
        <label class="toggle-label">
          <input type="checkbox" v-model="includeProjectInfo" :disabled="isProcessing" />
          <span>{{ $t('shuttle.constructor.include_project_info') }}</span>
        </label>
        
        <div class="form-container" v-if="includeProjectInfo">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">{{ $t('shuttle.constructor.project_name_label') }}</label>
              <input type="text" v-model="projectName" class="form-input" :disabled="isProcessing" :placeholder="$t('shuttle.constructor.project_name_placeholder')" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">{{ $t('shuttle.constructor.source_lang') }}</label>
              <select v-model="sourceLang" class="form-select" :disabled="isProcessing">
                <option value="en-US">{{ $t('shuttle.constructor.lang_en') }}</option>
                <option value="ja-JP">{{ $t('shuttle.constructor.lang_ja') }}</option>
                <option value="zh-CN">{{ $t('shuttle.constructor.lang_zh') }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">{{ $t('shuttle.constructor.target_lang') }}</label>
              <select v-model="targetLang" class="form-select" :disabled="isProcessing">
                <option value="en-US">{{ $t('shuttle.constructor.lang_en') }}</option>
                <option value="ja-JP">{{ $t('shuttle.constructor.lang_ja') }}</option>
                <option value="zh-CN">{{ $t('shuttle.constructor.lang_zh') }}</option>
              </select>
            </div>
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
          <span>{{ $t('shuttle.constructor.err_no_units') }}</span>
        </div>

        <button class="btn-run" @click="doConvert" :disabled="isProcessing || (!hasUnitsInStore && !hasFiles)">
          <Play v-if="!isProcessing" :size="18" />
          <span v-else class="loader"></span>
          {{ isProcessing ? $t('shuttle.constructor.running') : $t('shuttle.constructor.run') }}
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

/* ProjectInfo Form Styles */
.project-info-section {
  margin: 0 24px 24px;
  padding: 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-primary);
  cursor: pointer;
}

.toggle-label input {
  accent-color: var(--accent);
  width: 16px;
  height: 16px;
}

.form-container {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  border-top: 1px solid var(--border);
  padding-top: 16px;
}

.form-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.form-group {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-input,
.form-select {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  color: var(--text-primary);
  padding: 10px 12px;
  font-size: 0.88rem;
  outline: none;
  transition: var(--transition);
  font-family: inherit;
}

.form-input:focus,
.form-select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-glow);
}
</style>
