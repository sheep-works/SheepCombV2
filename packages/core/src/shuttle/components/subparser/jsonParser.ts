import type { TranslationPair } from '@sheep-family/types'

function extractForbiddensAndTgt(item: any, isForbiddenFile: boolean): { tgt: string, note?: string, forbiddens?: string[] } {
  let tgt = item.tgt || item.Target || ''
  let note = item.note || item.notes || item.Note || undefined
  const forbiddens: string[] = []

  if (Array.isArray(item.forbiddens)) {
    forbiddens.push(...item.forbiddens.map((f: any) => String(f)))
  } else if (typeof item.forbiddens === 'string') {
    forbiddens.push(item.forbiddens)
  }

  if (Array.isArray(item.forbidden)) {
    forbiddens.push(...item.forbidden.map((f: any) => String(f)))
  } else if (typeof item.forbidden === 'string') {
    forbiddens.push(item.forbidden)
  }

  let isForbidden = isForbiddenFile
  if (note && /__forbidden__/i.test(note)) {
    isForbidden = true
    note = note.replace(/__forbidden__/gi, '').trim() || undefined
  }

  if (isForbidden && tgt) {
    if (!forbiddens.includes(tgt)) {
      forbiddens.push(tgt)
    }
    tgt = ''
  }

  return {
    tgt,
    note,
    forbiddens: forbiddens.length > 0 ? forbiddens : undefined
  }
}

/**
 * JSON and JSONL to TranslationPair parser.
 */
export async function parseJson(content: string, startIdx: number, fileName?: string): Promise<TranslationPair[]> {
  const units: TranslationPair[] = []
  let currentIdx = startIdx
  const isForbiddenFile = Boolean(fileName && /forbidden/i.test(fileName))

  try {
    const parsed = JSON.parse(content)

    // Case 1: ShWvData structure ({ meta: ..., body: { units: [...] } })
    if (parsed && typeof parsed === 'object' && parsed.body && Array.isArray(parsed.body.units)) {
      for (const item of parsed.body.units) {
        const src = item.src || item.pre || ''
        if (src) {
          const { tgt, note, forbiddens } = extractForbiddensAndTgt(item, isForbiddenFile)
          units.push({
            idx: currentIdx++,
            src,
            tgt: tgt || item.pre || '',
            note,
            ...(forbiddens ? { forbiddens } : {})
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
        const { tgt, note, forbiddens } = extractForbiddensAndTgt(item, isForbiddenFile)
        if (src || tgt || forbiddens) {
          units.push({
            idx: currentIdx++,
            src,
            tgt,
            note,
            ...(forbiddens ? { forbiddens } : {})
          })
        }
      }
    }
  } catch (e) {
    // Fallback: Attempt parsing as JSONL if single JSON.parse failed
    return parseJsonl(content, startIdx, fileName)
  }

  return units
}

export async function parseJsonl(content: string, startIdx: number, fileName?: string): Promise<TranslationPair[]> {
  const units: TranslationPair[] = []
  let currentIdx = startIdx
  const isForbiddenFile = Boolean(fileName && /forbidden/i.test(fileName))
  const lines = content.split('\n')

  for (const line of lines) {
    if (!line.trim()) continue
    try {
      const parsed = JSON.parse(line)
      if (parsed && typeof parsed === 'object') {
        const src = parsed.src || parsed.Source || ''
        const { tgt, note, forbiddens } = extractForbiddensAndTgt(parsed, isForbiddenFile)
        if (src || tgt || forbiddens) {
          units.push({
            idx: currentIdx++,
            src,
            tgt,
            note,
            ...(forbiddens ? { forbiddens } : {})
          })
        }
      }
    } catch (e) {
      console.error(`Failed to parse JSONL line:`, e)
    }
  }
  return units
}
