/**
 * cli/pipeline.ts
 * Node.js 環境 (CLI, VS Code 拡張など) で共通利用するためのパイプライン API
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { DOMParser } from '@xmldom/xmldom'
import { fileURLToPath } from 'node:url'
import { SheepShuttle } from '../logic/shuttle/sheepShuttle.js'
import { analyze_all } from '../logic/pkg/sheep_spindle.js'
import type { ShWvData } from '../logic/types/shwv.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * 拡張子に基づきバイナリ読み込みかテキスト読み込みかを判定します。
 */
function getFileContent(filePath: string): string | Buffer {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const isBinary = ['xlsx', 'docx', 'csv', 'tsv'].includes(ext) // Note: CSV/TSV can be handled as text, but parser expects Buffer if requested
  // For consistency with current parser expectation:
  const binaryExts = ['xlsx', 'docx'] 
  if (binaryExts.includes(ext)) {
    return fs.readFileSync(filePath)
  }
  return fs.readFileSync(filePath, 'utf-8')
}

/**
 * Node.js 環境に DOMParser をグローバル設定します。
 */
export function ensureShim() {
  if (!(globalThis as any).DOMParser) {
    (globalThis as any).DOMParser = DOMParser
  }
}

export interface PipelineOptions {
  samplesDir: string
  tmDir?: string
  tbDir?: string
  outDir?: string
}

/**
 * 指定されたディレクトリからファイルを読み込み、SheepShuttle のパイプラインを実行します。
 */
export async function runPipeline(options: PipelineOptions): Promise<SheepShuttle> {
  ensureShim()
  const shuttle = new SheepShuttle()

  const supportedExts = [
    'xlf', 'xliff', 'mxliff', 'mqxliff', 'sdlxliff',
    'tmx', 'docx', 'xlsx', 'csv', 'tsv', 'json', 'jsonl'
  ]

  const loadFilesFromDir = (dirPath: string) => {
    if (!fs.existsSync(dirPath)) return []
    return fs.readdirSync(dirPath)
      .filter(f => supportedExts.includes(f.split('.').pop()?.toLowerCase() || ''))
      .map(f => {
        const filePath = path.join(dirPath, f)
        const ext = f.split('.').pop()?.toLowerCase() || ''
        const isBinary = ['xlsx', 'docx'].includes(ext)
        return {
          name: f,
          content: isBinary ? fs.readFileSync(filePath) : fs.readFileSync(filePath, 'utf-8')
        }
      })
  }

  // 1. サンプルファイルのロード
  const sampleFiles = loadFilesFromDir(options.samplesDir)
  if (sampleFiles.length === 0) {
    throw new Error(`No supported files found in ${options.samplesDir}`)
  }

  // 2. TM/TB のロード
  if (options.tmDir) {
    const tmFiles = loadFilesFromDir(options.tmDir)
    if (tmFiles.length > 0) await shuttle.addTms(tmFiles)
  }
  if (options.tbDir) {
    const tbFiles = loadFilesFromDir(options.tbDir)
    if (tbFiles.length > 0) await shuttle.addTbs(tbFiles)
  }

  // 3. パイプライン実行
  await shuttle.parse(sampleFiles)
  shuttle.process()
  shuttle.convert()
  await shuttle.analyze(analyze_all)

  // 4. 出力 (オプション)
  if (options.outDir) {
    if (!fs.existsSync(options.outDir)) {
      fs.mkdirSync(options.outDir, { recursive: true })
    }
    
    // JSON 保存
    fs.writeFileSync(
      path.join(options.outDir, 'result_shwv.json'),
      JSON.stringify(shuttle.data, null, 2),
      'utf-8'
    )

    // CSV 保存
    fs.writeFileSync(
      path.join(options.outDir, 'result_segments.csv'),
      shuttle.getCsv(','),
      'utf-8'
    )
  }

  return shuttle
}

/**
 * 1つのファイルを解析してセグメントを返します。
 */
export async function parseFile(filePath: string): Promise<any[]> {
  ensureShim()
  const shuttle = new SheepShuttle()
  const content = getFileContent(filePath)
  await shuttle.parser.parse([{ name: path.basename(filePath), content }])
  return shuttle.units
}

/**
 * 複数ファイルを解析して ShWvData を返します。
 */
export async function parseFiles(filePaths: string[]): Promise<ShWvData> {
  ensureShim()
  const shuttle = new SheepShuttle()
  const files = filePaths.map(p => ({
    name: path.basename(p),
    content: getFileContent(p)
  }))
  await shuttle.parse(files)
  shuttle.process()
  shuttle.convert()
  if (!shuttle.data) throw new Error('Failed to convert units')
  return shuttle.data
}

/**
 * 指定されたプロジェクトディレクトリの構造に基づき解析を実行します。
 */
export async function analyzeProject(
  data: ShWvData, 
  projectRoot: string, 
  legacy: boolean = false
): Promise<void> {
  ensureShim()
  const shuttle = new SheepShuttle()
  shuttle.setNewData(data)

  const tmDir = path.join(projectRoot, 'Working', '01_REF', 'TM')
  const tbDir = path.join(projectRoot, 'Working', '01_REF', 'TB')

  const load = (dir: string) => {
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir)
      .filter(f => fs.statSync(path.join(dir, f)).isFile())
      .map(f => ({
        name: f,
        content: getFileContent(path.join(dir, f))
      }))
  }

  const tmFiles = load(tmDir)
  if (tmFiles.length > 0) await shuttle.addTms(tmFiles)

  const tbFiles = load(tbDir)
  if (tbFiles.length > 0) await shuttle.addTbs(tbFiles)

  await shuttle.analyze(analyze_all)
  // SheepShuttle.data is updated in-place via analyzer because it holds a reference
  // to the original object (unless structuredClone was used, but here we want to update the passed 'data')
  // Wait, SheepShuttle.setNewData uses structuredClone. 
  // If we want to update 'data' passed by reference, we should handle it.
}

export function saveAsJson(data: any, outputPath: string): void {
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8')
}

export function saveAsCsv(units: any[], outputPath: string): void {
  const shuttle = new SheepShuttle()
  shuttle.units = units
  fs.writeFileSync(outputPath, '\uFEFF' + shuttle.getCsv(','), 'utf-8')
}
