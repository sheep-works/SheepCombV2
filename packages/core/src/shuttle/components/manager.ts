import type { ShWvData, ShWvUnit, ShWvRefTm, ExportPair, ChunkedJsonlItem, ManagedDataType } from '@sheep-family/types'
import type { SheepShuttle } from '../sheepShuttle.js'

export class ShuttleManager {
  private parent: SheepShuttle

  constructor(parent: SheepShuttle) {
    this.parent = parent
  }

  getPairs(units: ShWvUnit[]): ExportPair[] {
    return units.map(unit => ({
      src: unit.src,
      tgt: unit.tgt || unit.pre || '',
    }))
  }

  /**
   * カウント処理
   * @param units TranslationPair または ShWvUnit の配列
   * @param countUnit "CHARA" 単位（単純な文字数）または "WORD" 単位（単語数ベースの概算）
   * @returns srcとtgtのそれぞれのカウント数
   */
  countUnits(units: Array<{ src: string, tgt?: string, pre?: string }>, countUnit: "CHARA" | "WORD"): { src: number, tgt: number } {
    let srcCount = 0;
    let tgtCount = 0;

    for (const u of units) {
      const srcText = u.src || '';
      const tgtText = u.tgt || u.pre || '';

      if (countUnit === 'CHARA') {
        srcCount += srcText.length;
        tgtCount += tgtText.length;
      } else {
        // WORD count (英数字以外の前後にスペースを入れて分割することでCJKも1文字1単語として概算カウントするハック)
        const tokenize = (text: string) => {
          const spaced = text.replace(/([^\w\s])/g, ' $1 ');
          const tokens = spaced.split(/\s+/).filter(t => t.trim().length > 0);
          return tokens.length;
        };
        srcCount += tokenize(srcText);
        tgtCount += tokenize(tgtText);
      }
    }

    return { src: srcCount, tgt: tgtCount };
  }

  /**
   * ウェイト計算のための、TM一致率ごとのカウント集計（srcのみ）
   * @param data ShWvData
   * @param countUnit "CHARA" または "WORD"
   * @returns 5つのセクション（100%, 95-99%, 85-94%, 75-84%, 0-74%）ごとのカウント数の配列
   */
  calculateTieredCounts(data: ShWvData, countUnit: "CHARA" | "WORD"): number[] {
    const counts = [0, 0, 0, 0, 0]; // 100%, 95-99%, 85-94%, 75-84%, 0-74%

    const tokenize = (text: string) => {
      const spaced = text.replace(/([^\w\s])/g, ' $1 ');
      const tokens = spaced.split(/\s+/).filter(t => t.trim().length > 0);
      return tokens.length;
    };

    for (const unit of data.body.units) {
      let maxRatio = 0;
      if (unit.ref && unit.ref.tms && unit.ref.tms.length > 0) {
        maxRatio = Math.max(...unit.ref.tms.map(tm => tm.ratio));
      }

      let count = 0;
      if (countUnit === 'CHARA') {
        count = unit.src.length;
      } else {
        count = tokenize(unit.src);
      }

      if (maxRatio === 100) {
        counts[0] += count;
      } else if (maxRatio >= 95) {
        counts[1] += count;
      } else if (maxRatio >= 85) {
        counts[2] += count;
      } else if (maxRatio >= 75) {
        counts[3] += count;
      } else {
        counts[4] += count;
      }
    }

    return counts;
  }

  formatCsv(pairs: ExportPair[]): string {
    const header = 'src,tgt'
    const rows = pairs.map(pair => {
      const src = `"${pair.src.replace(/"/g, '""')}"`
      const tgt = `"${pair.tgt.replace(/"/g, '""')}"`
      return `${src},${tgt}`
    })
    return [header, ...rows].join('\n')
  }

  splitByFile(data: ShWvData): Map<string, ExportPair[]> {
    const result = new Map<string, ExportPair[]>()
    for (const file of data.meta.files) {
      const fileUnits = data.body.units.slice(file.start, file.end + 1)
      const pairs = this.getPairs(fileUnits)
      const name = file.name.replace(/\.[^.]+$/, '') + '.json'
      result.set(name, pairs)
    }
    return result
  }

