import JSZip from 'jszip'
import type { TranslationPair } from '../../../types/shwv.js'

/**
 * DOCX to TranslationPair parser.
 * Supports memoQ, Xbench, Phrase, and Generic table layouts.
 */
export async function parseDocx(content: ArrayBuffer | Buffer, startIdx: number): Promise<TranslationPair[]> {
  try {
    const zip = await JSZip.loadAsync(content)
    let xmlStr = await zip.file('word/document.xml')?.async('string')
    if (!xmlStr) return []

    // Strip BOM if present (can cause parsing errors in some DOMParsers)
    if (xmlStr.charCodeAt(0) === 0xFEFF) {
      xmlStr = xmlStr.substring(1)
    }

    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlStr, 'application/xml')
    const tables = doc.getElementsByTagName('w:tbl')
    const numTables = tables.length

    if (!tables || numTables === 0) return []

    const t0 = tables[0]
    if (!t0) return []

    const firstTableText = t0.textContent || ''
    let units: { src: string, tgt: string, note?: string }[] = []

    // 1. memoQ Detection
    if (numTables === 1 && firstTableText.includes('dvȃZOg?E߃x?EX`E??XgύXȂE??')) {
      units = extractMemoQ(t0)
    }
    // 2. Xbench Detection
    else if (numTables === 2) {
      const t1 = tables[1]
      if (t1 && (t0.outerHTML || '').includes('Exported with ApSIC')) {
        units = extractXbench(t1)
      } else {
        units = extractGeneric(Array.from(tables))
      }
    }
    // 3. Phrase Detection
    else if (numTables > 1 && firstTableText.includes('When a segment gets repeated')) {
      units = extractPhrase(Array.from(tables).slice(3))
    }
    // Fallback: Generic
    else {
      units = extractGeneric(Array.from(tables))
    }

    return units.map((u, i) => ({
      idx: startIdx + i,
      src: u.src,
      tgt: u.tgt,
      note: u.note
    }))
  } catch (e) {
    console.error('Error during Word format detection/extraction:', e)
    return []
  }
}

function extractGeneric(tables: Element[]): { src: string, tgt: string }[] {
  const segments: { src: string, tgt: string }[] = []
  for (const table of tables) {
    if (!table) continue
    const rows = table.getElementsByTagName('w:tr')
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j]
      if (!row) continue
      const cells = row.getElementsByTagName('w:tc')
      if (cells.length < 2) continue

      const cellSrc = cells[0]
      const cellTgt = cells[1]
      if (!cellSrc || !cellTgt) continue

      const src = (cellSrc.textContent || '').trim().replace(/\t/g, '\\t')
      const tgt = (cellTgt.textContent || '').trim().replace(/\t/g, '\\t')

      if (src || tgt) segments.push({ src, tgt })
    }
  }
  return segments
}

function extractMemoQ(table: Element): { src: string, tgt: string, note?: string }[] {
  const segments: { src: string, tgt: string, note?: string }[] = []
  if (!table) return []
  const rows = table.getElementsByTagName('w:tr')
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    const cells = row.getElementsByTagName('w:tc')
    if (cells.length < 3) continue

    const cellSrc = cells[1]
    const cellTgt = cells[2]
    const cellNote = cells[3]
    if (!cellSrc || !cellTgt) continue

    const src = (cellSrc.textContent || '').trim().replace(/\t/g, '\\t')
    const tgt = (cellTgt.textContent || '').trim().replace(/\t/g, '\\t')
    const note = cellNote ? (cellNote.textContent || '').trim() : ''

    if (src || tgt) {
      segments.push({ src, tgt, note: note || undefined })
    }
  }
  return segments
}

function extractXbench(table: Element): { src: string, tgt: string }[] {
  const segments: { src: string, tgt: string }[] = []
  if (!table) return []
  const rows = table.getElementsByTagName('w:tr')
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    const cells = row.getElementsByTagName('w:tc')
    if (cells.length < 2) continue

    const cellSrc = cells[0]
    const cellTgt = cells[1]
    if (!cellSrc || !cellTgt) continue

    const src = (cellSrc.textContent || '').trim().replace(/\t/g, '\\t')
    const tgt = (cellTgt.textContent || '').trim().replace(/\t/g, '\\t')

    if (src || tgt) segments.push({ src, tgt })
  }
  return segments
}

function extractPhrase(tables: Element[]): { src: string, tgt: string, note?: string }[] {
  const segments: { src: string, tgt: string, note?: string }[] = []
  for (const table of tables) {
    if (!table) continue
    const rows = table.getElementsByTagName('w:tr')
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row) continue
      const cells = row.getElementsByTagName('w:tc')
      if (cells.length < 7) continue

      const cellSrc = cells[3]
      const cellTgt = cells[4]
      const cellNote = cells[6]
      if (!cellSrc || !cellTgt) continue

      const src = (cellSrc.textContent || '').trim().replace(/\t/g, '\\t')
      const tgt = (cellTgt.textContent || '').trim().replace(/\t/g, '\\t')
      const note = cellNote ? (cellNote.textContent || '').trim() : ''

      if (src || tgt) {
        segments.push({ src, tgt, note: note || undefined })
      }
    }
  }
  return segments
}
