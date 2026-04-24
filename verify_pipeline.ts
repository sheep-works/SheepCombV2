import * as fs from 'node:fs'
import * as path from 'node:path'
import { DOMParser } from '@xmldom/xmldom'
import { SheepShuttle } from './logic/shuttle/sheepShuttle.js'
import { PATHS, SUPPORTED_EXTS } from './test/constants.js'
import { analyze_all } from './logic/pkg/sheep_spindle.js'

/**
 * verify_pipeline.ts
 * SheepShuttle の全工程（パイプライン）を実行し、出力を目視確認するためのスクリプト。
 * Vitest などのテストランナーは使用しません。
 */

async function run() {
  console.log('--- Starting Pipeline Verification ---')

  // 0. 出力ファイルにある古いファイルを削除
  if (fs.existsSync(PATHS.testOutDir)) {
    fs.rmSync(PATHS.testOutDir, { recursive: true, force: true })
  }

  // 1. 環境作成
  if (!(globalThis as any).DOMParser) {
    (globalThis as any).DOMParser = DOMParser
  }

  const outDir = PATHS.testOutDir
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  const shuttle = new SheepShuttle()

  // ディレクトリからファイルを読み込むためのヘルパー関数
  const loadFilesFromDir = (dirPath: string) => {
    if (!fs.existsSync(dirPath)) return []
    return fs.readdirSync(dirPath)
      .filter(f => SUPPORTED_EXTS.includes(f.split('.').pop()?.toLowerCase() || ''))
      .map(f => {
        const filePath = path.join(dirPath, f)
        const isBinary = ['xlsx', 'docx'].includes(f.split('.').pop()?.toLowerCase() || '')
        return {
          name: f,
          content: isBinary ? fs.readFileSync(filePath) : fs.readFileSync(filePath, 'utf-8')
        }
      })
  }

  // 2. サンプルファイルの読み込み
  console.log(`Scanning samples: ${PATHS.testSamplesDir}`)
  const allFiles = loadFilesFromDir(PATHS.testSamplesDir)
  if (allFiles.length === 0) {
    console.error('No supported sample files found.')
    return
  }
  console.log(`Loading ${allFiles.length} sample files...`)

  // 2b. TM/TB ファイルの読み込み
  console.log('Loading TM/TB files...')
  const tmFiles = loadFilesFromDir(PATHS.testTMsDir)
  const tbFiles = loadFilesFromDir(PATHS.testTBsDir)

  if (tmFiles.length > 0) {
    console.log(`  Adding ${tmFiles.length} TM files...`)
    await shuttle.addTms(tmFiles)
  }
  if (tbFiles.length > 0) {
    console.log(`  Adding ${tbFiles.length} TB files...`)
    await shuttle.addTbs(tbFiles)
  }
  // console.log(shuttle.tms)
  console.log(shuttle.tbs)

  // 3. ステップ: パース (解析)
  console.log('Step 1: Parsing Samples...')
  await shuttle.parse(allFiles)
  console.log(`  Parsed ${shuttle.units.length} total units.`)

  // ステップ1の結果を保存 (JSON)
  const parseOutPath = path.join(outDir, 'step1_parse_result.json')
  fs.writeFileSync(parseOutPath, JSON.stringify(shuttle.units, null, 2), 'utf-8')
  console.log(`Saved Step 1 result (JSON) to: ${parseOutPath}`)

  // ステップ1の結果を保存 (CSV)
  const csvOutPath = path.join(outDir, 'step1_parse_result.csv')
  fs.writeFileSync(csvOutPath, shuttle.getCsv(','), 'utf-8')
  console.log(`Saved Step 1 result (CSV) to: ${csvOutPath}`)

  // ステップ1の結果を保存 (TSV)
  const tsvOutPath = path.join(outDir, 'step1_parse_result.tsv')
  fs.writeFileSync(tsvOutPath, shuttle.getCsv('\t'), 'utf-8')
  console.log(`Saved Step 1 result (TSV) to: ${tsvOutPath}`)

  // 4. ステップ: プロセス (フィルタリング)
  console.log('Step 2: Processing (Filter)...')
  shuttle.process()

  // 5. ステップ: 変換 (TranslationPair[] -> ShWvData)
  console.log('Step 3: Converting to ShWvData...')
  shuttle.convert()

  // 6. ステップ: 分析 (WASM使用)
  console.log('Step 4: Analyzing (WASM)...')
  // logic/pkg の Node.js 用 WASM 関数を使用して解析を実行
  await shuttle.analyze(analyze_all)

  // 7. 中間データの保存
  const dataOutPath = path.join(outDir, 'pipeline_shwv.json')
  fs.writeFileSync(dataOutPath, shuttle.getShwvJson(), 'utf-8')
  console.log(`Saved ShWvData to: ${dataOutPath}`)

  // 8. ステップ: ビルド (最初に見つかった XML 形式ファイルのリビルド)
  console.log('Step 5: Building (Reconstructing XLIFF)...')
  const xmlFile = allFiles.find(f => typeof f.content === 'string')
  if (xmlFile) {
    const rebuiltXml = await shuttle.build(xmlFile.content as string)
    const xmlOutPath = path.join(outDir, `pipeline_rebuilt_${xmlFile.name}`)
    fs.writeFileSync(xmlOutPath, rebuiltXml, 'utf-8')
    console.log(`Saved Rebuilt File to: ${xmlOutPath}`)
  } else {
    console.log('  No XML file found to test reconstruction.')
  }

  console.log('--- Verification Complete ---')

  // 9. ステップ: エクスポート Manage 経由で処理する (JSONL)
  console.log('Step 6: Exporting (JSONL)...')
  const jsonlPath = path.join(outDir, 'step6_export.jsonl')
  fs.writeFileSync(jsonlPath, shuttle.getManagedData('JSONL'), 'utf-8')
  console.log(`Saved JSONL to: ${jsonlPath}`)

  // 10. ステップ: エクスポート (JSONL Chunks)
  console.log('Step 7: Exporting (JSONL Chunks)...')
  const jsonlChunksContent = shuttle.getManagedData('JSONL_CHUNKED', 4000)
  const jsonlChunks = jsonlChunksContent.split('\n').filter(line => line.trim().length > 0)
  jsonlChunks.forEach((chunk, index) => {
    const chunkPath = path.join(outDir, `step7_export_chunk_${index + 1}.jsonl`)
    fs.writeFileSync(chunkPath, chunk, 'utf-8')
    console.log(`Saved JSONL Chunk ${index + 1} to: ${chunkPath}`)
  })

  // 11. ステップ: API 連携テスト (processRequests)
  console.log('\nStep 8: API Integration Test (processRequests)...')
  console.log('  Creating chunks from units...')
  shuttle.createChunks('units', 4000)
  console.log(`  Created ${shuttle.chunks.length} chunks.`)

  if (shuttle.chunks.length > 0) {
    console.log('  Processing first chunk (async/polling)...')
    try {
      await shuttle.processRequests(0, 'CHECK')
      const firstChunk = shuttle.chunks[0]!
      console.log(`  Chunk 0 Status: ${firstChunk.status}`)
      if (firstChunk.status === 'success') {
        console.log('  Chunk 0 Response (first 300 chars):')
        console.log(firstChunk.response.substring(0, 300) + (firstChunk.response.length > 300 ? '...' : ''))
      } else {
        console.error('  Chunk 0 Failed:', firstChunk.response)
      }

      // 保存
      const chunksOutPath = path.join(outDir, 'step8_chunks_result.json')
      fs.writeFileSync(chunksOutPath, JSON.stringify(shuttle.chunks, null, 2), 'utf-8')
      console.log(`\nSaved Step 8 chunks result to: ${chunksOutPath}`)
    } catch (e) {
      console.error('  Error during processRequests:', (e as Error).message)
    }
  }

  console.log('\n--- Final Verification Complete ---')
}

run().catch(err => {
  console.error('Pipeline Verification Failed:', err)
  process.exit(1)
})
