import * as xlsx from 'xlsx'
import type { TranslationPair } from '../../types/shwv.js'

/**
 * XLSX/CSV to TranslationPair converter.
 * Optimized for ShWvData.
 * Uses SheetJS.
 */
export async function xlsx2Pairs(content: ArrayBuffer | Buffer, startIdx: number): Promise<TranslationPair[]> {
  const units: TranslationPair[] = []
  const workbook = xlsx.read(content, { type: (content instanceof Buffer ? 'buffer' : 'array') })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error('No sheets found in the workbook.')
  }
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new Error('Failed to load the first sheet.')
  }

  // Convert to array of arrays
  const rows = xlsx.utils.sheet_to_json<string[]>(sheet, { header: 1 })

  let currentIdx = startIdx
  for (const row of rows) {
    if (!row || row.length === 0) continue
    const src = row[0]?.toString() || ''
    const tgt = row[1]?.toString() || ''
    const note = row.slice(2).join(' | ')

    if (src) {
      units.push({
        idx: currentIdx++,
        src,
        tgt,
        note: note || undefined
      })
    }
  }

  return units
}

export async function csv2Pairs(content: ArrayBuffer | Buffer, startIdx: number): Promise<TranslationPair[]> {
  return xlsx2Pairs(content, startIdx)
}
