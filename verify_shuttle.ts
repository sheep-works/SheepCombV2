import * as fs from 'node:fs'
import * as path from 'node:path'
import { ShuttleAdapter } from './cli/shuttle.ts'

const inputPath = 'cli/data/input.json'
const outDir = 'cli/data/out'

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}

const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'))
const outPath = path.join(outDir, 'test_export.json')
ShuttleAdapter.exportToJson(data, outPath)

if (fs.existsSync(outPath)) {
  console.log('Verification Success: Output file created at ' + outPath)
} else {
  console.error('Verification Failed: Output file not created')
}
