import type { ShWvUnit } from '../../types/shwv'

/**
 * ShWvUnit data back to XLIFF converter.
 * Ported from converter/xlf/Shwv2Xliff.ts.
 * Uses DOMParser and XMLSerializer (via global shim).
 */
export async function shwv2xlf(xmlContent: string, shwvUnits: ShWvUnit[]): Promise<string> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlContent, 'application/xml')
  
  let currentIdx = 0
  const transUnits = doc.getElementsByTagName('trans-unit')

  for (let i = 0; i < transUnits.length; i++) {
    const tu = transUnits[i]
    if (currentIdx < shwvUnits.length) {
      // Aggregate all isSub units that belong to this trans-unit
      let combinedTgt = ''
      let isFirst = true

      while (currentIdx < shwvUnits.length) {
        const unit = shwvUnits[currentIdx]
        if (!isFirst) combinedTgt += '\n'
        
        combinedTgt += (unit.tgt ? unit.tgt : (unit.pre ? unit.pre : unit.src))
        
        currentIdx++
        isFirst = false

        // If the current unit wasn't a sub, it's the end of this trans-unit
        if (!unit.isSub) break
      }

      // Convert back tags if they were replaced by <br/> (if any)
      combinedTgt = combinedTgt.replace(/<br\/>/g, '\n')

      let targetNode = tu.getElementsByTagName('target')[0]
      if (!targetNode) {
        targetNode = doc.createElement('target')
        targetNode.setAttribute('state', 'translated')
        tu.appendChild(targetNode)
      } else {
        targetNode.setAttribute('state', 'translated')
      }
      
      targetNode.textContent = combinedTgt
    } else {
      currentIdx++
    }
  }

  // Serialize back to string
  try {
    const serializer = new (globalThis as any).XMLSerializer()
    return serializer.serializeToString(doc)
  } catch (e) {
    // If shim is missing, fallback to basic toString if available or error
    return (doc as any).toString() || ''
  }
}
