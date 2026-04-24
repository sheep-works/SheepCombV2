import type { TranslationPair, ProcessorOptions, DntFilterType } from '../../types/shwv.js'
import type { SheepShuttle } from '../sheepShuttle.js'

export class ShuttleProcessor {
  private parent: SheepShuttle

  constructor(parent: SheepShuttle) {
    this.parent = parent
  }

  /**
   * Filter and cleanse translation pairs.
   */
  filter(units: TranslationPair[], options: ProcessorOptions = {}): TranslationPair[] {
    let filtered = [...units]

    if (options.toFilterDuplicate) {
      filtered = this.filterDuplicates(filtered)
    }

    if (options.toFilterDnt) {
      filtered = this.filterDnt(filtered, options.toFilterDnt)
    }

    if (options.toFilterLock) {
      filtered = this.filterLocked(filtered)
    }

    return filtered
  }

  /**
   * 原文、訳文、備考の組み合わせが完全に同一である行を削除します。
   */
  private filterDuplicates(units: TranslationPair[]): TranslationPair[] {
    const seen = new Set<string>()
    return units.filter(unit => {
      const key = `${unit.src}|||${unit.tgt}|||${unit.note || ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  /**
   * DNT (Do Not Translate) フィルタ
   * 原文が数字のみ、英字のみ、あるいは記号のみの場合に除外します。
   */
  private filterDnt(units: TranslationPair[], type: DntFilterType): TranslationPair[] {
    if (!type) return units
    const pattern = this.makeDntPattern(type)
    if (!pattern) return units

    return units.filter(unit => !pattern.test(unit.src))
  }

  /**
   * 備考欄に [[LOCKED]] が含まれるセグメントを除外します。
   */
  private filterLocked(units: TranslationPair[]): TranslationPair[] {
    return units.filter(unit => !(unit.note && unit.note.includes('[[LOCKED]]')))
  }

  /**
   * DNT判定用の正規表現を作成します。
   */
  private makeDntPattern(type: DntFilterType): RegExp | null {
    const regstrDigit = "0123456789０１２３４５６７８９"
    const regstrEng = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ"
    const regstrPunct = "()（）【】\\[\\]%％.,:;/+± 　\"'’!?“”‘’—–‑_\\\\&@#*=~、。・：「」『』ー―…‥；$€£¥￥\\-"

    if (type === 'digit') {
      return new RegExp(`^[${regstrDigit}${regstrPunct}]+$`)
    } else if (type === 'eng') {
      return new RegExp(`^[${regstrEng}${regstrPunct}]+$`)
    } else if (type === 'digit eng') {
      return new RegExp(`^[${regstrDigit}${regstrEng}${regstrPunct}]+$`)
    }
    return null
  }

  /**
   * Split translation pairs into JSONL chunks.
   */
  public chunkUnits(units: TranslationPair[], maxChars: number): string[] {
    const chunks: string[] = []
    let currentChunk: string[] = []
    let currentLen = 0

    for (const unit of units) {
      const obj = {
        idx: unit.idx,
        src: unit.src,
        tgt: unit.tgt,
        notes: unit.note || ''
      }
      const str = JSON.stringify(obj)
      const len = str.length + 1 // +1 for newline

      if (currentLen + len > maxChars && currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n'))
        currentChunk = []
        currentLen = 0
      }

      currentChunk.push(str)
      currentLen += len
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'))
    }

    return chunks
  }
}
