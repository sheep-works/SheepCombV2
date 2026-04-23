import type { TranslationPair } from '../../../types/shwv.js'

/**
 * XLIFF (and siblings) to TranslationPair parser.
 */
export async function parseXliff(content: string, startIdx: number): Promise<TranslationPair[]> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(content, 'application/xml')
  const units: TranslationPair[] = []
  let currentIdx = startIdx

  const transUnits = doc.getElementsByTagName('trans-unit')
  for (let i = 0; i < transUnits.length; i++) {
    const tu = transUnits[i]! as Element
    const sourceNode = tu.getElementsByTagName('source')[0]! as Element
    const targetNode = tu.getElementsByTagName('target')[0]! as Element
    const noteNode = tu.getElementsByTagName('context')[0]! as Element 

    if (!sourceNode) continue

    const src = sourceNode.innerHTML || sourceNode.textContent || ''
    const tgt = targetNode ? (targetNode.innerHTML || targetNode.textContent || '') : ''
    let note = noteNode ? (noteNode.textContent || '') : ''

    // Advanced: split by newline if present
    const srcParts = src.split('\n')
    let tgtParts = tgt.split('\n')

    if (srcParts.length > 1 || tgtParts.length > 1) {
      if (srcParts.length > tgtParts.length) {
        const diff = srcParts.length - tgtParts.length
        for (let k = 0; k < diff; k++) tgtParts.push('')
      } else if (srcParts.length < tgtParts.length) {
        const excessTarget = tgtParts.splice(srcParts.length - 1).join('<br/>')
        tgtParts.push(excessTarget)
      }

      for (let k = 0; k < srcParts.length; k++) {
        const isLastNode = (k === srcParts.length - 1)
        const unit: TranslationPair = {
          idx: currentIdx,
          src: srcParts[k] || "",
          tgt: tgtParts[k] || ""
        }
        if (!isLastNode) unit.isSub = true
        if (note && k === 0) unit.note = note

        units.push(unit)
        currentIdx++
      }
    } else {
      const unit: TranslationPair = {
        idx: currentIdx,
        src: src,
        tgt: tgt,
      }
      if (note) unit.note = note
      units.push(unit)
      currentIdx++
    }
  }

  return units
}
