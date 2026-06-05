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

    let src = sourceNode.innerHTML || sourceNode.textContent || ''
    let tgt = targetNode ? (targetNode.innerHTML || targetNode.textContent || '') : ''
    let note = noteNode ? (noteNode.textContent || '') : ''

    // Protect mqxliff line-break tags from being split by replacing the literal newline with <br/> (restored in builder.ts)
    const mqChRegex = /(<mq:ch val=["'])([^"']*)(["']\s*\/?>)/gi
    src = src.replace(mqChRegex, (match, p1, p2, p3) => p1 + p2.replace(/\r?\n/g, '<br/>') + p3)
    tgt = tgt.replace(mqChRegex, (match, p1, p2, p3) => p1 + p2.replace(/\r?\n/g, '<br/>') + p3)

    // Status extraction (XLIFF approved or MXLIFF m:confirmed)
    let status = 0
    if (tu.getAttribute('approved') === 'yes' || tu.getAttribute('m:confirmed') === '1') {
      status = 1
    }

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
          tgt: tgtParts[k] || "",
          status: status
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
        status: status
      }
      if (note) unit.note = note
      units.push(unit)
      currentIdx++
    }
  }

  return units
}
