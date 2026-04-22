import { SequenceMatcher } from 'difflib-ts';
import type {
  ShWvUnit,
  ShWvRefTm
} from '../types/shwv.js'

/**
 * Results from WASM analyze_all
 */
export interface WasmAnalyzeResult {
  t: number[] // TM indices
  i: number[] // Internal indices
  g: number[] // Glossary (TB) indices
}

export class SheepShuttleDiffer {
  private static matcher = new SequenceMatcher(null, '', '')

  /**
   * Generates diff HTML using opcodes from SequenceMatcher
   */
  static applyOpcodes(src1: string, src2: string, opcodes: [string, number, number, number, number][]): string {
    let result = ''
    for (const [tag, i1, i2, j1, j2] of opcodes) {
      if (tag === 'equal') {
        result += src2.substring(j1, j2)
      } else if (tag === 'replace') {
        result += `[del]${src1.substring(i1, i2)}[/del][ins]${src2.substring(j1, j2)}[/ins]`
      } else if (tag === 'delete') {
        result += `[del]${src1.substring(i1, i2)}[/del]`
      } else if (tag === 'insert') {
        result += `[ins]${src2.substring(j1, j2)}[/ins]`
      }
    }

    // Escape HTML first, then restore tags for del/ins
    result = result.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    return result.replace(/\[ins\]/g, '<ins>')
      .replace(/\[\/ins\]/g, '</ins>')
      .replace(/\[del\]/g, '<del>')
      .replace(/\[\/del\]/g, '</del>')
  }

  /**
   * Orchestrates the analysis of units using WASM candidate search and precise diffing.
   * 
   * @param units Active units to analyze
   * @param memories External TM memories
   * @param termbase External/Internal termbase
   * @param wasmAnalyzeAll Function provided by sheep-spindle WASM
   * @param legacy If true, uses legacy substring-based matching for TB
   */
  static async analyze(
    units: ShWvUnit[],
    memories: any[],
    termbase: any[],
    wasmAnalyzeAll: (tmList: string[], textList: string[], tbList: string[], minRatio: number, counts: number) => WasmAnalyzeResult[],
    legacy: boolean = false
  ) {
    const tmList = memories.map(m => m.src)
    const textList = units.map(u => u.src)
    const tbList = termbase.map(t => t.src)

    // Call WASM analytical functions
    const results = wasmAnalyzeAll(tmList, textList, tbList, 0.6, 5)

    // First, clear old analysis data for all units
    for (const unit of units) {
      unit.ref.tms = []
      unit.ref.tb = []
      unit.ref.quoted = []
      unit.ref.quoted100 = []
    }

    // Process results for each unit
    for (let i = 0; i < units.length; i++) {
      const currentUnit = units[i]
      const currentResult = results[i]
      if (!currentUnit || !currentResult) {
        continue
      }

      // 1. Process TM Matches (External and Internal)
      const tmSources = currentResult.t
        .map((idx: number) => memories[idx])
        .filter((s: any) => s !== undefined)

      const internalSources = currentResult.i
        .map((idx: number) => {
          const u = units[idx]
          if (!u) return undefined
          return {
            idx: u.idx,
            src: u.src,
            tgt: u.tgt || u.pre || '',
            file: 'Internal'
          }
        })
        .filter((s: any) => s !== undefined)

      const allSources = [...tmSources, ...internalSources]

      // Deduplicate by src + tgt
      const uniqueSources: typeof allSources = []
      const seenTm = new Set<string>()
      for (const s of allSources) {
        const key = s.src + '|||' + s.tgt
        if (!seenTm.has(key)) {
          seenTm.add(key)
          uniqueSources.push(s)
        }
      }

      // Calculate precise ratios and diffs
      const diffedTms = this.computeDiffsForWasm(uniqueSources, currentUnit.src)
      currentUnit.ref.tms = diffedTms.slice(0, 5)

      // 2. Process TB Matches (Glossary)
      if (!legacy) {
        // WASM Aho-Corasick result
        const tbIndices = currentResult.g || []
        for (const tbIdx of tbIndices) {
          const tb = termbase[tbIdx]
          if (!tb) continue

          const tbTarget = tb.tgt || tb.pre || ''
          let existingEntry = currentUnit.ref.tb.find(t => t.src === tb.src)

          if (existingEntry) {
            if (!existingEntry.tgts.includes(tbTarget)) {
              existingEntry.tgts.push(tbTarget)
            }
          } else {
            currentUnit.ref.tb.push({
              src: tb.src,
              tgts: [tbTarget],
              note: (tb.file as string) || ''
            })
          }
        }
      } else {
        // Legacy substring-based matching
        for (let j = 0; j < termbase.length; j++) {
          const tb = termbase[j]
          if (tb.src && currentUnit.src.includes(tb.src)) {
            const tbTarget = tb.tgt || tb.pre || ''
            let existingEntry = currentUnit.ref.tb.find(t => t.src === tb.src)

            if (existingEntry) {
              if (!existingEntry.tgts.includes(tbTarget)) {
                existingEntry.tgts.push(tbTarget)
              }
            } else {
              currentUnit.ref.tb.push({
                src: tb.src,
                tgts: [tbTarget],
                note: (tb.file as string) || ''
              })
            }
          }
        }
      }
    }

    // 3. Synchronization of back-references
    for (let i = units.length - 1; i >= 0; i--) {
      const currentUnit = units[i]
      if (!currentUnit || !currentUnit.ref) continue

      for (const tm of currentUnit.ref.tms) {
        if (tm.idx !== -1) {
          const referencedUnit = units.find(u => u.idx === tm.idx)
          if (referencedUnit) {
            if (tm.ratio === 100) {
              referencedUnit.ref.quoted100.push(currentUnit.idx)
            } else {
              referencedUnit.ref.quoted.push([currentUnit.idx, tm.ratio])
            }
          }
        }
      }
    }
  }

  /**
   * Refined diff calculation for WASM candidates
   */
  static computeDiffsForWasm(srcs: { idx: number, src: string, tgt: string, file?: string }[], crtSrc: string): ShWvRefTm[] {
    let results: { tm: ShWvRefTm; opcodes: [string, number, number, number, number][] }[] = []

    this.matcher.setSeq2(crtSrc)

    for (const s of srcs) {
      this.matcher.setSeq1(s.src)
      const ratio = this.matcher.ratio()
      const opcodes = this.matcher.getOpcodes() as [string, number, number, number, number][]

      const tm: ShWvRefTm = {
        idx: s.idx,
        src: s.src,
        tgt: s.tgt,
        ratio: ratio
        // diff will be added below
      }

      results.push({ tm, opcodes })
    }

    this.matcher.setSeqs('', '')

    // Sort by ratio to ensure best matches are first
    results.sort((a, b) => b.tm.ratio - a.tm.ratio)

    return results.map(match => {
      if (match.tm.ratio !== 1) {
        match.tm.diff = this.applyOpcodes(match.tm.src, crtSrc, match.opcodes)
      }
      match.tm.ratio = Math.round(match.tm.ratio * 100)
      return match.tm
    })
  }
}
