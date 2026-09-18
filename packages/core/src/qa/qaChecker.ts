import type { ShWvUnit, QaIssue, QaConfig, ShWvData } from '@sheep-family/types'

export const DEFAULT_QA_CONFIG: Required<QaConfig> = {
  check_numbers: true,
  check_tags: true,
  check_terms: true,
  check_consistency: true,
  check_unmodified_pe: true,
}

// -------------------------------------------------------------
// ユーティリティ
// -------------------------------------------------------------

/**
 * プレースホルダー ({@0}, {@1}, etc.) を元のタグ文字列に復元
 */
export function restorePlaceholders(text: string, placeholders?: Record<number | string, string>): string {
  if (!text) return ''
  if (!placeholders) return text
  return text.replace(/\{@(\d+)\}/g, (match, idxStr) => {
    const idx = parseInt(idxStr, 10)
    return placeholders[idx] !== undefined ? placeholders[idx] : match
  })
}

/**
 * タグ・プレースホルダーを除去した純粋な本文テキストを取得 (数字チェック等で使用)
 */
export function stripTags(text: string): string {
  if (!text) return ''
  return text.replace(/<[^>]+>|\{[^}]+\}|\[[^\]]+\]/g, ' ')
}

// -------------------------------------------------------------
// 各チェックのコアロジック (1行単位)
// -------------------------------------------------------------

/**
 * 1. 数字チェック (Number check)
 * 原文と訳文の間の数字の整合性をチェック（プレースホルダー復元およびタグ内属性数字除外済み）
 */
export function checkNumbers(unit: ShWvUnit): QaIssue | null {
  const numRe = /\d+([.,]\d+)*/g
  const rawSrc = restorePlaceholders(unit.src || '', unit.placeholders)
  const rawTgt = restorePlaceholders(unit.tgt || '', unit.placeholders)

  const cleanSrc = stripTags(rawSrc)
  const cleanTgt = stripTags(rawTgt)

  const srcNums = new Set(cleanSrc.match(numRe) || [])
  const tgtNums = new Set(cleanTgt.match(numRe) || [])

  const missingInTgt = [...srcNums].filter(n => !tgtNums.has(n))
  const missingInSrc = [...tgtNums].filter(n => !srcNums.has(n))

  if (missingInTgt.length > 0 || missingInSrc.length > 0) {
    let msg = ''
    if (missingInTgt.length > 0) {
      msg += `Missing in target: ${JSON.stringify(missingInTgt)}. `
    }
    if (missingInSrc.length > 0) {
      msg += `Missing in source: ${JSON.stringify(missingInSrc)}. `
    }
    return { issue_type: 'Number', idx: unit.idx, message: msg.trim() }
  }
  return null
}

/**
 * 2. タグチェック (Tag / Placeholder check)
 * 原文と訳文の間のタグ・プレースホルダーの整合性をチェック（プレースホルダー復元後のタグ名で比較）
 */
export function checkTags(unit: ShWvUnit): QaIssue | null {
  const tagRe = /<[^>]+>|\{[^}]+\}|\[[^\]]+\]/g
  const rawSrc = restorePlaceholders(unit.src || '', unit.placeholders)
  const rawTgt = restorePlaceholders(unit.tgt || '', unit.placeholders)

  const srcTags = new Set(rawSrc.match(tagRe) || [])
  const tgtTags = new Set(rawTgt.match(tagRe) || [])

  const missingInTgt = [...srcTags].filter(t => !tgtTags.has(t))
  const missingInSrc = [...tgtTags].filter(t => !srcTags.has(t))

  if (missingInTgt.length > 0 || missingInSrc.length > 0) {
    let msg = ''
    if (missingInTgt.length > 0) {
      msg += `Missing in target: ${JSON.stringify(missingInTgt)}. `
    }
    if (missingInSrc.length > 0) {
      msg += `Missing in source: ${JSON.stringify(missingInSrc)}. `
    }
    return { issue_type: 'Tag', idx: unit.idx, message: msg.trim() }
  }
  return null
}

/**
 * 3. 用語チェック (Termbase check)
 * unit.ref.tb を使用して訳語の含有をチェック
 */
export function checkTerms(unit: ShWvUnit): QaIssue[] {
  const issues: QaIssue[] = []
  const tbList = unit.ref?.tb
  if (!tbList || tbList.length === 0) return issues

  const tgt = restorePlaceholders(unit.tgt || '', unit.placeholders)
  for (const tb of tbList) {
    if (!tb.tgts || tb.tgts.length === 0) continue
    // 候補訳語（tb.tgts）のいずれかが訳文に含まれているか
    const matched = tb.tgts.some(cand => tgt.includes(cand))
    if (!matched) {
      issues.push({
        issue_type: 'Term',
        idx: unit.idx,
        message: `Target term missing: '${tb.tgts.join(' / ')}' (Source: '${tb.src}')`,
      })
    }
  }
  return issues
}

/**
 * 4. 整合性チェック (Consistency check)
 * unit.ref.quoted100 を使用して同一原文の訳文の一致をチェック
 */
