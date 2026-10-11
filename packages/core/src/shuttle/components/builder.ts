// @ts-nocheck
import type { ShWvData, BuildOptions } from '@sheep-family/types'
import type { SheepShuttle } from '../sheepShuttle.js'

export class ShuttleBuilder {
  private parent: SheepShuttle

  constructor(parent: SheepShuttle) {
    this.parent = parent
  }

  /**
   * Build an XLIFF file from ShWvData and original XML content.
   */
  async build(xmlContent: string, data: ShWvData, options?: BuildOptions): Promise<string> {
    const shwvUnits = data.body.units
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlContent, 'application/xml')

    let currentIdx = 0
    const transUnits = doc.getElementsByTagName('trans-unit')

    const hasMqNs = doc.documentElement?.getAttribute('xmlns:mq') !== null || xmlContent.includes('xmlns:mq=')
    const hasMNs = doc.documentElement?.getAttribute('xmlns:m') !== null || xmlContent.includes('xmlns:m=')
    const lockDuplicates = !!options?.lockDuplicates
    const lockThreshold = options?.lockThreshold ?? 100

    for (let i = 0; i < transUnits.length; i++) {
      const tu = transUnits[i]
      if (currentIdx < shwvUnits.length) {
        // Aggregate all isSub units that belong to this trans-unit
        let combinedTgt = ''
        let isFirst = true
        let shouldLock = false

        while (currentIdx < shwvUnits.length) {
          const unit = shwvUnits[currentIdx]!
          if (!isFirst) combinedTgt += '\n'

          combinedTgt += (unit.tgt ? unit.tgt : (unit.pre ? unit.pre : unit.src))

          if (lockDuplicates && unit.ref?.tms?.length) {
            const maxRatio = Math.max(...unit.ref.tms.map(t => t.ratio))
            if (maxRatio >= lockThreshold) {
              shouldLock = true
            }
          }

          currentIdx++
          isFirst = false

          // If the current unit wasn't a sub, it's the end of this trans-unit
          if (!unit.isSub) break
        }

        // Convert back tags if they were replaced by <br/> (if any)
        combinedTgt = combinedTgt.replace(/<br\/>/g, '\n')

        let targetNode = tu?.getElementsByTagName('target')[0]
        if (!targetNode) {
          targetNode = doc.createElement('target')
          targetNode.setAttribute('state', 'translated')
          tu!.appendChild(targetNode)
        } else {
          targetNode.setAttribute('state', 'translated')
        }

        targetNode.textContent = combinedTgt

        if (shouldLock && tu) {
          tu.setAttribute('translate', 'no')
          if (hasMqNs) {
            tu.setAttribute('mq:locked', 'locked')
          }
          if (hasMNs) {
            tu.setAttribute('m:locked', 'true')
          }
        }
      } else {
        currentIdx++
      }
    }

    // Serialize back to string
    try {
      const serializer = new (globalThis as any).XMLSerializer()
      let resultXml = serializer.serializeToString(doc)
      resultXml = resultXml.replace(/&lt;[\s\S]*?&gt;/g, (tagMatch) => {
        return tagMatch.replace(/"/g, '&quot;')
      })
      return resultXml
    } catch (e) {
      // If shim is missing, fallback to basic toString if available or error
      let resultXml = (doc as any).toString() || ''
      return resultXml.replace(/&lt;[\s\S]*?&gt;/g, (tagMatch) => {
        return tagMatch.replace(/"/g, '&quot;')
      })
    }
  }
}
