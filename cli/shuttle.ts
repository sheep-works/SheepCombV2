/**
 * cli/shuttle.ts
 * Node.js (ESM) で使えるよう SheepShuttle を再実装したアダプター。
 * CLI 用にファイルシステム (fs) とのやり取りを担当します。
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { SheepShuttle } from '../logic/shuttle/sheepShuttle.js'
import type { ShWvData } from '../logic/types/shwv.js'

export class ShuttleAdapter {
  /**
   * 複数のファイルパスを受け取り、解析して ShWvData を生成します。
   */
  static async fromFiles(filepaths: string[]): Promise<ShWvData> {
    const files = filepaths.map(fp => {
      const ext = path.extname(fp).toLowerCase()
      const isBinary = ['.xlsx', '.docx'].includes(ext)
      const content = isBinary ? fs.readFileSync(fp) : fs.readFileSync(fp, 'utf-8')
      return {
        name: path.basename(fp),
        content
      }
    })
    return SheepShuttle.fromFiles(files)
  }

  static exportToJson(data: ShWvData, outputPath: string): void {
    const pairs = SheepShuttle.getPairs(data.body.units)
    fs.writeFileSync(outputPath, JSON.stringify(pairs, null, 2), 'utf-8')
  }

  static exportToCsv(data: ShWvData, outputPath: string): void {
    const pairs = SheepShuttle.getPairs(data.body.units)
    const csv = SheepShuttle.formatCsv(pairs)
    // Excel on Windows expects BOM for UTF-8 CSV
    fs.writeFileSync(outputPath, '\uFEFF' + csv, 'utf-8')
  }

  static exportAsTm(data: ShWvData, outputPath: string): void {
    const tm = SheepShuttle.getPairs(data.body.units)
    fs.writeFileSync(outputPath, JSON.stringify(tm, null, 2), 'utf-8')
  }

  static exportAsTb(data: ShWvData, outputPath: string): void {
    const tb = data.body.terms || []
    fs.writeFileSync(outputPath, JSON.stringify(tb, null, 2), 'utf-8')
  }

  static exportAsTmTb(data: ShWvData, tmPath: string, tbPath: string): void {
    this.exportAsTm(data, tmPath)
    this.exportAsTb(data, tbPath)
  }

  static splitByFile(data: ShWvData, outDir: string): void {
    fs.mkdirSync(outDir, { recursive: true })
    const fileMap = SheepShuttle.splitByFile(data)
    for (const [filename, pairs] of fileMap.entries()) {
      fs.writeFileSync(path.join(outDir, filename), JSON.stringify(pairs, null, 2), 'utf-8')
    }
  }

  static splitByLength(data: ShWvData, maxLength: number, outDir: string): void {
    fs.mkdirSync(outDir, { recursive: true })
    const chunks = SheepShuttle.splitByLength(data.body.units, maxLength)
    
    chunks.forEach((chunk, idx) => {
      const filename = `chunk_${String(idx).padStart(3, '0')}.json`
      fs.writeFileSync(path.join(outDir, filename), JSON.stringify(chunk, null, 2), 'utf-8')
    })
  }

  static mergeFiles(inputDir: string, outputFile: string): void {
    const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.json')).sort()
    const merged: unknown[] = []
    for (const f of files) {
      try {
        const parsed = JSON.parse(fs.readFileSync(path.join(inputDir, f), 'utf-8'))
        if (Array.isArray(parsed)) merged.push(...parsed)
      } catch { /* skip */ }
    }
    fs.writeFileSync(outputFile, JSON.stringify(merged, null, 2), 'utf-8')
  }

  static exportToJsonl(data: ShWvData, outputPath: string): string {
    const content = SheepShuttle.getJsonlContent(data.body.units)
    fs.writeFileSync(outputPath, content, 'utf-8')
    return content
  }

  static chunkJsonl(data: ShWvData, maxCharsPerLine: number): string {
    return SheepShuttle.getChunkedJsonlContent(data.body.units, maxCharsPerLine)
  }

  static updateFromJsonl(data: ShWvData, jsonlPath: string): void {
    if (!fs.existsSync(jsonlPath)) return
    const jsonlContent = fs.readFileSync(jsonlPath, 'utf-8')
    const updatedUnits = SheepShuttle.getUpdatedUnits(data.body.units, jsonlContent)
    data.body.units = updatedUnits
  }
}
