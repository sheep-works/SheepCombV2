import { defineStore } from 'pinia'
import { ref } from 'vue'
import { DiffUtils } from '../utils/diffUtils'
import { useShuttleStore } from './shuttleStore'

export interface DiffResult {
  s: string
  t: string
  d: string
}

export const useDiffStore = defineStore('diff', () => {
  const srcText = ref('')
  const tgtText = ref('')
  const batchDiff = ref<DiffResult[]>([])

  /**
   * 一括差分チェックを実行
   */
  function batchCheck() {
    batchDiff.value = []
    const srcs = srcText.value.split('\n')
    const tgts = tgtText.value.split('\n')

    // 行数が多い方に合わせる（欠落チェックのため）
    const maxLines = Math.max(srcs.length, tgts.length)

    for (let i = 0; i < maxLines; i++) {
      const s = srcs[i] || ''
      const t = tgts[i] || ''

      if (s === t && s !== '') {
        // 同一の場合は表示しないか、フラグ立てるか検討。
        // サンプルのロジックでは差異がある場合のみ push している
        continue
      }

      const d = DiffUtils.getDiffHtml(s, t)
      batchDiff.value.push({ s, t, d })
    }
  }

  /**
   * shuttleStore（パーサー）からデータを読み込む
   */
  function importFromShuttle() {
    const shuttle = useShuttleStore()
    if (!shuttle.hasUnits) return false

    srcText.value = shuttle.units.map(u => u.src).join('\n')
    tgtText.value = shuttle.units.map(u => u.tgt || '').join('\n')
    return true
  }

  function clear() {
    srcText.value = ''
    tgtText.value = ''
    batchDiff.value = []
  }

  return {
    srcText,
    tgtText,
    batchDiff,
    batchCheck,
    importFromShuttle,
    clear
  }
})
