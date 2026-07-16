import type { TranslationPair } from '@sheep-family/types'
import { DOMParser as XMLDOMParser } from '@xmldom/xmldom'

/**
 * TBX to TranslationPair parser.
 */
export async function parseTbx(content: string, startIdx: number): Promise<TranslationPair[]> {
  const parserOpts = { onError: (level: string, msg: string) => console.warn(`[DOMParser ${level}]`, msg) }
  const parser = typeof DOMParser !== 'undefined' ? new (DOMParser as any)(parserOpts) : new XMLDOMParser(parserOpts)
  const doc = parser.parseFromString(content, 'text/xml')
  const units: TranslationPair[] = []
  let currentIdx = startIdx

  const termEntries = doc.getElementsByTagName('termEntry')
  for (let i = 0; i < termEntries.length; i++) {
    const entry = termEntries[i]
    let src = ''
    let tgt = ''

    const langSets = entry?.getElementsByTagName('langSet')
    if (!langSets) continue

    for (let j = 0; j < langSets.length; j++) {
      const ls = langSets[j]
      if (!ls) continue
      const termNode = ls.getElementsByTagName('term')[0]
      const extracted = termNode ? termNode.textContent || '' : ''

      if (!src) src = extracted
      else if (!tgt) tgt = extracted
    }

    if (src) {
      units.push({
        idx: currentIdx++,
        src,
        tgt
      })
    }
  }

  return units
}
