/**
 * SheepShuttle - Web-compatible version
 *
 * A browser-friendly version of the SheepShuttle class that removes
 * all Node.js (node:fs, node:path) dependencies. Instead of writing
 * files directly, all methods return data (strings/objects) that can
 * then be downloaded via FileIO.download().
 */
import type { ShWvData, ShWvUnit, ShWvRefTm } from '@/types/shwv'

export interface ExportPair {
  src: string
  tgt: string
}

export interface ChunkedJsonlItem {
  index: number
  src: string
  tgt: string
  history: { src: string; tgt: string }[]
}

export class SheepShuttle {
  /**
   * Generate JSON content containing only src and tgt from ShWvData.
   */
  static exportToJson(data: ShWvData): ExportPair[] {
    return data.body.units.map(unit => ({
      src: unit.src,
      tgt: unit.tgt || unit.pre || '',
    }))
  }

  /**
   * Generate CSV content containing src and tgt from ShWvData.
   */
  static exportToCsv(data: ShWvData): string {
    const header = 'src,tgt'
    const rows = data.body.units.map(unit => {
      const src = `"${unit.src.replace(/"/g, '""')}"`
      const tgtText = unit.tgt || unit.pre || ''
      const tgt = `"${tgtText.replace(/"/g, '""')}"`
      return `${src},${tgt}`
    })
    return [header, ...rows].join('\n')
  }

  /**
   * Export units as TM (src/tgt pairs).
   */
  static exportAsTm(data: ShWvData): ExportPair[] {
    return data.body.units.map(unit => ({
      src: unit.src,
      tgt: unit.tgt || unit.pre || '',
    }))
  }

  /**
   * Export terms as TB.
   */
  static exportAsTb(data: ShWvData): { src: string; tgt: string }[] {
    return data.body.terms || []
  }

  /**
   * Split ShWvData by file boundaries, returning a map of filename → pairs.
   */
  static splitByFile(data: ShWvData): Map<string, ExportPair[]> {
    const result = new Map<string, ExportPair[]>()

    for (const file of data.meta.files) {
      const fileUnits = data.body.units.slice(file.start, file.end + 1)
      const pairs = fileUnits.map(unit => ({
        src: unit.src,
        tgt: unit.tgt || unit.pre || '',
      }))
      const name = file.name.replace(/\.[^.]+$/, '') + '.json'
      result.set(name, pairs)
    }

    return result
  }

  /**
   * Split ShWvData by character length, returning chunks.
   */
  static splitByLength(data: ShWvData, maxLength: number): ExportPair[][] {
    const chunks: ExportPair[][] = []
    let currentChunk: ExportPair[] = []
    let currentLen = 0

    for (const unit of data.body.units) {
      const tgtText = unit.tgt || unit.pre || ''
      const pair: ExportPair = { src: unit.src, tgt: tgtText }
      const pairStr = JSON.stringify(pair)
      const len = pairStr.length

      if (currentLen + len > maxLength && currentChunk.length > 0) {
        chunks.push(currentChunk)
        currentChunk = []
        currentLen = 0
      }

      currentChunk.push(pair)
      currentLen += len
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk)
    }

    return chunks
  }

  /**
   * Generate JSONL content from ShWvData.
   * Each line: {src, tgt, history: [{src, tgt}, ...]}
   */
  static exportToJsonl(data: ShWvData): string {
    const lines: string[] = []

    for (const unit of data.body.units) {
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

  /**
   * Generate chunked JSONL (arrays of items per line).
   */
  static chunkJsonl(data: ShWvData, maxCharsPerLine: number): string {
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

  /**
   * Update ShWvData from chunked JSONL content.
   * Returns a new copy of units with updates applied.
   */
  static updateFromJsonl(data: ShWvData, jsonlContent: string): ShWvUnit[] {
    const updatedUnits = structuredClone(data.body.units)
    const lines = jsonlContent.split('\n')

    for (const line of lines) {
      if (line.trim().length === 0) continue

      try {
        const chunk = JSON.parse(line)
        if (Array.isArray(chunk)) {
          for (const item of chunk) {
            const unit = updatedUnits.find((u: ShWvUnit) => u.idx === item.index)
            if (unit) {
              if (item.tgt && item.tgt.trim() !== '') {
                unit.tgt = item.tgt
              } else {
                unit.pre = item.src
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse JSONL line', e)
      }
    }

    return updatedUnits
  }
}
