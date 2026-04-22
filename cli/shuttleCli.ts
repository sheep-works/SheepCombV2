/**
 * cli/shuttleCli.ts
 * SheepShuttle サブメニュー
 */
import { Interface } from 'node:readline/promises'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { ShuttleAdapter as SheepShuttle } from './shuttle.js'
import { PATHS } from './config.js'
import { analyzeProject } from './api.js'

function ensureOutDir() {
  if (!fs.existsSync(PATHS.outDir)) {
    fs.mkdirSync(PATHS.outDir, { recursive: true })
  }
}

function loadShwvData(): any | null {
  if (!fs.existsSync(PATHS.shwvInput)) {
    console.log(`\n  ⚠ ShWvData ファイルが見つかりません: ${PATHS.shwvInput}`)
    return null
  }
  try {
    const raw = fs.readFileSync(PATHS.shwvInput, 'utf-8')
    return JSON.parse(raw)
  } catch (e) {
    console.log(`  読み込みエラー: ${e}`)
    return null
  }
}

export async function runShuttleMenu(rl: Interface): Promise<void> {
  console.log('\n┌──────────────────────────────────────────┐')
  console.log('│ SheepShuttle                             │')
  console.log('│ 入力: ' + PATHS.shwvInput.padEnd(34) + ' │')
  console.log('│ 出力: ' + PATHS.outDir.padEnd(34) + ' │')
  console.log('├──────────────────────────────────────────┤')
  console.log('│ ─ エクスポート ───────────────────────── │')
  console.log('│ 1. exportToJson   (src/tgt ペア)         │')
  console.log('│ 2. exportToCsv    (src/tgt ペア)         │')
  console.log('│ 3. exportAsTm     (TM: src/tgt)          │')
  console.log('│ 4. exportAsTb     (TB: terms)            │')
  console.log('│ 5. exportAsTmTb   (TM + TB 両方)         │')
  console.log('│ ─ 分割 ───────────────────────────────── │')
  console.log('│ 6. splitByFile    (ファイル単位)         │')
  console.log('│ 7. splitByLength  (文字数単位)           │')
  console.log('│ 8. mergeFiles     (out/split/ を統合)    │')
  console.log('│ ─ JSONL ──────────────────────────────── │')
  console.log('│ 9. exportToJsonl  (JSONL 出力)           │')
  console.log('│ 10. chunkJsonl    (分割 JSONL 出力)      │')
  console.log('│ 11. updateFromJsonl (JSONL で更新)       │')
  console.log('│ ─ 高度な操作 ─────────────────────────── │')
  console.log('│ 12. analyze       (TM/TB マッピング)     │')
  console.log('│ 0.  戻る                                 │')
  console.log('└──────────────────────────────────────────┘')

  const choice = await rl.question('選択 (0-12): ')

  if (choice === '0') {
    return
  }

  if (choice === '12') {
    const data = loadShwvData()
    if (!data) return

    const rootPath = await rl.question('  プロジェクトルート (default: current): ') || process.cwd()
    const legacy = (await rl.question('  レガシー方式を使用しますか？ (y/N): ')).toLowerCase() === 'y'
    
    console.log('  ⌛ 解析中...')
    try {
      await analyzeProject(data, rootPath, legacy)
      const outPath = path.join(PATHS.outDir, 'analyzed.json')
      fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8')
      console.log(`  💾 解析済み ShWvData 保存: ${outPath}`)
    } catch (e: any) {
      console.log(`  ❌ 解析エラー: ${e.message}`)
    }
    return
  }

  if (choice === '8') {
    ensureOutDir()
    const splitDir = path.join(PATHS.outDir, 'split')
    const mergedPath = path.join(PATHS.outDir, 'merged.json')
    if (!fs.existsSync(splitDir)) {
      console.log(`  ⚠ ${splitDir} が存在しません。先に 6 または 7 を実行してください`)
      return
    }
    SheepShuttle.mergeFiles(splitDir, mergedPath)
    console.log(`  💾 保存: ${mergedPath}`)
    return
  }

  if (choice === '11') {
    const data = loadShwvData()
    if (!data) return

    const jsonlPath = path.join(PATHS.outDir, 'update_src.jsonl')
    if (!fs.existsSync(jsonlPath)) {
      console.log(`  ⚠ ${jsonlPath} が存在しません。先に 9 または 10 を実行してください`)
      return
    }
    SheepShuttle.updateFromJsonl(data, jsonlPath)
    const outPath = path.join(PATHS.outDir, 'updated.json')
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8')
    console.log(`  💾 更新済み ShWvData 保存: ${outPath}`)
    return
  }

  const data = loadShwvData()
  if (!data) return

  ensureOutDir()

  switch (choice) {
    case '1': {
      const out = path.join(PATHS.outDir, 'export.json')
      SheepShuttle.exportToJson(data, out)
      console.log(`  💾 保存: ${out}`)
      break
    }
    case '2': {
      const out = path.join(PATHS.outDir, 'export.csv')
      SheepShuttle.exportToCsv(data, out)
      console.log(`  💾 保存: ${out}`)
      break
    }
    case '3': {
      const out = path.join(PATHS.outDir, 'export_tm.json')
      SheepShuttle.exportAsTm(data, out)
      console.log(`  💾 保存: ${out}`)
      break
    }
    case '4': {
      const out = path.join(PATHS.outDir, 'export_tb.json')
      SheepShuttle.exportAsTb(data, out)
      console.log(`  💾 保存: ${out}`)
      break
    }
    case '5': {
      const tmOut = path.join(PATHS.outDir, 'export_tm.json')
      const tbOut = path.join(PATHS.outDir, 'export_tb.json')
      SheepShuttle.exportAsTmTb(data, tmOut, tbOut)
      console.log(`  💾 TM 保存: ${tmOut}`)
      console.log(`  💾 TB 保存: ${tbOut}`)
      break
    }
    case '6': {
      const splitDir = path.join(PATHS.outDir, 'split')
      SheepShuttle.splitByFile(data, splitDir)
      console.log(`  💾 ファイル単位の分割: ${splitDir}`)
      break
    }
    case '7': {
      const raw = await rl.question('  1行あたりの最大文字数 (default: 2000): ')
      const maxLen = raw ? parseInt(raw, 10) : 2000
      const splitDir = path.join(PATHS.outDir, 'split')
      SheepShuttle.splitByLength(data, maxLen, splitDir)
      console.log(`  💾 文字数分割 (${maxLen}): ${splitDir}`)
      break
    }
    case '9': {
      const out = path.join(PATHS.outDir, 'export.jsonl')
      SheepShuttle.exportToJsonl(data, out)
      console.log(`  💾 保存: ${out}`)
      break
    }
    case '10': {
      const raw = await rl.question('  1行あたりの最大文字数 (default: 2000): ')
      const maxLen = raw ? parseInt(raw, 10) : 2000
      const chunkJsonl = SheepShuttle.chunkJsonl(data, maxLen)
      const out = path.join(PATHS.outDir, 'chunked.jsonl')
      fs.writeFileSync(out, chunkJsonl, 'utf-8')
      console.log(`  💾 保存: ${out}`)
      break
    }
    default:
      console.log('  無効な選択です')
  }
}
