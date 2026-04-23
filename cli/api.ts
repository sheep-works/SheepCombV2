/**
 * cli/api.ts
 * Node.js 環境 (CLI, VS Code 拡張など) で共通利用するためのプログラム用 API
 */
import * as fs from 'node:fs'
import { DOMParser } from '@xmldom/xmldom'
import * as path from 'node:path'
import { SheepShuttle } from '../logic/shuttle/sheepShuttle.js'
import type { ShWvData, TranslationPair } from '../logic/types/shwv.js'

import { fileURLToPath } from 'node:url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Node.js 環境に DOMParser をグローバル設定します。
 * API 呼び出し時に自動的に実行されます。
 */
function ensureShim() {
  if (!(globalThis as any).DOMParser) {
    (globalThis as any).DOMParser = DOMParser
  }
}

/**
 * ファイルパスを指定して、対応するパーサーで解析したセグメントを返します。
 * サポート拡張子: .xlf, .xliff, .mxliff, .mqxliff, .sdlxliff, .tmx, .xlsx, .docx
 * 
 * @param filePath 対象のファイルパス
 * @returns 解析されたセグメントの配列
 */
export async function parseFile(filePath: string): Promise<TranslationPair[]> {
  ensureShim()
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }

  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  
  const content = (['xlsx', 'docx'].includes(ext))
    ? fs.readFileSync(filePath)
    : fs.readFileSync(filePath, 'utf-8')

  const shuttle = new SheepShuttle()
  const result = await shuttle.parser.parse([{ name: path.basename(filePath), content }])
  return result.units
}

/**
 * 複数ファイルを一括で解析し、ShWvData 形式を返します。
 */
export async function parseFiles(filePaths: string[]) {
  const files = filePaths.map(p => ({
    name: path.basename(p),
    content: (['xlsx', 'docx'].includes(path.extname(p).slice(1).toLowerCase()))
      ? fs.readFileSync(p)
      : fs.readFileSync(p, 'utf-8')
  }))
  const shuttle = new SheepShuttle()
  const result = await shuttle.parser.parse(files)
  const filtered = shuttle.processor.filter(result.units)
  return shuttle.converter.fromUnits(filtered, result.files)
}

/**
 * 指定されたプロジェクトルートの Working/01_REF/ 内の TM/TB を使用して、
 * ShWvData を解析（TM/TBマッピング）します。
 */
export async function analyzeProject(
  data: ShWvData, 
  projectRoot: string, 
  legacy: boolean = false
): Promise<void> {
  ensureShim()

  const tmDir = path.join(projectRoot, 'Working', '01_REF', 'TM')
  const tbDir = path.join(projectRoot, 'Working', '01_REF', 'TB')

  let memories: any[] = []
  let termbase: any[] = []

  // Load TM
  if (fs.existsSync(tmDir)) {
    const tmFiles = fs.readdirSync(tmDir)
      .filter(f => fs.statSync(path.join(tmDir, f)).isFile())
      .map(f => path.join(tmDir, f))
    
    if (tmFiles.length > 0) {
      const parsedTm = await parseFiles(tmFiles)
      memories = parsedTm.body.units.map((u, i) => {
        const info = parsedTm.meta.files.find(f => i >= f.start && i <= f.end)
        return { idx: -1, src: u.src, tgt: u.tgt || u.pre || '', freeze: true, file: info?.name }
      })
    }
  }

  // Load TB
  if (fs.existsSync(tbDir)) {
    const tbFiles = fs.readdirSync(tbDir)
      .filter(f => fs.statSync(path.join(tbDir, f)).isFile())
      .map(f => path.join(tbDir, f))
    
    if (tbFiles.length > 0) {
      const parsedTb = await parseFiles(tbFiles)
      termbase = parsedTb.body.units.map((u, i) => {
        const info = parsedTb.meta.files.find(f => i >= f.start && i <= f.end)
        return { ...u, file: info?.name }
      })
    }
  }

  // Node 環境の WASM (sheep-spindle) をロード
  // logic/shuttle/wasm/ から直接読み込み
  const wasmPath = path.resolve(__dirname, '../logic/shuttle/wasm/sheep_spindle.js')
  // Note: createRequire is needed if in pure ESM, but here we assume 'require' is available or using a shim
  const { createRequire } = await import('node:module')
  const require = createRequire(import.meta.url)
  const { analyze_all } = require(wasmPath)
  
  const shuttle = new SheepShuttle()
  await shuttle.analyzer.analyze(data, memories, termbase, analyze_all, legacy)
}

/**
 * 解析結果を JSON ファイルとして保存します。
 */
export function saveAsJson(segments: TranslationPair[], outputPath: string): void {
  fs.writeFileSync(outputPath, JSON.stringify(segments, null, 2), 'utf-8')
}

/**
 * 解析結果を CSV ファイルとして保存します（Excel 用 BOM 付き）。
 */
export function saveAsCsv(segments: TranslationPair[], outputPath: string): void {
  const header = 'src,tgt,note'
  const rows = segments.map(s => {
    const src = `"${(s.src ?? '').replace(/"/g, '""')}"`
    const tgt = `"${(s.tgt ?? '').replace(/"/g, '""')}"`
    const note = `"${((s.note as string) ?? '').replace(/"/g, '""')}"`
    return `${src},${tgt},${note}`
  })
  
  fs.writeFileSync(outputPath, '\uFEFF' + [header, ...rows].join('\n'), 'utf-8')
}
