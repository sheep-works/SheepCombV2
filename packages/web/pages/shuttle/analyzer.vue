<script setup lang="ts">
/**
 * web/pages/shuttle/analyzer.vue
 * 翻訳対象ファイルの構造化および TM/TB / 内部類似度の解析を一括実行する画面。
 */
definePageMeta({
  title: '解析・構造化',
  icon: 'zap',
})

import { ref, computed } from 'vue'
import { FileUp, Trash2, Play, CheckCircle, AlertCircle, Database, Book, Layers, Download, ArrowRight, Settings2 } from 'lucide-vue-next'
import { useShuttleStore } from '../../stores/shuttleStore'
import { initWasm, getWasm } from '@sheep-family/core/wasm'
import { FileIO } from '../../utils/fileIO'
import { useI18n } from 'vue-i18n'

const store = useShuttleStore()
const router = useRouter()
const { t } = useI18n()

const isProcessing = ref(false)
const statusMsg = ref({ text: '', type: 'info' as 'info' | 'success' | 'error' })

// ファイル状態
const targetFiles = ref<File[]>([])
const tmFiles = ref<File[]>([])
const tbFiles = ref<File[]>([])

// ProjectInfo 設定 (任意)
const showAdvancedSettings = ref(false)
const projectName = ref('SheepWeaveProject')
const sourceLang = ref('en-US')
const targetLang = ref('ja-JP')

// ウェイト計算
const countUnit = ref<'CHARA' | 'WORD'>('CHARA')
const weights = ref<number[]>([0.1, 0.3, 0.6, 1.0, 1.0])
const tierCounts = ref<number[] | null>(null)

function doWeightedCount() {
  if (!store.hasData || !store.shuttle.data) return
  tierCounts.value = store.shuttle.manager.calculateTieredCounts(store.shuttle.data, countUnit.value)
}

const weightedSubtotals = computed(() => {
  if (!tierCounts.value) return [0, 0, 0, 0, 0]
  return tierCounts.value.map((count, i) => count * weights.value[i]!)
})

const totalRawCount = computed(() => {
  if (!tierCounts.value) return 0
  return tierCounts.value.reduce((a, b) => a + b, 0)
})

const totalWeightedCount = computed(() => {
  return weightedSubtotals.value.reduce((a, b) => a + b, 0)
})

const hasTargetFiles = computed(() => targetFiles.value.length > 0)
const hasUnitsInStore = computed(() => store.hasUnits)
const hasDataInStore = computed(() => store.hasData)
const hasTm = computed(() => tmFiles.value.length > 0)
const hasTb = computed(() => tbFiles.value.length > 0)

// 実行可能かどうか
const canRun = computed(() => {
  return hasTargetFiles.value || hasUnitsInStore.value || hasDataInStore.value
})

const validTargetExts = ['xlf', 'xliff', 'mxliff', 'sdlxliff', 'mqxliff', 'tmx', 'tbx', 'xlsx', 'csv', 'tsv', 'json', 'jsonl', 'docx']
const validTmExts = ['tmx', 'xlf', 'xliff', 'mxliff', 'mqxliff', 'sdlxliff', 'csv', 'tsv', 'xlsx', 'json', 'jsonl']
const validTbExts = ['tbx', 'csv', 'tsv', 'xlsx', 'json', 'jsonl']

function filterValidFiles(files: File[], validExts: string[], typeName: string): File[] {
  const valid: File[] = []
  const invalid: string[] = []
  for (const f of files) {
    const ext = f.name.split('.').pop()?.toLowerCase() || ''
    if (validExts.includes(ext)) {
      valid.push(f)
    } else {
      invalid.push(f.name)
    }
  }
  if (invalid.length > 0) {
    statusMsg.value = {
      text: `${typeName}の対象外ファイルを除外しました: ${invalid.join(', ')}`,
      type: 'error'
    }
  }
  return valid
}

// ファイル管理
function addTargetFiles(files: File[]) {
  const filtered = filterValidFiles(files, validTargetExts, '翻訳対象')
  if (filtered.length > 0) targetFiles.value = [...targetFiles.value, ...filtered]
}
function addTmFiles(files: File[]) {
  const filtered = filterValidFiles(files, validTmExts, 'TM')
  if (filtered.length > 0) tmFiles.value = [...tmFiles.value, ...filtered]
}
function addTbFiles(files: File[]) {
  const filtered = filterValidFiles(files, validTbExts, 'TB')
  if (filtered.length > 0) tbFiles.value = [...tbFiles.value, ...filtered]
}

