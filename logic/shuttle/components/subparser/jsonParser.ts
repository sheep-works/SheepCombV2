import type { TranslationPair } from '../../../types/shwv.js'

/**
 * JSON and JSONL to TranslationPair parser.
 */
export async function parseJson(content: string, startIdx: number): Promise<TranslationPair[]> {
  const units: TranslationPair[] = []
  let currentIdx = startIdx

  try {
    const parsed = JSON.parse(content)
    const items = Array.isArray(parsed) ? parsed : [parsed]
    for (const item of items) {
      if (item.src) {
        units.push({
          idx: currentIdx++,
          src: item.src,
          tgt: item.tgt || ""
        })
      }
    }
  } catch (e) {
    console.error(`Failed to parse JSON:`, e)
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
      if (parsed.src) {
        units.push({
          idx: currentIdx++,
          src: parsed.src,
          tgt: parsed.tgt || ""
        })
      }
    } catch (e) {
      console.error(`Failed to parse JSONL line:`, e)
    }
  }
  return units
}