export function checkConsistency(
  unit: ShWvUnit,
  unitMap?: Map<number, ShWvUnit>
): QaIssue[] {
  const issues: QaIssue[] = []
  const q100 = unit.ref?.quoted100
  if (!q100 || !unitMap) return issues

  const tgt = restorePlaceholders(unit.tgt || '', unit.placeholders)
  for (const prevIdx of q100) {
    if (prevIdx >= unit.idx) continue // 自身より前の行のみ比較
    const prev = unitMap.get(prevIdx)
    const prevTgt = restorePlaceholders(prev?.tgt || '', prev?.placeholders)
    if (prev && prevTgt && tgt && prevTgt !== tgt) {
      issues.push({
        issue_type: 'Consistency',
        idx: unit.idx,
        message: `Inconsistent translation with segment ${prev.idx}. (Refer: "${prevTgt}")`,
      })
    }
  }
  return issues
}

/**
 * 5. PE修正漏れチェック (Unmodified PE check)
 * pre !== tgt かつ quoted/quoted100/内部TMの参照先が pre === tgt (またはその逆) の不整合を検出
 */
export function checkUnmodifiedPe(
  unit: ShWvUnit,
  unitMap?: Map<number, ShWvUnit>
): QaIssue[] {
  const issues: QaIssue[] = []
  if (!unitMap) return issues

  // 参照先インデックスの収集 (quoted100, quoted, 内部TM)
  const refIndices = new Set<number>()
  if (unit.ref?.quoted100) {
    for (const idx of unit.ref.quoted100) {
      refIndices.add(idx)
    }
  }
  if (unit.ref?.quoted) {
    for (const item of unit.ref.quoted) {
      const idx = Array.isArray(item) ? item[0] : item
      if (typeof idx === 'number') {
        refIndices.add(idx)
      }
    }
  }
  if (unit.ref?.tms) {
    for (const tm of unit.ref.tms) {
      if (typeof tm.idx === 'number' && tm.idx > 0) {
        refIndices.add(tm.idx)
      }
    }
  }

  if (refIndices.size === 0) return issues

  const unitPre = unit.pre ?? ''
  const unitTgt = unit.tgt ?? ''
  const isUnitModified = Boolean(unitPre && unitTgt && unitPre !== unitTgt)
  const isUnitUnmodified = Boolean(unitPre && unitTgt && unitPre === unitTgt)

  for (const prevIdx of refIndices) {
    if (prevIdx >= unit.idx) continue // 自身より前の行とのペアを比較
    const prev = unitMap.get(prevIdx)
    if (!prev) continue

    const prevPre = prev.pre ?? ''
    const prevTgt = prev.tgt ?? ''
    const isPrevModified = Boolean(prevPre && prevTgt && prevPre !== prevTgt)
    const isPrevUnmodified = Boolean(prevPre && prevTgt && prevPre === prevTgt)

    // パターンA: 過去セグメントが修正済みなのに、このセグメントは未修正（下訳のまま）
    if (isPrevModified && isUnitUnmodified) {
      issues.push({
        issue_type: 'UnmodifiedPe',
        idx: unit.idx,
        message: `Referenced segment ${prev.idx} was modified from pre-translation, but this segment remains unmodified.`,
      })
    }
    // パターンB: このセグメントは修正されたのに、参照先（過去行）は未修正（下訳のまま）
    else if (isUnitModified && isPrevUnmodified) {
      issues.push({
        issue_type: 'UnmodifiedPe',
        idx: unit.idx,
        message: `This segment was modified from pre-translation, but referenced segment ${prev.idx} remains unmodified.`,
      })
    }
  }

  return issues
}

// -------------------------------------------------------------
// 統合API
// -------------------------------------------------------------

/**
 * 1行（単一Unit）のリアルタイムチェック
 * Vue の watch や エディタの onChange で呼ぶ用
 */
export function checkUnit(
  unit: ShWvUnit,
  unitMap?: Map<number, ShWvUnit>,
  config: QaConfig = DEFAULT_QA_CONFIG
): QaIssue[] {
  const issues: QaIssue[] = []

  if (config.check_numbers ?? true) {
    const issue = checkNumbers(unit)
    if (issue) issues.push(issue)
  }

  if (config.check_tags ?? true) {
    const issue = checkTags(unit)
    if (issue) issues.push(issue)
  }

  if (config.check_terms ?? true) {
    issues.push(...checkTerms(unit))
  }

  if (config.check_consistency ?? true) {
    issues.push(...checkConsistency(unit, unitMap))
  }

  if (config.check_unmodified_pe ?? true) {
    issues.push(...checkUnmodifiedPe(unit, unitMap))
  }

  return issues
}

/**
 * 全セグメントの一括チェック
 */
export function checkAllUnits(
  units: ShWvUnit[],
  config: QaConfig = DEFAULT_QA_CONFIG
): QaIssue[] {
  // idx で素早く引けるように Map 化
  const unitMap = new Map<number, ShWvUnit>()
  for (const u of units) {
    unitMap.set(u.idx, u)
  }

  const allIssues: QaIssue[] = []
  for (const unit of units) {
    allIssues.push(...checkUnit(unit, unitMap, config))
  }

  return allIssues
}

/**
 * ShWvData 全体の QA チェック
 */
export function checkShWvData(
  data: ShWvData,
  config: QaConfig = DEFAULT_QA_CONFIG
): QaIssue[] {
  if (!data?.body?.units) return []
  return checkAllUnits(data.body.units, config)
}
