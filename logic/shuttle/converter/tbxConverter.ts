import type { TranslationPair } from '../../types/shwv.js'

/**
 * TBX to TranslationPair converter.
 * Optimized for ShWvData.
 * Uses DOMParser.
 */
export async function tbx2Pairs(content: string, startIdx: number): Promise<TranslationPair[]> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(content, 'application/xml')
  const units: TranslationPair[] = []
  let currentIdx = startIdx

  const termEntries = doc.getElementsByTagName('termEntry')
  for (let i = 0; i < termEntries.length; i++) {
    const entry = termEntries[i]
    let src = ''
    let tgt = ''

    const langSets = entry.getElementsByTagName('langSet')
    for (let j = 0; j < langSets.length; j++) {
      const ls = langSets[j]
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