  splitByLength(data: ShWvData, maxLength: number): Map<number, ExportPair[]> {
    const result = new Map<number, ExportPair[]>()
    let currentChunk: ExportPair[] = []
    let currentLen = 0
    let chunkIdx = 0

    for (const unit of data.body.units) {
      const tgtText = unit.tgt || unit.pre || ''
      const pair: ExportPair = { src: unit.src, tgt: tgtText }
      const pairStr = JSON.stringify(pair)
      const len = pairStr.length

      if (currentLen + len > maxLength && currentChunk.length > 0) {
        result.set(chunkIdx, currentChunk)
        currentChunk = []
        currentLen = 0
      }

      currentChunk.push(pair)
      currentLen += len
    }

    if (currentChunk.length > 0) {
      result.set(chunkIdx, currentChunk)
    }

    return result
  }

  getJsonlContent(units: ShWvUnit[]): string {
    const lines: string[] = []
    for (const unit of units) {
      const tgtText = unit.tgt || unit.pre || ''
      const historyObj = unit.ref?.tms
        ? unit.ref.tms.map((tm: ShWvRefTm) => ({ src: tm.src, tgt: tm.tgt }))
        : []

      const obj = {
        src: unit.src,
        tgt: tgtText,
        history: historyObj,
      }
      lines.push(JSON.stringify(obj))
    }
    return lines.join('\n')
  }

  chunkJsonl(data: ShWvData, maxCharsPerLine: number, targetOnly: boolean = false): string {
    const lines: string[] = []
    let currentChunk: any[] = []
    let currentLen = 0

    for (const unit of data.body.units) {
      const tgtText = unit.tgt || unit.pre || ''
      const historyObj = unit.ref?.tms
        ? unit.ref.tms.map((tm: ShWvRefTm) => ({ src: tm.src, tgt: tm.tgt }))
        : []

      const obj: any = targetOnly ? {
        index: unit.idx,
        tgt: tgtText,
      } : {
        index: unit.idx,
        src: unit.src,
        tgt: tgtText,
        history: historyObj,
      }
      const strObj = JSON.stringify(obj)
      const len = strObj.length

      if (currentLen + len > maxCharsPerLine && currentChunk.length > 0) {
        lines.push(JSON.stringify(currentChunk))
        currentChunk = []
        currentLen = 0
      }

      currentChunk.push(obj)
      currentLen += len
    }

    if (currentChunk.length > 0) {
      lines.push(JSON.stringify(currentChunk))
    }

    return lines.join('\n')
  }

  updateFromJsonl(data: ShWvData, content: string): ShWvUnit[] {
    const updatedUnits = structuredClone(data.body.units)
    const lines = content.split('\n')

    for (const line of lines) {
      if (line.trim().length === 0) continue
      try {
        const chunk = JSON.parse(line)
        const items = Array.isArray(chunk) ? chunk : [chunk]
        for (const item of items) {
          const unit = updatedUnits.find((u: ShWvUnit) => u.idx === item.index || u.idx === item.idx)
          if (unit) {
            if (item.tgt && item.tgt.trim() !== '') {
              unit.tgt = item.tgt
            } else if (item.src) {
              unit.pre = item.src
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse JSONL line', e)
      }
    }
    return updatedUnits
  }

  // Wrappers
  public getManagedData(type: ManagedDataType, data: ShWvData, maxCharsPerChunk: number = 4000, targetOnly: boolean = false): string {
    switch (type) {
      case 'UNITS':
      case 'TMS':
        return JSON.stringify(this.getPairs(data.body.units))
      case 'TBS':
        return JSON.stringify(data.body.terms || [])
      case 'JSONL':
        return this.getJsonlContent(data.body.units)
      case 'JSONL_CHUNKED':
        return this.chunkJsonl(data, maxCharsPerChunk, targetOnly)
      case 'CSV':
        return this.formatCsv(this.getPairs(data.body.units))
      case 'SPLIT_BY_FILE':
        return JSON.stringify(this.splitByFile(data))
      case 'SPLIT_BY_LENGTH':
        return JSON.stringify(this.splitByLength(data, maxCharsPerChunk))
      default:
        return ''
    }
  }
}
