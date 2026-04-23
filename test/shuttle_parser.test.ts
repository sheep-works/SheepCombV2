import { describe, it, expect, beforeAll } from 'vitest'
import { SheepShuttle } from '../logic/shuttle/sheepShuttle.js'
import { DOMParser } from '@xmldom/xmldom'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { PATHS } from './constants.js'

describe('ShuttleParser', () => {
  let shuttle: SheepShuttle

  beforeAll(() => {
    // Ensure DOMParser is available globally for the parser
    if (!(globalThis as any).DOMParser) {
      (globalThis as any).DOMParser = DOMParser
    }
    shuttle = new SheepShuttle()
  })

  it('should parse XLIFF content using ShuttleParser', async () => {
    const xliff = `
      <xliff version="1.2">
        <file original="test.xlf" source-language="en" target-language="ja" datatype="plaintext">
          <body>
            <trans-unit id="1">
              <source>Hello</source>
              <target>こんにちは</target>
            </trans-unit>
            <trans-unit id="2">
              <source>World</source>
              <target>世界</target>
            </trans-unit>
          </body>
        </file>
      </xliff>
    `
    const files = [{ name: 'test.xlf', content: xliff }]
    const result = await shuttle.parser.parse(files)

    expect(result.units).toHaveLength(2)
    expect(result.units[0].src).toBe('Hello')
    expect(result.units[0].tgt).toBe('こんにちは')
    expect(result.files).toHaveLength(1)
    expect(result.files[0].name).toBe('test.xlf')
  })

  it('should handle multi-line splitting (isSub) in XLIFF', async () => {
    const xliff = `
      <xliff version="1.2">
        <file original="multiline.xlf" source-language="en" target-language="ja" datatype="plaintext">
          <body>
            <trans-unit id="1">
              <source>Line 1\nLine 2</source>
              <target>行 1\n行 2</target>
            </trans-unit>
          </body>
        </file>
      </xliff>
    `
    const files = [{ name: 'multiline.xlf', content: xliff }]
    const result = await shuttle.parser.parse(files)

    // Current XliffParser logic splits by \n and sets isSub
    expect(result.units).toHaveLength(2)
    expect(result.units[0].src).toBe('Line 1')
    expect(result.units[0].isSub).toBe(true)
    expect(result.units[1].src).toBe('Line 2')
    expect(result.units[1].isSub).toBeUndefined() // last part is not sub
  })

  it('should parse JSON content', async () => {
    const json = JSON.stringify([
      { src: 'Apple', tgt: 'りんご' },
      { src: 'Banana', tgt: 'バナナ' }
    ])
    const files = [{ name: 'test.json', content: json }]
    const result = await shuttle.parser.parse(files)

    expect(result.units).toHaveLength(2)
    expect(result.units[0].src).toBe('Apple')
    expect(result.units[0].tgt).toBe('りんご')
  })

  describe('File-based Parsing Tests', () => {
    it('should parse sample.mxliff from test/samples', async () => {
      const filePath = path.join(PATHS.testSamplesDir, 'sample.mxliff')
      if (!fs.existsSync(filePath)) return // skip if file not found

      const content = fs.readFileSync(filePath, 'utf-8')
      const result = await shuttle.parser.parse([{ name: 'sample.mxliff', content }])

      expect(result.units.length).toBeGreaterThan(0)
      // Check for a specific known unit from the file if possible
      const unit = result.units.find(u => u.src.includes('Today, I explained'))
      expect(unit).toBeDefined()
      expect(unit?.tgt).toContain('今日、いくつかのキーワード')
    })

    it('should parse docx samples from test/samples', async () => {
      const docxFiles = ['memoq_word.docx', 'xbench_word.docx']
      
      for (const fileName of docxFiles) {
        const filePath = path.join(PATHS.testSamplesDir, fileName)
        if (!fs.existsSync(filePath)) continue

        const content = fs.readFileSync(filePath) // as Buffer
        const result = await shuttle.parser.parse([{ name: fileName, content }])

        expect(result.units.length).toBeGreaterThan(0)
        console.log(`Parsed ${fileName}: ${result.units.length} units`)
      }
    })
  })
})
