/**
 * web/stores/shuttleStore.ts
 * SheepShuttle の状態を一元管理するストア。
 * パース済みの生ユニット、構造化データ、TM/TB などを保持します。
 */
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { SheepShuttle } from '@sheep-family/core'
import type {
  TranslationPair,
  TranslationPairWithFile,
  ShWvData,
  ShWvUnit,
  ShWvFileInfo,
  ManagedDataType,
  ProcessorOptions,
  ProjectInfo
} from '@sheep-family/types'
import { type ChunkInfo } from '@sheep-family/core'

export const useShuttleStore = defineStore('shuttle', () => {
  const config = useRuntimeConfig()

  // --- 内部インスタンス ---
  const shuttle = new SheepShuttle({
    baseUrl: config.public.apiBaseUrl as string,
    port: config.public.apiPort as string | number,
    apiKey: config.public.apiKey as string,
    isDev: config.public.apiDev as boolean | string === 'true'
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
  const isDevOverride = ref(config.public.apiDev as boolean | string === 'true')

  // SubLlm State
  const provider = ref<'fastapi' | 'ollama' | 'lmstudio' | 'honox-local' | 'honox-cloud'>('fastapi')
  const ollamaUrl = ref('http://localhost:11434')
  const lmStudioUrl = ref('http://localhost:1234')
  const honoxUrl = ref('http://localhost:8000')
  const honoxCloudUrl = ref('')
  const ollamaModel = ref('')
  const lmStudioModel = ref('')
  const honoxApiKey = ref('')
  const honoxCloudApiKey = ref('')
  const models = ref<string[]>([])
  
  const providerUrl = computed({
    get: () => {
      if (provider.value === 'ollama') return ollamaUrl.value
      if (provider.value === 'lmstudio') return lmStudioUrl.value
      if (provider.value === 'honox-local') return honoxUrl.value
      if (provider.value === 'honox-cloud') return honoxCloudUrl.value
      return ''
    },
    set: (val) => {
      if (provider.value === 'ollama') ollamaUrl.value = val
      if (provider.value === 'lmstudio') lmStudioUrl.value = val
      if (provider.value === 'honox-local') honoxUrl.value = val
      if (provider.value === 'honox-cloud') honoxCloudUrl.value = val
    }
  })

  const selectedModel = computed({
    get: () => provider.value === 'ollama' ? ollamaModel.value : provider.value === 'lmstudio' ? lmStudioModel.value : '',
    set: (val) => {
      if (provider.value === 'ollama') ollamaModel.value = val
      if (provider.value === 'lmstudio') lmStudioModel.value = val
    }
  })
  const isConnected = ref(false)

  // Progress Integration
  const isProgressing = ref(false)
  const progressText = ref('')



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

  function syncProviderOptions() {
    shuttle.requests.updateOptions({
      provider: provider.value,
      ollamaUrl: ollamaUrl.value,
      lmStudioUrl: lmStudioUrl.value,
      honoxUrl: honoxUrl.value,
      honoxCloudUrl: honoxCloudUrl.value,
      ollamaModel: ollamaModel.value,
      lmStudioModel: lmStudioModel.value,
      honoxApiKey: honoxApiKey.value,
      honoxCloudApiKey: honoxCloudApiKey.value
    })
  }

  /**
   * API サーバーの接続確認
   */
  async function checkConnection() {
    syncProviderOptions()
    isApiAvailable.value = await shuttle.requests.verifyConnection()
    if (provider.value === 'honox-local' || provider.value === 'honox-cloud' || provider.value === 'fastapi') {
      isConnected.value = isApiAvailable.value
    }
    return isApiAvailable.value
  }

  /**
   * LLMモデル一覧の取得
   */
  async function fetchModels() {
    syncProviderOptions()
    if (provider.value === 'fastapi') {
      models.value = []
      return
    }
    isProgressing.value = true
    progressText.value = 'Loading models...'
    models.value = await shuttle.requests.getModels()
    isConnected.value = models.value.length > 0
    isProgressing.value = false
    if (models.value.length > 0 && !models.value.includes(selectedModel.value)) {
      selectedModel.value = models.value[0] || ''
    }
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
  async function parseFiles(inputFiles: { name: string, content: string | ArrayBuffer | Uint8Array }[], splitByNewline: boolean = true) {
    isLoading.value = true
    try {
      await shuttle.parse(inputFiles, (msg) => {
        progressText.value = msg
      }, splitByNewline)
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
  function sampling(sampledTotal: number, seed?: number) { const res = shuttle.sampling(sampledTotal, seed); syncState(); return res }
  function convert(projectInfo?: ProjectInfo) { shuttle.convert(projectInfo); syncState() }
  async function analyze(wasmAnalyzeAll?: any) {
    await shuttle.analyze(wasmAnalyzeAll)
    // Automatically build search index after analysis
    buildSearchIndex()
    syncState()
  }

  /**
   * 検索インデックスの構築
   */
  async function buildSearchIndex() {
    if (!shuttle.data && shuttle.units.length === 0) return;
    
    isProgressing.value = true
    progressText.value = 'Preparing search index...'
    await fallbackBuildSearchIndex()
    isProgressing.value = false
  }

  async function fallbackBuildSearchIndex() {
    if (shuttle.data) {
      await shuttle.searcher.indexShwvData(shuttle.data, (msg) => {
        progressText.value = msg
      })
    } else if (shuttle.units.length > 0) {
      await shuttle.searcher.indexUnits(shuttle.units, (msg) => {
        progressText.value = msg
      })
    }
  }

  /**
   * コンコーダンス検索の実行
   */
  function searchConcordance(query: string, limit: number = 100) {
    return shuttle.searcher.search(query, limit)
  }

  /**
   * 検索状態（インデックスとエントリ）をエクスポート
   */
  async function exportSearchData() {
    return await shuttle.searcher.exportFullData()
  }

  /**
   * 検索状態をインポート
   */
  async function importSearchData(data: any) {
    await shuttle.searcher.importFullData(data)
    syncState()
  }

  /**
   * チャンクの作成
   */
  function createChunks(type: 'units' | 'data', maxChars?: number, targetOnly: boolean = false) {
    shuttle.createChunks(type, maxChars, targetOnly)
    syncState()
  }

  /**
   * API呼び出し
   */
  async function processRequests(chunkIndex: number = -1, target: 'CHECK' | 'TRANSLATE' | 'PROOF' = 'CHECK', prompt?: string) {
    syncProviderOptions()
    if (!isConnected.value && !isDevOverride.value) return
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
    isProgressing.value = false
    progressText.value = ''
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

  let isStorageErrorActive = false
  if (typeof window !== 'undefined') {
    window.addEventListener('shuttle-storage-error', () => {
      if (isStorageErrorActive) return
      isStorageErrorActive = true

      setStatus('データサイズが大きいため、ブラウザ保存（永続化）はスキップされます', 'error')

      // 一定時間後にフラグをリセット
      setTimeout(() => {
        isStorageErrorActive = false
      }, 5000)
    })
  }

  return {
    // State
    units,
    files,
    data,
    tms,
    tbs,
    chunks,
    isApiAvailable,
    isDevOverride,
    currentFileName,
    isLoading,
    isProgressing,
    progressText,
    statusMsg,
    provider,
    providerUrl,
    models,
    selectedModel,
    isConnected,
    ollamaUrl,
    lmStudioUrl,
    honoxUrl,
    honoxCloudUrl,
    ollamaModel,
    lmStudioModel,
    honoxApiKey,
    honoxCloudApiKey,
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
    fetchModels,
    parseFiles,
    loadShwvData,
    addTms,
    addTbs,
    process,
    sampling,
    convert,
    analyze,
    createChunks,
    processRequests,
    clearChunks,
    getManagedData,
    clear,
    setStatus,
    rehydrate,
    buildSearchIndex,
    searchConcordance,
    exportSearchData,
    importSearchData,
    // インスタンスへの直接アクセスが必要な場合用
    shuttle
  }
}, {
  persist: {
    storage: typeof window !== 'undefined' ? {
      getItem(key: string) {
        return window.localStorage.getItem(key)
      },
      setItem(key: string, value: string) {
        try {
          window.localStorage.setItem(key, value)
        } catch (e: any) {
          if (e.name === 'QuotaExceededError' || e.message.includes('quota') || e.message.includes('size')) {
            // 非同期でイベントを飛ばして無限ループを防ぐ
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('shuttle-storage-error'))
            }, 0)
          }
        }
      }
    } : undefined,
    // 保存対象を指定 (shuttle インスタンス自体は除外)
    // TMs / TBs は数MB〜数百MBになる可能性があり、localStorage (5MB制限) を超えてしまうため永続化から除外
    pick: [
      'units',
      'files',
      'data',
      'chunks',
      'currentFileName',
      'isDevOverride',
      'provider',
      'ollamaUrl',
      'lmStudioUrl',
      'honoxUrl',
      'honoxCloudUrl',
      'ollamaModel',
      'lmStudioModel',
      'honoxApiKey',
      'honoxCloudApiKey'
    ]
  }
})
