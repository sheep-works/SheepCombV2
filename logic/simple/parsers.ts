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
 * Shared XLIFF parser logic
 * Assumes a global DOMParser is available (Browser or Shimmed Node.js)
 */
export function parseXliff(content: string): Segment[] {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(content, 'application/xml')
  const segments: Segment[] = []

  const transUnits = xmlDoc.getElementsByTagName('trans-unit')
  if (!transUnits) return []

  for (let i = 0; i < transUnits.length; i++) {
    const tu = transUnits[i]
    if (!tu) continue

    const sources = tu.getElementsByTagName('source')
    const targets = tu.getElementsByTagName('target')

    const source = sources[0]
    const target = targets[0]

    if (source) {
      // Use textContent for Node compatibility if innerHTML is not available
      segments.push({
        src: source.innerHTML || source.textContent || '',
        tgt: target ? (target.innerHTML || target.textContent || '') : '',
      })
    }
  }
  return segments
}

/**
 * Shared TMX parser logic
 */
export function parseTmx(content: string, sourceLang = 'ja', targetLang = 'en'): Segment[] {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(content, 'application/xml')
  const segments: Segment[] = []

  const tus = xmlDoc.getElementsByTagName('tu')
  if (!tus) return []

  for (let i = 0; i < tus.length; i++) {
    const tu = tus[i]
    if (!tu) continue

    const tuvs = tu.getElementsByTagName('tuv')
    let src = ''
    let tgt = ''

    for (let j = 0; j < tuvs.length; j++) {
      const tuv = tuvs[j]
      if (!tuv) continue

      const lang = tuv.getAttribute('xml:lang') || tuv.getAttribute('lang')
      const segs = tuv.getElementsByTagName('seg')
      const seg = segs[0]

      if (seg && lang) {
        if (lang.toLowerCase().startsWith(sourceLang.toLowerCase())) {
          src = seg.innerHTML || seg.textContent || ''
        } else if (lang.toLowerCase().startsWith(targetLang.toLowerCase())) {
          tgt = seg.innerHTML || seg.textContent || ''
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
 * Shared XLSX parser logic
 */
export async function parseXlsx(content: ArrayBuffer | Buffer): Promise<Segment[]> {
  const workbook = XLSX.read(content, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []

  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 })
  if (!rows) return []

  return rows
    .map(row => {
      if (!row) return { src: '', tgt: '', note: '' }
      const src = (row[0] || '').toString().trim()
      const tgt = (row[1] || '').toString().trim()
      const note = (row[2] || '').toString().trim()
      return { src, tgt, note }
    })
    .filter(s => s.src || s.tgt)
}

/**
 * Shared DOCX parser logic
 */
export async function parseDocx(content: ArrayBuffer | Buffer): Promise<Segment[]> {
  try {
    const zip = await JSZip.loadAsync(content)
    const xmlStr = await zip.file('word/document.xml')?.async('string')
    if (!xmlStr) return []

    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlStr, 'application/xml')
    const tables = doc.getElementsByTagName('w:tbl')
    const numTables = tables.length

    if (!tables || numTables === 0) return []

    const t0 = tables[0]
    if (!t0) return []

    const firstTableText = t0.textContent || ''

    // 1. memoQ Detection
    if (numTables === 1 && firstTableText.includes('dvȃZOg?E߃x?EX`E??XgύXȂE??')) {
      return extractMemoQ(t0)
    }

    // 2. Xbench Detection
    if (numTables === 2) {
      const t1 = tables[1]
      if (t1 && (t0.outerHTML || '').includes('Exported with ApSIC')) {
        return extractXbench(t1)
      }
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

function extractMemoQ(table: Element): Segment[] {
  const segments: Segment[] = []
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
      const seg: Segment = { src, tgt }
      if (note) seg.note = note
      segments.push(seg)
    }
  }
  return segments
}

function extractXbench(table: Element): Segment[] {
  const segments: Segment[] = []
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

function extractPhrase(tables: Element[]): Segment[] {
  const segments: Segment[] = []
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
        const seg: Segment = { src, tgt }
        if (note) seg.note = note
        segments.push(seg)
      }
    }
  }
  return segments
}

/**
 * Unified Parser Class for the Simple Parser tool.
 * Handles Various translation file formats.
 */
export class SimpleParser {
  /**
   * Universal parse method that routes to specific parsers based on extension.
   * @param content File content as string (for XML) or ArrayBuffer/Buffer (for logic/binary)
   * @param fileName Name of the file including extension
   */
  static async parse(content: string | ArrayBuffer | Buffer, fileName: string): Promise<Segment[]> {
    const ext = fileName.split('.').pop()?.toLowerCase() || ''

    // 1. Binary Formats (Excel, Word)
    if (ext === 'xlsx') {
      const buffer = (typeof content === 'string') 
        ? Buffer.from(content, 'binary') // Should not happen if read correctly as buffer
        : content as ArrayBuffer
      return parseXlsx(buffer)
    }

    if (ext === 'docx') {
      const buffer = (typeof content === 'string') 
        ? Buffer.from(content, 'binary')
        : content as ArrayBuffer
      return parseDocx(buffer)
    }

    // 2. Text Formats (XLIFF, TMX)
    // Ensure content is string for XML parsing
    let text = ''
    if (typeof content === 'string') {
      text = content
    } else {
      text = new TextDecoder().decode(content as ArrayBuffer)
    }

    if (['xlf', 'xliff', 'sdlxliff', 'mqxliff'].includes(ext)) {
      return parseXliff(text)
    }

    if (ext === 'tmx') {
      return parseTmx(text)
    }

    // Fallback: Try XLIFF if content looks like it
    if (text.includes('<xliff') || text.includes('<trans-unit')) {
      return parseXliff(text)
    }

    return []
  }
}
