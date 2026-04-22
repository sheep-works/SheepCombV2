import type { 
  ShWvData, 
  ShWvUnit, 
  ShWvRefTm, 
  TranslationPair, 
  ShWvFileInfo 
} from '../types/shwv.js'

import { xlf2Pairs } from './converter/xliffConverter.js'
import { tmx2Pairs } from './converter/tmxConverter.js'
import { tbx2Pairs } from './converter/tbxConverter.js'
import { xlsx2Pairs, csv2Pairs } from './converter/xlsxConverter.js'
import { json2Pairs, jsonl2Pairs } from './converter/jsonConverter.js'
import { SheepShuttleDiffer, type WasmAnalyzeResult } from './sheepShuttleDiffer.js'

export interface ExportPair {
  src: string
  tgt: string
}

export interface ChunkedJsonlItem {
  index: number
  src: string
  tgt: string
  history: ExportPair[]
}

/**
 * Pure logic for SheepShuttle data transformations and conversions.
 */
export class SheepShuttle {
  
  /**
   * Orchestrates TM and TB analysis for a data object.
   */
  static async analyze(
    data: ShWvData,
    memories: any[],
    termbase: any[],
    wasmAnalyzeAll: (tmList: string[], textList: string[], tbList: string[], minRatio: number, counts: number) => WasmAnalyzeResult[],
    legacy: boolean = false
  ): Promise<void> {
    const combinedTerms = [...termbase]
    if (data.body.terms && data.body.terms.length > 0) {
      combinedTerms.push(...data.body.terms.map(t => ({ ...t, file: 'Internal' })))
    }

    await SheepShuttleDiffer.analyze(
      data.body.units,
      memories,
      combinedTerms,
      wasmAnalyzeAll,
      legacy
    )
  }

  /**
   * Unified entry point to create ShWvData from a list of files.
   */
  static async fromFiles(files: { name: string, content: string | ArrayBuffer | Buffer }[]): Promise<ShWvData> {
    const fileinfo: ShWvFileInfo[] = []
    const allUnits: ShWvUnit[] = []
    let globalIdx = 0

    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      const start = globalIdx
      let pairs: TranslationPair[] = []

      // 1. Tag protection (Sheep Placeholder) logic (XLIFF only)
      let processedContent = file.content
      const globalPlaceholders: Record<string, Record<number, string>> = {}
      let sheepIdCounter = 0

      if (['xlf', 'xliff', 'mxliff', 'sdlxliff', 'mqxliff'].includes(ext) && typeof file.content === 'string') {
        processedContent = file.content.replace(/(<(source|target)[^>]*>)([\s\S]*?)(<\/\2>)/g, (match, open, tagname, inner, close) => {
          let placeholders: Record<number, string> = {}
          let counter = 0
          // Match raw <tag> or escaped &lt;tag&gt;
          const newInner = inner.replace(/(<[^>]+>|&lt;[\s\S]*?&gt;)/g, (tagMatch: string) => {
            placeholders[counter] = tagMatch
            const replaceString = `{@${counter}}`
            counter++
            return replaceString
          })
          
          const id = `__SHEEP_${sheepIdCounter++}__`
          globalPlaceholders[id] = placeholders
          return `${open}${id}${newInner}${close}`
        })
      }

      // 2. Specialized Parsing
      try {
        if (['xlf', 'xliff', 'mxliff', 'sdlxliff', 'mqxliff'].includes(ext) && typeof processedContent === 'string') {
          pairs = await xlf2Pairs(processedContent, globalIdx)
        } else if (ext === 'tmx' && typeof processedContent === 'string') {
          pairs = await tmx2Pairs(processedContent, globalIdx)
        } else if (ext === 'tbx' && typeof processedContent === 'string') {
          pairs = await tbx2Pairs(processedContent, globalIdx)
        } else if ((ext === 'xlsx' || ext === 'csv') && (processedContent instanceof ArrayBuffer || Buffer.isBuffer(processedContent))) {
          pairs = ext === 'csv' ? await csv2Pairs(processedContent, globalIdx) : await xlsx2Pairs(processedContent, globalIdx)
        } else if (ext === 'jsonl' && typeof processedContent === 'string') {
          pairs = await jsonl2Pairs(processedContent, globalIdx)
        } else if (ext === 'json' && typeof processedContent === 'string') {
          pairs = await json2Pairs(processedContent, globalIdx)
        }
      } catch (e) {
        console.error(`Failed to parse ${file.name}:`, e)
      }

      // 3. Finalize Units (Restore tags from placeholders)
      for (let p of pairs) {
        const unit: ShWvUnit = {
          idx: p.idx,
          src: p.src,
          pre: '',
          tgt: p.tgt || '',
          note: p.note,
          isSub: p.isSub,
          ref: { tms: [], tb: [], quoted: [], quoted100: [] },
          placeholders: {}
        }

        if (unit.src) {
          const match = unit.src.match(/^__SHEEP_(\d+)__/)
          if (match) {
            unit.src = unit.src.substring(match[0].length)
            unit.placeholders = globalPlaceholders[match[0]] || {}
          }
        }
        if (unit.tgt) {
          const match = unit.tgt.match(/^__SHEEP_(\d+)__/)
          if (match) {
            unit.tgt = unit.tgt.substring(match[0].length)
            const pts = globalPlaceholders[match[0]] || {}
            unit.placeholders = { ...unit.placeholders, ...pts }
          }
        }

        allUnits.push(unit)
      }

      globalIdx += pairs.length
      fileinfo.push({
        name: file.name,
        start: start,
        end: globalIdx - 1
      })
    }

