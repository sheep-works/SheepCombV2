import type { TranslationPair } from '../../types/shwv.js'

/**
 * TMX to TranslationPair converter.
 * Optimized for ShWvData.
 * Uses DOMParser.
 */
export async function tmx2Pairs(content: string, startIdx: number): Promise<TranslationPair[]> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(content, 'application/xml')
  const units: TranslationPair[] = []
  let currentIdx = startIdx

  const tus = doc.getElementsByTagName('tu')
  for (let i = 0; i < tus.length; i++) {
    const tu = tus[i]
    let src = ''
    let tgt = ''
    const noteNode = tu.getElementsByTagName('note')[0]
    const note = noteNode ? noteNode.textContent || '' : ''

    const tuvs = tu.getElementsByTagName('tuv')
    for (let j = 0; j < tuvs.length; j++) {
      const tuv = tuvs[j]
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
