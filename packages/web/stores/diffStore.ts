import { defineStore } from 'pinia'
import { ref } from 'vue'
import { DiffUtils } from '../utils/diffUtils'
import { useShuttleStore } from './shuttleStore'

export interface DiffResult {
  lineNo: number
  s: string
  t: string
  d: string
  hasDiff: boolean
  note?: string
}

export const useDiffStore = defineStore('diff', () => {
  const srcText = ref('')
  const tgtText = ref('')
  const batchDiff = ref<DiffResult[]>([])
  const isUsedExtracted = ref(false)

  /**
   * 一括差分チェックを実行
   */
  function batchCheck() {
    batchDiff.value = []
    const srcs = srcText.value.split('\n')
    const tgts = tgtText.value.split('\n')

    // 行数が多い方に合わせる（欠落チェックのため）
    const maxLines = Math.max(srcs.length, tgts.length)
    const shuttle = useShuttleStore()
    const units = shuttle.units

    for (let i = 0; i < maxLines; i++) {
      const s = srcs[i] || ''
      const t = tgts[i] || ''
      const note = (isUsedExtracted.value && units[i]) ? units[i].note : undefined

      const hasDiff = s !== t
      const d = DiffUtils.getDiffHtml(s, t)
      batchDiff.value.push({
        lineNo: i + 1,
        s,
        t,
        d,
        hasDiff,
        note
      })
    }
  }

  /**
   * ブロック単位（全体を1つとして）差分チェックを実行
   */
  function batchCheckBlock() {
    batchDiff.value = []
    const s = srcText.value
    const t = tgtText.value

    const hasDiff = s !== t
    const d = DiffUtils.getDiffHtml(s, t)
    batchDiff.value.push({
      lineNo: 1,
      s,
      t,
      d,
      hasDiff
    })
  }

  /**
   * shuttleStore（パーサー）からデータを読み込む
   */
  function importFromShuttle() {
    const shuttle = useShuttleStore()
    if (!shuttle.hasUnits) return false

    srcText.value = shuttle.units.map(u => u.src).join('\n')
    tgtText.value = shuttle.units.map(u => u.tgt || '').join('\n')
    isUsedExtracted.value = true
    batchCheck()
    return true
  }

  /**
   * 差分データからJSONL形式のテキスト文字列を生成する
   */
  function buildJsonlString(items?: DiffResult[]): string {
    const targetItems = items || batchDiff.value
    return targetItems.map(item => {
      const record: Record<string, any> = {
        idx: item.lineNo,
        src: item.s,
        tgt: item.d
      }
      if (isUsedExtracted.value) {
        record.notes = item.note || ''
      }
      return JSON.stringify(record)
    }).join('\n')
  }

  function clear() {
    srcText.value = ''
    tgtText.value = ''
    batchDiff.value = []
    isUsedExtracted.value = false
  }

  return {
    srcText,
    tgtText,
    batchDiff,
    isUsedExtracted,
    batchCheck,
    batchCheckBlock,
    importFromShuttle,
    buildJsonlString,
    clear
  }
})

