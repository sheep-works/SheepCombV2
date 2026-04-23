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
  async parse(files: { name: string, content: string | ArrayBuffer | Buffer }[]): Promise<ParsedResult> {
    const fileinfo: ShWvFileInfo[] = []
    const allUnits: TranslationPair[] = []
    let globalIdx = 0

    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      const start = globalIdx
      let pairs: TranslationPair[] = []

      try {
        if (['xlf', 'xliff', 'mxliff', 'sdlxliff', 'mqxliff'].includes(ext) && typeof file.content === 'string') {
          // XLF-like files handle isSub natively in parseXliff
          pairs = await parseXliff(file.content, globalIdx)
        } else if (ext === 'tmx' && typeof file.content === 'string') {
          pairs = await parseTmx(file.content, globalIdx)
        } else if (ext === 'tbx' && typeof file.content === 'string') {
          pairs = await parseTbx(file.content, globalIdx)
        } else if (['xlsx', 'csv', 'tsv'].includes(ext)) {
          pairs = (ext === 'csv' || ext === 'tsv') ? await parseCsv(file.content, globalIdx) : await parseXlsx(file.content as any, globalIdx)
        } else if (ext === 'jsonl' && typeof file.content === 'string') {
          pairs = await parseJsonl(file.content, globalIdx)
        } else if (ext === 'json' && typeof file.content === 'string') {
          pairs = await parseJson(file.content, globalIdx)
        } else if (ext === 'docx' && (file.content instanceof ArrayBuffer || Buffer.isBuffer(file.content))) {
          pairs = await parseDocx(file.content, globalIdx)
        }
      } catch (e) {
        console.error(`Failed to parse ${file.name}:`, e)
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
