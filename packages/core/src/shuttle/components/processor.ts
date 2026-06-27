import type { TranslationPair, TranslationPairWithFile, ProcessorOptions, DntFilterType, ChunkOptions } from '@sheep-family/types'
import { createChunkOptions } from '@sheep-family/types'
import type { SheepShuttle } from '../sheepShuttle.js'

export interface SamplingTranslationPair extends TranslationPairWithFile {
  striped: string
  lenWoTags: number
}

export class ShuttleProcessor {
  private parent: SheepShuttle<any>

  constructor(parent: SheepShuttle<any>) {
    this.parent = parent
  }

  /**
   * Filter and cleanse translation pairs.
   */
  filter(units: TranslationPair[], options: ProcessorOptions = {}): TranslationPair[] {
    let filtered = [...units]

    if (options.toFilterDuplicate) {
      filtered = this.filterDuplicates(filtered, options.filterLevel)
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
   * 重複行を削除します。
   * filterLevelによって重複判定の基準が変わります（デフォルトは SRC_TGT_NOTE）。
   */
  private filterDuplicates(units: TranslationPair[], filterLevel: "SRC" | "SRC_TGT" | "SRC_TGT_NOTE" = "SRC_TGT_NOTE"): TranslationPair[] {
    const seen = new Set<string>()
    return units.filter(unit => {
      let key = ''
      if (filterLevel === 'SRC') {
        key = `${unit.src}`
      } else if (filterLevel === 'SRC_TGT') {
        key = `${unit.src}|||${unit.tgt}`
      } else {
        key = `${unit.src}|||${unit.tgt}|||${unit.note || ''}`
      }
      
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
  public chunkUnits(units: TranslationPair[], maxChars: number, requestTarget: 'CHECK' | 'TRANSLATE' | 'PROOF' = 'CHECK', options?: ChunkOptions): string[] {
    const chunks: string[] = []
    let currentChunk: string[] = []
    let currentLen = 0

    const opts = options ? createChunkOptions(options) : undefined

    for (const unit of units) {
      const obj: any = {}
      obj.idx = unit.idx
      
      if (opts) {
        if (opts.src) obj.src = unit.src
        if (opts.tgt) obj.tgt = unit.tgt
        if (opts.note && unit.note) obj.note = unit.note
      } else {
        if (requestTarget === 'TRANSLATE') {
          obj.src = unit.src
          if (unit.note) obj.note = unit.note
        } else if (requestTarget === 'PROOF') {
          obj.tgt = unit.tgt
        } else {
          obj.src = unit.src
          obj.tgt = unit.tgt
          obj.notes = unit.note || ''
        }
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

  /**
   * Mulberry32 algorithm for seedable pseudo-random number generation.
   */
  private createRandomWithSeed(seed: number): () => number {
    let h = seed;
    return () => {
      h = Math.imul(h ^ (h >>> 15), h | 1);
      h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
      return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Sample translation pairs for evaluation.
   */
  public sampling(sampledTotal: number, seed?: number): TranslationPair[] {
    const filesInfo = (this.parent.data?.meta?.files && this.parent.data.meta.files.length > 0)
      ? this.parent.data.meta.files
      : (this.parent.files && this.parent.files.length > 0)
        ? this.parent.files
        : [{ name: 'default', start: 0, end: this.parent.units.length - 1 }]

    const unitsByFile: TranslationPair[][] = []
    for (const file of filesInfo) {
      const start = Math.max(0, file.start)
      const end = Math.min(this.parent.units.length - 1, file.end)
      if (start <= end) {
        unitsByFile.push(this.parent.units.slice(start, end + 1))
      } else {
        unitsByFile.push([])
      }
    }

    const fileTotals: number[] = []
    const samplingUnitsByFile: SamplingTranslationPair[][] = []

    for (let i = 0; i < unitsByFile.length; i++) {
      const fileUnits = unitsByFile[i]!
      const fileName = filesInfo[i]?.name || 'default'
      let fileTotalCharCount = 0
      const mapped = fileUnits.map(unit => {
        const striped = (unit.src || '').replace(/<[^>]+>|&lt;[\s\S]*?&gt;/g, '')
        const lenWoTags = striped.length
        fileTotalCharCount += lenWoTags
        return {
          ...unit,
          striped,
          lenWoTags,
          file: fileName
        } as SamplingTranslationPair
      })
      samplingUnitsByFile.push(mapped)
      fileTotals.push(fileTotalCharCount)
    }

    const totalChars = fileTotals.reduce((sum, count) => sum + count, 0)

    const randomFunc = seed !== undefined ? this.createRandomWithSeed(seed) : Math.random

    const shuffleArray = <T>(array: T[]): T[] => {
      const arr = [...array]
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(randomFunc() * (i + 1))
        const temp = arr[i]!
        arr[i] = arr[j]!
        arr[j] = temp
      }
      return arr
    }

    const allSamples: SamplingTranslationPair[] = []

    for (let i = 0; i < samplingUnitsByFile.length; i++) {
      const fileTotal = fileTotals[i]!
      const targetChars = totalChars > 0 ? (fileTotal / totalChars) * sampledTotal : 0
      const shuffled = shuffleArray(samplingUnitsByFile[i]!)

      const selected: SamplingTranslationPair[] = []
      let currentSum = 0

      for (const unit of shuffled) {
        const nextSum = currentSum + unit.lenWoTags
        if (nextSum > targetChars) {
          const diffBefore = Math.abs(currentSum - targetChars)
          const diffAfter = Math.abs(nextSum - targetChars)
          if (diffAfter < diffBefore) {
            selected.push(unit)
          }
          break
        } else {
          selected.push(unit)
          currentSum = nextSum
        }
      }

      allSamples.push(...selected)
    }

    const finalSamples: TranslationPair[] = [...allSamples]
    if (seed !== undefined) {
      finalSamples.unshift({
        idx: -1,
        src: 'SEED_VAL',
        tgt: String(seed),
        note: 'DO NOT EDIT'
      })
    }

    this.parent.units = finalSamples
    return finalSamples
  }
}
