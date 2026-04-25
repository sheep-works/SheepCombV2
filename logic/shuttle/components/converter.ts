import type { ShWvData, ShWvUnit, TranslationPair, ShWvFileInfo } from '../../types/shwv.js'
import type { SheepShuttle } from '../sheepShuttle.js'

export class ShuttleConverter {
  private parent: SheepShuttle

  constructor(parent: SheepShuttle) {
    this.parent = parent
  }

  /**
   * Convert TranslationPairs to ShWvData.
   * Performs tag protection (replacing XML tags with {@idx} and storing in placeholders).
   */
  fromUnits(units: TranslationPair[], files: ShWvFileInfo[]): ShWvData {
    const allUnits: ShWvUnit[] = []

    for (const p of units) {
      let placeholders: Record<number, string> = {}
      let counter = 0

      // Protect tags function
      const protectTags = (text: string) => {
        if (!text) return ''
        return text.replace(/(<[^>]+>|&lt;[\s\S]*?&gt;)/g, (tagMatch: string) => {
          placeholders[counter] = tagMatch
          const replaceString = `{@${counter}}`
          counter++
          return replaceString
        })
      }

      const unit: ShWvUnit = {
        idx: p.idx,
        src: protectTags(p.src),
        pre: '',
        tgt: p.tgt ? protectTags(p.tgt) : '',
        note: p.note,
        isSub: p.isSub,
        ref: { tms: [], tb: [], quoted: [], quoted100: [] },
        placeholders
      }
      
      allUnits.push(unit)
    }

    return {
      define: {
        name: 'SHWV_DATA',
        version: '1.0'
      },
      meta: {
        bilingualPath: '',
        files: files,
        sourceLang: 'ja',
        targetLang: 'en',
        tmFiles: [...this.parent.tmFiles],
        tbFiles: [...this.parent.tbFiles]
      },
      body: {
        units: allUnits,
        terms: []
      }
    }
  }

  /**
   * Load existing ShWvData JSON and set state.
   */
  fromShwvJsonFile(content: string): ShWvData {
    try {
      const data: ShWvData = JSON.parse(content)
      if (data.define?.name !== 'SHWV_DATA') {
        throw new Error('Not a valid ShWvData: missing or incorrect define property')
      }
      return data
    } catch (e) {
      console.error('Failed to parse ShWvData JSON:', e)
      throw new Error('Invalid ShWvData JSON')
    }
  }
}
