import JSZip from 'jszip'
import * as XLSX from 'xlsx'

export interface Segment {
  src: string
  tgt: string
  note?: string
  [key: string]: unknown
}

/**
 * Utility to strip tags from text
 */
export function stripTags(text: string): string {
  if (!text) return ''
  return text.replace(/<.*?>|&lt;.*?&gt;/g, '')
}

/**
 * Ported from Python: parse_xliff
 */
export function parseXliff(content: string): Segment[] {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(content, 'application/xml')
  const segments: Segment[] = []

  const transUnits = xmlDoc.getElementsByTagName('trans-unit')
  for (let i = 0; i < transUnits.length; i++) {
    const tu = transUnits[i]
    const source = tu.getElementsByTagName('source')[0]
    const target = tu.getElementsByTagName('target')[0]

    if (source) {
      segments.push({
        src: source.innerHTML,
        tgt: target ? target.innerHTML : '',
      })
    }
  }
  return segments
}

/**
 * Ported from Python: parse_tmx
 */
export function parseTmx(content: string, sourceLang = 'ja', targetLang = 'en'): Segment[] {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(content, 'application/xml')
  const segments: Segment[] = []

  const tus = xmlDoc.getElementsByTagName('tu')
  for (let i = 0; i < tus.length; i++) {
    const tu = tus[i]
    const tuvs = tu.getElementsByTagName('tuv')
    let src = ''
    let tgt = ''

    for (let j = 0; j < tuvs.length; j++) {
      const tuv = tuvs[j]
      const lang = tuv.getAttribute('xml:lang') || tuv.getAttribute('lang')
      const seg = tuv.getElementsByTagName('seg')[0]
      if (seg && lang) {
        if (lang.toLowerCase().startsWith(sourceLang.toLowerCase())) {
          src = seg.innerHTML
        } else if (lang.toLowerCase().startsWith(targetLang.toLowerCase())) {
          tgt = seg.innerHTML
        }
      }
    }

    if (src || tgt) {
      segments.push({ src, tgt })
    }
  }
  return segments
}

/**
 * Ported from Python: parse_xlsx
 */
export async function parseXlsx(content: ArrayBuffer): Promise<Segment[]> {
  const workbook = XLSX.read(content, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })

  return rows
    .map(row => {
      const src = (row[0] || '').toString().trim()
      const tgt = (row[1] || '').toString().trim()
      const note = (row[2] || '').toString().trim()
      return { src, tgt, note }
    })
    .filter(s => s.src || s.tgt)
}

/**
 * Ported from Python: parse_docx
 * Exact implementation of scripts/parser/docx_parser.py
 */
export async function parseDocx(content: ArrayBuffer): Promise<Segment[]> {
  const zip = await JSZip.loadAsync(content)
  const xmlStr = await zip.file('word/document.xml')?.async('string')
  if (!xmlStr) return []

  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlStr, 'application/xml')
  const tables = doc.getElementsByTagName('w:tbl')
  const numTables = tables.length

  if (numTables === 0) return []

  const firstTableText = tables[0].textContent || ''

  try {
    // 1. memoQ Detection
    if (numTables === 1 && firstTableText.includes('重要！セグメントIDやソーステキストを変更しないでください')) {
      return extractMemoQ(tables[0])
    }

    // 2. Xbench Detection
    if (numTables === 2 && tables[0].outerHTML.includes('Exported with ApSIC')) {
      return extractXbench(tables[1])
    }

    // 3. Phrase Detection
    if (numTables > 1 && firstTableText.includes('When a segment gets repeated')) {
      return extractPhrase(Array.from(tables).slice(3))
    }

    // Fallback: Generic
    return extractGeneric(Array.from(tables))
  } catch (e) {
    console.error('Error during Word format detection/extraction:', e)
    return []
  }
}

function extractGeneric(tables: Element[]): Segment[] {
  const segments: Segment[] = []
  for (const table of tables) {
    const rows = table.getElementsByTagName('w:tr')
    for (let j = 0; j < rows.length; j++) {
      const cells = rows[j].getElementsByTagName('w:tc')
      if (cells.length < 2) continue

      const src = (cells[0].textContent || '').trim().replace(/\t/g, '\\t')
      const tgt = (cells[1].textContent || '').trim().replace(/\t/g, '\\t')

      if (src || tgt) segments.push({ src, tgt })
    }
  }
  return segments
}

function extractMemoQ(table: Element): Segment[] {
  const segments: Segment[] = []
  const rows = table.getElementsByTagName('w:tr')
  // 0: Title, 1: Header, 2-: Data
  for (let i = 2; i < rows.length; i++) {
    const cells = rows[i].getElementsByTagName('w:tc')
    if (cells.length < 3) continue

    const src = (cells[1].textContent || '').trim().replace(/\t/g, '\\t')
    const tgt = (cells[2].textContent || '').trim().replace(/\t/g, '\\t')
    const note = cells.length > 3 ? (cells[3].textContent || '').trim() : ''

    if (src || tgt) {
      const seg: Segment = { src, tgt }
      if (note) seg.note = note
      segments.push(seg)
    }
  }
  return segments
}

function extractXbench(table: Element): Segment[] {
  const segments: Segment[] = []
  const rows = table.getElementsByTagName('w:tr')
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].getElementsByTagName('w:tc')
    if (cells.length < 2) continue

    const src = (cells[0].textContent || '').trim().replace(/\t/g, '\\t')
    const tgt = (cells[1].textContent || '').trim().replace(/\t/g, '\\t')

    if (src || tgt) segments.push({ src, tgt })
  }
  return segments
}

function extractPhrase(tables: Element[]): Segment[] {
  const segments: Segment[] = []
  for (const table of tables) {
    const rows = table.getElementsByTagName('w:tr')
    for (let i = 0; i < rows.length; i++) {
      const cells = rows[i].getElementsByTagName('w:tc')
      if (cells.length < 7) continue

      const src = (cells[3].textContent || '').trim().replace(/\t/g, '\\t')
      const tgt = (cells[4].textContent || '').trim().replace(/\t/g, '\\t')
      const note = (cells[6].textContent || '').trim()

      if (src || tgt) {
        const seg: Segment = { src, tgt }
        if (note) seg.note = note
        segments.push(seg)
      }
    }
  }
  return segments
}
