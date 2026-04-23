/**
 * web/stores/shuttleStore.ts
 * SheepShuttle の状態を一元管理するストア。
 * パース済みの生ユニット、構造化データ、TM/TB などを保持します。
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { SheepShuttle } from '../../logic/shuttle/sheepShuttle.js'
import type {
  TranslationPair,
  TranslationPairWithFile,
  ShWvData,
  ShWvUnit,
  ShWvFileInfo,
  ManagedDataType,
  ProcessorOptions
} from '../../logic/types/shwv.js'

export const useShuttleStore = defineStore('shuttle', () => {
  // --- 内部インスタンス ---
  const shuttle = new SheepShuttle()

  // --- State ---
  // SheepShuttle の内部ステートと同期させるための ref
  const units = ref<TranslationPair[]>([])
  const files = ref<ShWvFileInfo[]>([])
  const data = ref<ShWvData | null>(null)
  const tms = ref<TranslationPairWithFile[]>([])
  const tbs = ref<TranslationPairWithFile[]>([])

  const currentFileName = ref('')
  const isLoading = ref(false)
  const statusMsg = ref({ text: '', type: 'info' as 'info' | 'success' | 'error' })

  // --- Getters ---
  const hasData = computed(() => data.value !== null)
  const hasUnits = computed(() => units.value.length > 0)
  const unitCount = computed(() => units.value.length)
  const shwvUnitCount = computed(() => data.value?.body.units.length ?? 0)
  const fileList = computed(() => files.value)
  const tmCount = computed(() => tms.value.length)
  const tbCount = computed(() => tbs.value.length)

  // --- Actions ---

  /**
   * インスタンスの状態をストアの ref に反映させる
   */
  function syncState() {
    units.value = [...shuttle.units]
    files.value = [...shuttle.files]
    data.value = shuttle.data ? shuttle.data : null // data は structuredClone 済み
    tms.value = [...shuttle.tms]
    tbs.value = [...shuttle.tbs]
  }

  /**
   * ソースファイルのパースを実行
   */
  async function parseFiles(inputFiles: { name: string, content: string | ArrayBuffer | Uint8Array }[]) {
    isLoading.value = true
    try {
      await shuttle.parse(inputFiles)
      syncState()
      currentFileName.value = inputFiles.length === 1 ? inputFiles[0]!.name : `${inputFiles.length} files`
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 既存の ShWvData をセット（ファイル読み込み時など）
   */
  async function loadShwvData(newData: ShWvData, name: string = '') {
    shuttle.setNewData(newData)
    syncState()
    currentFileName.value = name
  }

  /**
   * TM ファイルの追加
   */
  async function addTms(inputFiles: { name: string, content: string | ArrayBuffer | Uint8Array }[]) {
    await shuttle.addTms(inputFiles)
    syncState()
  }

  /**
   * TB ファイルの追加
   */
  async function addTbs(inputFiles: { name: string, content: string | ArrayBuffer | Uint8Array }[]) {
    await shuttle.addTbs(inputFiles)
    syncState()
  }

  /**
   * プロセッサ、コンバータ、アナライザの実行
   */
  function process(options?: ProcessorOptions) { shuttle.process(options); syncState() }
  function convert() { shuttle.convert(); syncState() }
  async function analyze(wasmAnalyzeAll?: any) {
    await shuttle.analyze(wasmAnalyzeAll)
    syncState()
  }

  /**
   * 各種形式でのデータ取得
   */
  function getManagedData(type: ManagedDataType, maxChars?: number) {
    return shuttle.getManagedData(type, maxChars)
  }

  /**
   * 状態のリセット
   */
  function clear() {
    shuttle.reset()
    syncState()
    currentFileName.value = ''
    statusMsg.value = { text: '', type: 'info' }
  }

  function setStatus(text: string, type: 'info' | 'success' | 'error' = 'info') {
    statusMsg.value = { text, type }
  }

  return {
    // State
    units,
    files,
    data,
    tms,
    tbs,
    currentFileName,
    isLoading,
    statusMsg,
    // Getters
    hasData,
    hasUnits,
    unitCount,
    shwvUnitCount,
    fileList,
    tmCount,
    tbCount,
    // Actions
    parseFiles,
    loadShwvData,
    addTms,
    addTbs,
    process,
    convert,
    analyze,
    getManagedData,
    clear,
    setStatus,
    // インスタンスへの直接アクセスが必要な場合用
    shuttle
  }
})
