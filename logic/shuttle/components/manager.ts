import type { ShWvData, ShWvUnit, ShWvRefTm, ExportPair, ChunkedJsonlItem, ManagedDataType } from '../../types/shwv.js'
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

  chunkJsonl(data: ShWvData, maxCharsPerLine: number): string {
    const lines: string[] = []
    let currentChunk: ChunkedJsonlItem[] = []
    let currentLen = 0

    for (const unit of data.body.units) {
      const tgtText = unit.tgt || unit.pre || ''
      const historyObj = unit.ref?.tms
        ? unit.ref.tms.map((tm: ShWvRefTm) => ({ src: tm.src, tgt: tm.tgt }))
        : []

      const obj: ChunkedJsonlItem = {
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
  public getManagedData(type: ManagedDataType, data: ShWvData, maxCharsPerChunk: number = 4000): string {
    switch (type) {
      case 'UNITS':
      case 'TMS':
        return JSON.stringify(this.getPairs(data.body.units))
      case 'TBS':
        return JSON.stringify(data.body.terms || [])
      case 'JSONL':
        return this.getJsonlContent(data.body.units)
      case 'JSONL_CHUNKED':
        return this.chunkJsonl(data, maxCharsPerChunk)
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
