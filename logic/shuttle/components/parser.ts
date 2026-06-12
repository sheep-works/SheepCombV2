import type { TranslationPair, ShWvFileInfo } from '../../types/shwv.js'
import { parseXliff } from './subparser/xliffParser.js'
import { parseTmx } from './subparser/tmxParser.js'
import { parseTbx } from './subparser/tbxParser.js'
import { parseXlsx, parseCsv } from './subparser/xlsxParser.js'
import { parseJson, parseJsonl } from './subparser/jsonParser.js'
import { parseDocx } from './subparser/docxParser.js'
import type { SheepShuttle } from '../sheepShuttle.js'

export interface ParsedResult {
  units: TranslationPair[]
  files: ShWvFileInfo[]
}

export class ShuttleParser {
  private parent: SheepShuttle

  constructor(parent: SheepShuttle) {
    this.parent = parent
  }

  /**
   * Parse multiple files and extract TranslationPairs.
   * Also generates ShWvFileInfo for each file.
   * isSub splitting is performed here for XLF-like files.
   */
  public async parse(files: { name: string, content: string | ArrayBuffer | Uint8Array }[], onProgress?: (msg: string) => void, splitByNewline: boolean = true): Promise<ParsedResult> {
    const fileinfo: ShWvFileInfo[] = []
    const allUnits: TranslationPair[] = []
    let globalIdx = 0

    for (const file of files) {
      if (onProgress) onProgress(`Reading file: ${file.name}...`)
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      const start = globalIdx
      let pairs: TranslationPair[] = []
      let content = file.content

      if (typeof content === 'string' && content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1)
      }

      try {
        if (['xlf', 'xliff', 'mxliff', 'sdlxliff', 'mqxliff'].includes(ext) && typeof content === 'string') {
          // XLF-like files handle isSub natively in parseXliff
          pairs = await parseXliff(content, globalIdx, splitByNewline)
        } else if (ext === 'tmx' && typeof content === 'string') {
          pairs = await parseTmx(content, globalIdx)
        } else if (ext === 'tbx' && typeof content === 'string') {
          pairs = await parseTbx(content, globalIdx)
        } else if (['xlsx', 'csv', 'tsv'].includes(ext)) {
          pairs = (ext === 'csv' || ext === 'tsv') ? await parseCsv(content, globalIdx, onProgress) : await parseXlsx(content as any, globalIdx, onProgress)
        } else if (ext === 'jsonl' && typeof content === 'string') {
          pairs = await parseJsonl(content, globalIdx)
        } else if (ext === 'json' && typeof content === 'string') {
          pairs = await parseJson(content, globalIdx)
        } else if (ext === 'docx' && (file.content instanceof ArrayBuffer || file.content instanceof Uint8Array)) {
          pairs = await parseDocx(file.content as ArrayBuffer, globalIdx)
        }
      } catch (e) {
        console.error(`Failed to parse ${file.name}:`, e)
        throw e
      }

      for (const p of pairs) {
        allUnits.push(p)
      }

      globalIdx += pairs.length
      fileinfo.push({
        name: file.name,
        start: start,
        end: globalIdx - 1
      })
    }

    return {
      units: allUnits,
      files: fileinfo
    }
  }
}
