import type { ShWvData, ShWvUnit, TranslationPair, ShWvFileInfo, ProjectInfo } from '@sheep-family/types'
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
  fromUnits(units: TranslationPair[], files: ShWvFileInfo[], projectInfo?: ProjectInfo): ShWvData {
    const allUnits: ShWvUnit[] = []

    for (const p of units) {
      let placeholders: Record<number, string> = {}
      const tagMap = new Map<string, number>()
      let counter = 0

      // Protect tags function (reuses placeholder index for identical tags within the unit)
      // Note: MXLIFF / Phrase (Memsource) custom markers like {1>, <1}, {1} are matched FIRST.
      // This prevents greedy matching from <1} to {2> in text like "{1>foo<1}bar{2>baz<2}" which would otherwise swallow middle text ("bar").
      const protectTags = (text: string) => {
        if (!text) return ''
        return text.replace(/(\{\d+>|<\d+\}|\{\d+\}|<\d+>|<(?:"[^"]*"|'[^']*'|[^'">])+>|&lt;[\s\S]*?&gt;)/g, (tagMatch: string) => {
          let idx = tagMap.get(tagMatch)
          if (idx === undefined) {
            idx = counter
            tagMap.set(tagMatch, idx)
            placeholders[idx] = tagMatch
            counter++
          }
          return `{@${idx}}`
        })
      }

      const unit: ShWvUnit = {
        idx: p.idx,
        src: protectTags(p.src),
        pre: '',
        tgt: p.tgt ? protectTags(p.tgt) : '',
        note: p.note,
        isSub: p.isSub,
        status: p.status || 0,
        ref: { tms: [], tb: [], quoted: [], quoted100: [] },
        placeholders
      }
      
      allUnits.push(unit)
    }

    // Determine languages from projectInfo, fallback to 'ja'/'en'
    let sourceLang = 'ja'
    let targetLang = 'en'
    if (projectInfo) {
      if (projectInfo.sourceLanguage) {
        sourceLang = projectInfo.sourceLanguage.split('-')[0]?.toLowerCase() || 'ja'
      }
      if (projectInfo.targetLanguage) {
        targetLang = projectInfo.targetLanguage.split('-')[0]?.toLowerCase() || 'en'
      }
    }

    return {
      define: {
        name: 'SHWV_DATA',
        version: '1.2'
      },
      meta: {
        bilingualPath: '',
        files: files,
        sourceLang,
        targetLang,
        tmFiles: [...this.parent.tmFiles],
        tbFiles: [...this.parent.tbFiles]
      },
      body: {
        units: allUnits,
        terms: []
      },
      projectInfo
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
