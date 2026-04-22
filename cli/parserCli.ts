/**
 * cli/parserCli.ts
 * Parser サブメニュー (Node.js 版)
 */
import { Interface } from 'node:readline/promises'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { PATHS, SUPPORTED_EXTS } from './config.js'
import { parseFile, saveAsJson, saveAsCsv } from './api.js'
import { type Segment } from '../logic/simple/parsers.js'

// ユーティリティ
function ensureOutDir() {
  if (!fs.existsSync(PATHS.outDir)) {
    fs.mkdirSync(PATHS.outDir, { recursive: true })
  }
}

function listSrcFiles(): string[] {
  if (!fs.existsSync(PATHS.srcDir)) {
    fs.mkdirSync(PATHS.srcDir, { recursive: true })
    return []
  }
  return fs.readdirSync(PATHS.srcDir).filter(f => {
    const ext = f.split('.').pop()?.toLowerCase() ?? ''
    return SUPPORTED_EXTS.includes(ext)
  })
}

// 実行処理
async function runParseAll(): Promise<Segment[]> {
  const files = listSrcFiles()
  if (files.length === 0) {
    console.log(`\n  ⚠ ${PATHS.srcDir} にサポート対象ファイルがありません`)
    console.log(`  対応拡張子: ${SUPPORTED_EXTS.join(', ')}`)
    return []
  }

  console.log(`\n  [Parser] ${files.length} ファイルを解析中...`)
  let all: Segment[] = []
  
  for (const f of files) {
    try {
      const fullPath = path.join(PATHS.srcDir, f)
      const segs = await parseFile(fullPath)
      console.log(`    ✔ ${f}: ${segs.length} segments`)
      all = [...all, ...segs]
    } catch (e) {
      console.error(`    ❌ ${f}: 解析失敗 - ${e}`)
    }
  }
  
  console.log(`  ✅ 合計: ${all.length} segments\n`)
  return all
}

// サブメニュー
export async function runParserMenu(rl: Interface): Promise<void> {
  console.log('\n┌──────────────────────────────────────────┐')
  console.log('│ Parser                                   │')
  console.log('│ 入力: ' + PATHS.srcDir.padEnd(34) + ' │')
  console.log('│ 出力: ' + PATHS.outDir.padEnd(34) + ' │')
  console.log('├──────────────────────────────────────────┤')
  console.log('│ 1. パースして JSON 出力                  │')
  console.log('│ 2. パースして CSV 出力                   │')
  console.log('│ 3. パースして両方出力                    │')
  console.log('│ 0. 戻る                                  │')
  console.log('└──────────────────────────────────────────┘')

  const choice = await rl.question('選択 (0-3): ')

  if (choice === '0') return

  const segments = await runParseAll()
  if (segments.length === 0) return

  ensureOutDir()

  if (choice === '1' || choice === '3') {
    const outPath = path.join(PATHS.outDir, 'parsed.json')
    saveAsJson(segments, outPath)
    console.log(`  💾 JSON 保存: ${outPath}`)
  }

  if (choice === '2' || choice === '3') {
    const outPath = path.join(PATHS.outDir, 'parsed.csv')
    saveAsCsv(segments, outPath)
    console.log(`  💾 CSV 保存: ${outPath}`)
  }

  if (!['1', '2', '3'].includes(choice)) {
    console.log('  無効な選択です')
  }
}
