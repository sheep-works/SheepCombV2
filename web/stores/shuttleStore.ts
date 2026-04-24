/**
 * web/stores/shuttleStore.ts
 * SheepShuttle の状態を一元管理するストア。
 * パース済みの生ユニット、構造化データ、TM/TB などを保持します。
 */
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
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
import { type ChunkInfo } from '../../logic/shuttle/sheepShuttle.js'

export const useShuttleStore = defineStore('shuttle', () => {
  const config = useRuntimeConfig()

  // --- 内部インスタンス ---
  const shuttle = new SheepShuttle({
    baseUrl: config.public.apiBaseUrl as string,
    port: config.public.apiPort as string | number
  })

  // --- State ---
  // SheepShuttle の内部ステートと同期させるための ref
  const units = ref<TranslationPair[]>([])
  const files = ref<ShWvFileInfo[]>([])
  const data = ref<ShWvData | null>(null)
  const tms = ref<TranslationPairWithFile[]>([])
  const tbs = ref<TranslationPairWithFile[]>([])
  const chunks = ref<ChunkInfo[]>([])

  const isApiAvailable = ref(false)

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
  const hasChunks = computed(() => chunks.value.length > 0)

  // --- Actions ---

  /**
   * API サーバーの接続確認
   */
  async function checkConnection() {
    isApiAvailable.value = await shuttle.requests.verifyConnection()
    return isApiAvailable.value
  }

  /**
   * インスタンスの状態をストアの ref に反映させる
   */
  function syncState() {
    units.value = [...shuttle.units]
    files.value = [...shuttle.files]
    data.value = shuttle.data ? shuttle.data : null // data は structuredClone 済み
    tms.value = [...shuttle.tms]
    tbs.value = [...shuttle.tbs]
    chunks.value = [...shuttle.chunks]
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
   * チャンクの作成
   */
  function createChunks(type: 'units' | 'data', maxChars?: number) {
    shuttle.createChunks(type, maxChars)
    syncState()
  }

  /**
   * API リクエストの実行
   */
  async function processRequests(chunkIndex: number = -1, target: 'CHECK' | 'TRANSLATE' = 'CHECK', prompt?: string) {
    isLoading.value = true
    try {
      await shuttle.processRequests(chunkIndex, target, prompt)
      syncState()
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 各種形式でのデータ取得
   */
  function getManagedData(type: ManagedDataType, maxChars?: number) {
    return shuttle.getManagedData(type, maxChars)
  }

  /**
   * チャンク（リクエスト結果）のみをクリア
   */
  function clearChunks() {
    shuttle.chunks = []
    syncState()
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

  // --- Rehydration (永続化データからの復元) ---
  // localStorage からデータが復元された直後に、内部の shuttle インスタンスにも同期させる
  const rehydrate = () => {
    if (units.value.length > 0) shuttle.units = [...units.value]
    if (files.value.length > 0) shuttle.files = [...files.value]
    if (data.value) shuttle.data = data.value
    if (tms.value.length > 0) shuttle.tms = [...tms.value]
    if (tbs.value.length > 0) shuttle.tbs = [...tbs.value]
    if (chunks.value.length > 0) shuttle.chunks = [...chunks.value]
  }

  // 永続化データが復元された際にインスタンスに同期する
  const unwatch = watch(units, (newVal) => {
    if (newVal && newVal.length > 0) {
      rehydrate()
      // 一度同期したら監視を解除（以後はアクション経由で同期されるため）
      unwatch()
    }
  }, { immediate: true })

  return {
    // State
    units,
    files,
    data,
    tms,
    tbs,
    chunks,
    isApiAvailable,
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
    hasChunks,
    // Actions
    checkConnection,
    parseFiles,
    loadShwvData,
    addTms,
    addTbs,
    process,
    convert,
    analyze,
    createChunks,
    processRequests,
    clearChunks,
    getManagedData,
    clear,
    setStatus,
    rehydrate,
    // インスタンスへの直接アクセスが必要な場合用
    shuttle
  }
}, {
  persist: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    // 保存対象を指定 (shuttle インスタンス自体は除外)
    pick: [
      'units',
      'files',
      'data',
      'tms',
      'tbs',
      'chunks',
      'currentFileName'
    ]
  }
})