    return {
      meta: {
        bilingualPath: '',
        files: fileinfo,
        sourceLang: 'ja',
        targetLang: 'en'
      },
      body: {
        units: allUnits,
        terms: []
      }
    }
  }

  /**
   * Convert units to simple src/tgt pairs.
   */
  static getPairs(units: ShWvUnit[]): ExportPair[] {
    return units.map(unit => ({
      src: unit.src,
      tgt: unit.tgt || unit.pre || '',
    }))
  }

  /**
   * Format pairs as CSV string.
   */
  static formatCsv(pairs: ExportPair[]): string {
    const header = 'src,tgt'
    const rows = pairs.map(pair => {
      const src = `"${pair.src.replace(/"/g, '""')}"`
      const tgt = `"${pair.tgt.replace(/"/g, '""')}"`
      return `${src},${tgt}`
    })
    return [header, ...rows].join('\n')
  }

  /**
   * Split data by file boundaries.
   */
  static splitByFile(data: ShWvData): Map<string, ExportPair[]> {
    const result = new Map<string, ExportPair[]>()
    for (const file of data.meta.files) {
      const fileUnits = data.body.units.slice(file.start, file.end + 1)
      const pairs = this.getPairs(fileUnits)
      const name = file.name.replace(/\.[^.]+$/, '') + '.json'
      result.set(name, pairs)
    }
    return result
  }

  /**
   * Internal: Split units by character length.
   */
  private static splitByUnitsLength(units: ShWvUnit[], maxLength: number): ExportPair[][] {
    const chunks: ExportPair[][] = []
    let currentChunk: ExportPair[] = []
    let currentLen = 0

    for (const unit of units) {
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
   * Generate JSONL content.
   */
  static getJsonlContent(units: ShWvUnit[]): string {
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

  /**
   * Generate chunked JSONL content.
   */
  static getChunkedJsonlContent(units: ShWvUnit[], maxCharsPerLine: number): string {
    const lines: string[] = []
    let currentChunk: ChunkedJsonlItem[] = []
    let currentLen = 0

    for (const unit of units) {
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
   * Update units from JSONL content.
   */
  static getUpdatedUnits(units: ShWvUnit[], jsonlContent: string): ShWvUnit[] {
    const updatedUnits = structuredClone(units)
    const lines = jsonlContent.split('\n')

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

  // --- Public Wrap Methods for UI Integration ---

  /**
   * Export all units to simple src/tgt pairs.
   */
  static exportToJson(data: ShWvData): ExportPair[] {
    return this.getPairs(data.body.units)
  }

  /**
   * Export all units as CSV string.
   */
  static exportToCsv(data: ShWvData): string {
    return this.formatCsv(this.getPairs(data.body.units))
  }

  /**
   * Export all units as TM pairs.
   */
  static exportAsTm(data: ShWvData): ExportPair[] {
    return this.getPairs(data.body.units)
  }

  /**
   * Export the internal termbase entries.
   */
  static exportAsTb(data: ShWvData): any[] {
    return data.body.terms || []
  }

  /**
   * Export all units as JSONL string.
   */
  static exportToJsonl(data: ShWvData): string {
    return this.getJsonlContent(data.body.units)
  }

  /**
   * Chunk the data into JSONL strings based on length.
   */
  static chunkJsonl(data: ShWvData, maxLength: number): string {
    return this.getChunkedJsonlContent(data.body.units, maxLength)
  }

  /**
   * Update internal units from a JSONL content string.
   */
  static updateFromJsonl(data: ShWvData, content: string): ShWvUnit[] {
    return this.getUpdatedUnits(data.body.units, content)
  }

  /**
   * Split the entire data object into length-based chunks.
   */
  static splitByLength(data: ShWvData, maxLength: number): ExportPair[][] {
    return this.splitByUnitsLength(data.body.units, maxLength)
  }
}
