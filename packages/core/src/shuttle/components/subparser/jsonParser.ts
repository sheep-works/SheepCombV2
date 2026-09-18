import type { TranslationPair } from '@sheep-family/types'

/**
 * JSON and JSONL to TranslationPair parser.
 */
export async function parseJson(content: string, startIdx: number): Promise<TranslationPair[]> {
  const units: TranslationPair[] = []
  let currentIdx = startIdx

  try {
    const parsed = JSON.parse(content)

    // Case 1: ShWvData structure ({ meta: ..., body: { units: [...] } })
    if (parsed && typeof parsed === 'object' && parsed.body && Array.isArray(parsed.body.units)) {
      for (const item of parsed.body.units) {
        const src = item.src || item.pre || ''
        if (src) {
          units.push({
            idx: currentIdx++,
            src,
            tgt: item.tgt || item.pre || '',
            note: item.note || item.notes || undefined
          })
        }
      }
      return units
    }

    // Case 2: Array of objects or single object
    const items = Array.isArray(parsed) ? parsed : [parsed]
    for (const item of items) {
      if (item && typeof item === 'object') {
        const src = item.src || item.Source || ''
        const tgt = item.tgt || item.Target || ''
        const note = item.note || item.notes || item.Note || undefined
        if (src || tgt) {
          units.push({
            idx: currentIdx++,
            src,
            tgt,
            note
          })
        }
      }
    }
  } catch (e) {
    // Fallback: Attempt parsing as JSONL if single JSON.parse failed
    return parseJsonl(content, startIdx)
  }

  return units
}

export async function parseJsonl(content: string, startIdx: number): Promise<TranslationPair[]> {
  const units: TranslationPair[] = []
  let currentIdx = startIdx
  const lines = content.split('\n')

  for (const line of lines) {
    if (!line.trim()) continue
    try {
      const parsed = JSON.parse(line)
      if (parsed && typeof parsed === 'object') {
        const src = parsed.src || parsed.Source || ''
        const tgt = parsed.tgt || parsed.Target || ''
        const note = parsed.note || parsed.notes || parsed.Note || undefined
        if (src || tgt) {
          units.push({
            idx: currentIdx++,
            src,
            tgt,
            note
          })
        }
      }
    } catch (e) {
      console.error(`Failed to parse JSONL line:`, e)
    }
  }
  return units
}
