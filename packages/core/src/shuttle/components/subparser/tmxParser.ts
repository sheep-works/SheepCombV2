import type { TranslationPair } from '@sheep-family/types'
import { DOMParser as XMLDOMParser } from '@xmldom/xmldom'

/**
 * TMX to TranslationPair parser.
 */
export async function parseTmx(content: string, startIdx: number): Promise<TranslationPair[]> {
  const parserOpts = { onError: (level: string, msg: string) => console.warn(`[DOMParser ${level}]`, msg) }
  const parser = typeof DOMParser !== 'undefined' ? new (DOMParser as any)(parserOpts) : new XMLDOMParser(parserOpts)
  const doc = parser.parseFromString(content, 'text/xml')
  const units: TranslationPair[] = []
  let currentIdx = startIdx

  const tus = doc.getElementsByTagName('tu')
  for (let i = 0; i < tus.length; i++) {
    const tu = tus[i]
    let src = ''
    let tgt = ''
    const noteNode = tu?.getElementsByTagName('note')[0]
    const note = noteNode ? noteNode.textContent || '' : ''

    const tuvs = tu?.getElementsByTagName('tuv')
    if (!tuvs) continue

    for (let j = 0; j < tuvs.length; j++) {
      const tuv = tuvs[j]
      if (!tuv) continue
      const textNode = tuv.getElementsByTagName('seg')[0]
      const text = textNode ? textNode.textContent || '' : ''

      if (!src) {
        src = text
      } else if (!tgt) {
        tgt = text
      } else {
        tgt += '\n' + text
      }
    }

    if (src) {
      units.push({
        idx: currentIdx++,
        src,
        tgt,
        note
      })
    }
  }

  return units
}