function removeTargetFile(index: number) { targetFiles.value.splice(index, 1) }
function removeTm(index: number) { tmFiles.value.splice(index, 1) }
function removeTb(index: number) { tbFiles.value.splice(index, 1) }

function downloadShwv() {
  if (!store.hasData || !store.data) return
  FileIO.downloadJson(store.data, 'project.json')
  statusMsg.value = { text: 'project.json (ShWvData) をダウンロードしました', type: 'success' }
}

/**
 * 解析＆構造化の一括実行
 */
async function doAnalyzeAndStructure() {
  try {
    isProcessing.value = true
    statusMsg.value = { text: '初期化中...', type: 'info' }

    // 1. WASM の初期化
    try {
      await initWasm()
    } catch (e) {
      console.error('WASM Init:', e)
      throw new Error(t('shuttle.analyzer.err_init_wasm', 'WASM エンジンの初期化に失敗しました。'))
    }

    // 2. 翻訳対象ファイルが指定されている場合はパース
    if (targetFiles.value.length > 0) {
      statusMsg.value = { text: 'ファイルをパース中...', type: 'info' }
      const filesWithContent = await Promise.all(targetFiles.value.map(async file => {
        const ext = file.name.split('.').pop()?.toLowerCase() || ''
        const isBinary = ['xlsx', 'docx'].includes(ext)
        const isText = ['xlf', 'xliff', 'mxliff', 'sdlxliff', 'mqxliff', 'tmx', 'tbx', 'csv', 'tsv', 'json', 'jsonl'].includes(ext)
        const content = isText ? await file.text() : await file.arrayBuffer()
        return { name: file.name, content: content as any }
      }))
      await store.parseFiles(filesWithContent)
    }

    if (!store.hasUnits && !store.hasData) {
      throw new Error('解析対象のセグメントまたはデータがありません。ファイルを読み込んでください。')
    }

    // 3. 構造化（タグ保護・骨格作成）
    statusMsg.value = { text: 'タグ保護と構造化を実行中...', type: 'info' }
    const projectInfo = showAdvancedSettings.value ? {
      version: 2,
      projectName: projectName.value,
      sourceLanguage: sourceLang.value,
      targetLanguage: targetLang.value,
      sourceFiles: targetFiles.value.length > 0 ? targetFiles.value.map(f => f.name) : store.fileList.map(f => f.name),
      okapi: [
        {
          filter: "auto",
          files: (targetFiles.value.length > 0 ? targetFiles.value.map(f => f.name) : store.fileList.map(f => f.name)).map(name => ({
            source: `Data/${name}`,
            xliff: `Working/03_XLF_JSON/${name}`,
            status: "extracted" as const
          }))
        }
      ]
    } : undefined

    // 構造化を実行
    store.convert(projectInfo)

    // 4. TM 読み込み
    if (tmFiles.value.length > 0) {
      statusMsg.value = { text: 'TM を読み込み中...', type: 'info' }
      const tms = await Promise.all(tmFiles.value.map(async f => {
        const ext = f.name.split('.').pop()?.toLowerCase()
        const isBinary = ['xlsx'].includes(ext || '')
        const content = isBinary ? await f.arrayBuffer() : await f.text()
        return { name: f.name, content }
      }))
      await store.addTms(tms)
    }

    // 5. TB 読み込み
    if (tbFiles.value.length > 0) {
      statusMsg.value = { text: 'TB を読み込み中...', type: 'info' }
      const tbs = await Promise.all(tbFiles.value.map(async f => {
        const ext = f.name.split('.').pop()?.toLowerCase()
        const isBinary = ['xlsx'].includes(ext || '')
        const content = isBinary ? await f.arrayBuffer() : await f.text()
        return { name: f.name, content }
      }))
      await store.addTbs(tbs)
    }

    // 6. WASM による類似度・整合性・用語解析（TM がない場合も内部類似 quoted100 等を計算）
    statusMsg.value = { text: 'マッチング解析を実行中...', type: 'info' }
    const { analyze_all } = getWasm()
    await store.analyze(analyze_all)

    // 7. 自動でウェイト集計
    doWeightedCount()

    statusMsg.value = { text: '解析・構造化が完了しました！', type: 'success' }

  } catch (e: any) {
    console.error('Analyze error:', e)
    statusMsg.value = { text: `エラー: ${e.message}`, type: 'error' }
  } finally {
    isProcessing.value = false
  }
}

// 初期化時にすでにデータがあればウェイト計算
if (store.hasData) {
  doWeightedCount()
}
</script>

<template>
  <div class="analyze-view">
    <div class="content-card">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
        <div class="header-main">
          <Database :size="24" class="header-icon" />
          <div class="header-text">
            <h1>{{ $t('shuttle.analyzer.title', '解析・構造化') }}</h1>
            <p>{{ $t('shuttle.analyzer.subtitle', '翻訳対象ファイルのタグ保護・構造化と、TM/TB・内部類似度の解析を一括実行します') }}</p>
          </div>
        </div>
        <ManualLink
          href="https://lambuage.com/sheep-comb/02_steps_desc.html#%E3%82%B9%E3%83%86%E3%83%83%E3%83%95%E3%82%9A-4-%E7%BF%BB%E8%A8%B3%E3%83%A1%E3%83%A2%E3%83%AA%E3%81%A8%E7%94%A8%E8%AA%9E%E9%9B%86%E3%81%AE%E7%85%A7%E5%90%88-%E8%A7%A3%E6%9E%90%E3%83%98%E3%82%9A%E3%83%BC%E3%82%B7%E3%82%99"
          :label="$t('manual.steps.analyzer', 'マニュアル')"
        />
      </div>

      <!-- プロジェクト状態 -->
      <div class="project-status" v-if="hasDataInStore">
        <CheckCircle :size="16" class="status-icon" />
        <span>{{ $t('shuttle.analyzer.status_data', { count: store.shwvUnitCount }) }} (ShWvData 構築済み)</span>
      </div>
      <div class="project-status" v-else-if="hasUnitsInStore">
        <CheckCircle :size="16" class="status-icon" />
        <span>パース済みセグメント: {{ store.unitCount }} 件 (解析実行で ShWvData へ構造化されます)</span>
      </div>
      <div class="project-status warning" v-else>
        <AlertCircle :size="16" class="status-icon" />
        <span>翻訳対象ファイルまたはパース済みデータが必要です</span>
      </div>

      <div class="analyze-grid">
        <!-- 翻訳対象ファイル -->
        <div class="drop-card" style="grid-column: span 2;">
          <div class="drop-header">
            <Layers :size="18" />
            <h3>翻訳対象ファイル (XLIFF / XLSX / CSV / TMX / DOCX等)</h3>
            <span v-if="hasUnitsInStore && !hasTargetFiles" class="badge-store">ストア内のパース済みデータ利用中</span>
          </div>
          <div class="drop-area" @drop.prevent="(e) => addTargetFiles(Array.from(e.dataTransfer?.files || []))" @dragover.prevent>
            <input type="file" accept=".xlf,.xliff,.mxliff,.sdlxliff,.mqxliff,.tmx,.tbx,.xlsx,.csv,.tsv,.json,.jsonl,.docx" multiple hidden @change="(e) => addTargetFiles(Array.from((e.target as HTMLInputElement).files || []))" ref="targetInput" />
            <div class="drop-label" @click="($refs.targetInput as HTMLInputElement).click()">
              <FileUp :size="32" />
              <p>新規に対象ファイルをドロップ、またはクリックして選択</p>
              <span style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">.xlf, .mxliff, .xlsx, .csv, .tmx, .json 等</span>
            </div>
          </div>
          <div class="file-mini-list" v-if="hasTargetFiles">
            <div v-for="(f, i) in targetFiles" :key="i" class="mini-item">
              <span>{{ f.name }}</span>
              <button @click="removeTargetFile(i)"><Trash2 :size="12" /></button>
            </div>
          </div>
        </div>

        <!-- TM Section -->
        <div class="drop-card">
          <div class="drop-header">
            <Database :size="18" />
            <h3>{{ $t('shuttle.analyzer.tm_title', '翻訳メモリ (TM: 任意)') }}</h3>
          </div>
          <div class="drop-area" @drop.prevent="(e) => addTmFiles(Array.from(e.dataTransfer?.files || []))" @dragover.prevent>
            <input type="file" accept=".tmx,.xlf,.xliff,.mxliff,.mqxliff,.sdlxliff,.csv,.tsv,.xlsx,.json,.jsonl" multiple hidden @change="(e) => addTmFiles(Array.from((e.target as HTMLInputElement).files || []))" ref="tmInput" />
            <div class="drop-label" @click="($refs.tmInput as HTMLInputElement).click()">
              <FileUp :size="32" />
              <p>{{ $t('shuttle.analyzer.tm_drop', 'TMファイルをドロップ') }}</p>
              <span style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">.tmx, .xlf, .xlsx, .csv, .json, .jsonl</span>
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
            <h3>{{ $t('shuttle.analyzer.tb_title', '用語集 (TB: 任意)') }}</h3>
          </div>
          <div class="drop-area" @drop.prevent="(e) => addTbFiles(Array.from(e.dataTransfer?.files || []))" @dragover.prevent>
            <input type="file" accept=".tbx,.csv,.tsv,.xlsx,.json,.jsonl" multiple hidden @change="(e) => addTbFiles(Array.from((e.target as HTMLInputElement).files || []))" ref="tbInput" />
            <div class="drop-label" @click="($refs.tbInput as HTMLInputElement).click()">
              <FileUp :size="32" />
              <p>{{ $t('shuttle.analyzer.tb_drop', 'TBファイルをドロップ') }}</p>
              <span style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">.tbx, .xlsx, .csv, .json, .jsonl</span>
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

      <!-- 詳細設定トグル (ProjectInfo) -->
      <div style="padding: 0 24px 16px;">
        <button class="btn-text-toggle" @click="showAdvancedSettings = !showAdvancedSettings">
          <Settings2 :size="14" />
          <span>{{ showAdvancedSettings ? 'プロジェクト詳細設定を閉じる' : 'プロジェクト詳細設定 (言語・プロジェクト名など)' }}</span>
        </button>
        <div v-if="showAdvancedSettings" class="advanced-settings-box">
          <div class="form-group">
            <label>プロジェクト名:</label>
            <input v-model="projectName" type="text" class="input-sm" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>ソース言語:</label>
              <input v-model="sourceLang" type="text" class="input-sm" />
            </div>
            <div class="form-group">
              <label>ターゲット言語:</label>
              <input v-model="targetLang" type="text" class="input-sm" />
            </div>
          </div>
        </div>
      </div>

      <div class="action-footer">
        <div v-if="statusMsg.text" :class="['status-box', statusMsg.type]">
          <span>{{ statusMsg.text }}</span>
        </div>
        <div style="display: flex; gap: 12px; align-items: center; margin-left: auto;">
          <button class="btn-outline-action" v-if="hasDataInStore" @click="downloadShwv" style="font-size: 0.9rem; padding: 8px 16px;">
            <Download :size="16" /> ShWvData (JSON)
          </button>
          <button class="btn-outline-action" v-if="hasDataInStore" @click="router.push('/shuttle/manage')" style="font-size: 0.9rem; padding: 8px 16px;">
            管理・QAへ <ArrowRight :size="16" />
          </button>
          <button class="btn-run" @click="doAnalyzeAndStructure" :disabled="isProcessing || !canRun">
            <Play v-if="!isProcessing" :size="18" />
            <span v-else class="loader"></span>
            {{ isProcessing ? '処理中...' : '解析・構造化を実行' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ウェイト計算結果テーブル -->
    <div class="content-card" style="margin-top: 24px;" v-if="tierCounts">
      <div class="card-header space-between" style="display: flex; justify-content: space-between; align-items: center;">
        <div class="header-main">
          <div class="header-text">
            <h1 style="font-size: 1.1rem;">ウェイト計算結果 (統計サマリー)</h1>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; background: var(--bg-secondary); padding: 4px 12px; border-radius: 4px; border: 1px solid var(--border);">
          <select v-model="countUnit" @change="doWeightedCount" class="select-sm" style="padding: 2px 4px; font-size: 0.8rem; border: none; background: transparent; cursor: pointer; color: var(--text);">
            <option value="CHARA" style="background: var(--bg-secondary); color: var(--text);">文字数 (Chara)</option>
            <option value="WORD" style="background: var(--bg-secondary); color: var(--text);">単語数 (Word)</option>
          </select>
        </div>
      </div>
      <div class="table-container" style="padding: 0 24px 24px;">
        <table style="width: 100%; text-align: left; border-collapse: collapse; margin-top: 16px;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border);">
              <th style="padding: 12px 8px;">一致率区分</th>
              <th style="padding: 12px 8px;">文字数 / 単語数</th>
              <th style="padding: 12px 8px; width: 100px;">ウェイト</th>
              <th style="padding: 12px 8px;">小計</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid var(--border);">
              <td style="padding: 12px 8px;">100% 一致 (内部/外部)</td>
              <td style="padding: 12px 8px; font-variant-numeric: tabular-nums;">{{ tierCounts[0]?.toLocaleString() }}</td>
              <td style="padding: 12px 8px;"><input type="number" step="0.1" min="0" max="1" v-model.number="weights[0]" class="input-sm" style="width: 70px;" /></td>
              <td style="padding: 12px 8px; font-weight: 600; font-variant-numeric: tabular-nums;">{{ Math.round(weightedSubtotals[0] || 0).toLocaleString() }}</td>
            </tr>
            <tr style="border-bottom: 1px solid var(--border);">
              <td style="padding: 12px 8px;">99% ～ 95%</td>
              <td style="padding: 12px 8px; font-variant-numeric: tabular-nums;">{{ tierCounts[1]?.toLocaleString() }}</td>
              <td style="padding: 12px 8px;"><input type="number" step="0.1" min="0" max="1" v-model.number="weights[1]" class="input-sm" style="width: 70px;" /></td>
              <td style="padding: 12px 8px; font-weight: 600; font-variant-numeric: tabular-nums;">{{ Math.round(weightedSubtotals[1] || 0).toLocaleString() }}</td>
            </tr>
            <tr style="border-bottom: 1px solid var(--border);">
              <td style="padding: 12px 8px;">94% ～ 85%</td>
              <td style="padding: 12px 8px; font-variant-numeric: tabular-nums;">{{ tierCounts[2]?.toLocaleString() }}</td>
              <td style="padding: 12px 8px;"><input type="number" step="0.1" min="0" max="1" v-model.number="weights[2]" class="input-sm" style="width: 70px;" /></td>
              <td style="padding: 12px 8px; font-weight: 600; font-variant-numeric: tabular-nums;">{{ Math.round(weightedSubtotals[2] || 0).toLocaleString() }}</td>
            </tr>
            <tr style="border-bottom: 1px solid var(--border);">
              <td style="padding: 12px 8px;">84% ～ 75%</td>
              <td style="padding: 12px 8px; font-variant-numeric: tabular-nums;">{{ tierCounts[3]?.toLocaleString() }}</td>
              <td style="padding: 12px 8px;"><input type="number" step="0.1" min="0" max="1" v-model.number="weights[3]" class="input-sm" style="width: 70px;" /></td>
              <td style="padding: 12px 8px; font-weight: 600; font-variant-numeric: tabular-nums;">{{ Math.round(weightedSubtotals[3] || 0).toLocaleString() }}</td>
            </tr>
            <tr style="border-bottom: 2px solid var(--border);">
              <td style="padding: 12px 8px;">74% 以下 (新規)</td>
              <td style="padding: 12px 8px; font-variant-numeric: tabular-nums;">{{ tierCounts[4]?.toLocaleString() }}</td>
              <td style="padding: 12px 8px;"><input type="number" step="0.1" min="0" max="1" v-model.number="weights[4]" class="input-sm" style="width: 70px;" /></td>
              <td style="padding: 12px 8px; font-weight: 600; font-variant-numeric: tabular-nums;">{{ Math.round(weightedSubtotals[4] || 0).toLocaleString() }}</td>
            </tr>
            <tr style="background: var(--bg-hover);">
              <td style="padding: 12px 8px; font-weight: bold;">合計</td>
              <td style="padding: 12px 8px; font-weight: bold; font-variant-numeric: tabular-nums; color: var(--accent);">{{ totalRawCount.toLocaleString() }}</td>
              <td style="padding: 12px 8px;"></td>
              <td style="padding: 12px 8px; font-weight: bold; font-variant-numeric: tabular-nums; color: var(--accent);">{{ Math.round(totalWeightedCount).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
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

.badge-store {
  font-size: 0.7rem;
  padding: 2px 8px;
  background: var(--accent-glow);
  color: var(--accent-light);
  border-radius: 4px;
  font-weight: 600;
  margin-left: auto;
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

.btn-text-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.8rem;
  cursor: pointer;
  padding: 4px 0;
}

.btn-text-toggle:hover {
  color: var(--accent);
}

.advanced-settings-box {
  margin-top: 12px;
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group label {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.input-sm {
  padding: 6px 10px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 0.85rem;
}

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

.btn-outline-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition);
}

.btn-outline-action:hover {
  border-color: var(--accent);
  color: var(--accent);
}

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
