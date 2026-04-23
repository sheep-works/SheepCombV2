import { describe, it, expect, beforeAll } from 'vitest'
import { SheepShuttle } from '../logic/shuttle/sheepShuttle.js'
import { DOMParser } from '@xmldom/xmldom'

describe('SheepShuttle Pipeline', () => {
  let shuttle: SheepShuttle

  beforeAll(() => {
    if (!(globalThis as any).DOMParser) {
      (globalThis as any).DOMParser = DOMParser
    }
    shuttle = new SheepShuttle()
  })

  it('should run the full pipeline from parsing to export', async () => {
    // 1. Parse
    const xliff = `
      <xliff version="1.2">
        <body>
          <trans-unit id="1">
            <source>Hello</source>
            <target>こんにちは</target>
          </trans-unit>
        </body>
      </xliff>
    `
    const parseResult = await shuttle.parser.parse([{ name: 'test.xlf', content: xliff }])
    expect(parseResult.units).toHaveLength(1)

    // 2. Process (Filter)
    const filteredUnits = shuttle.processor.filter(parseResult.units)
    expect(filteredUnits).toHaveLength(1)

    // 3. Convert (TranslationPair[] -> ShWvData)
    const shwvData = shuttle.converter.fromUnits(filteredUnits, parseResult.files)
    expect(shwvData.body.units).toHaveLength(1)
    expect(shwvData.meta.files[0].name).toBe('test.xlf')

    // 4. Analyze (Mocking WASM)
    const mockWasmAnalyzeAll = () => [{ t: [], i: [], g: [] }]
    await shuttle.analyzer.analyze(shwvData, [], [], mockWasmAnalyzeAll as any)
    // Check if analysis cleared refs
    expect(shwvData.body.units[0].ref.tms).toEqual([])

    // 5. Manager (Export)
    const exportedJson = shuttle.manager.exportToJson(shwvData)
    expect(exportedJson).toHaveLength(1)
    expect(exportedJson[0].src).toBe('Hello')

    // 6. Builder (Rebuild XLIFF)
    const rebuiltXliff = await shuttle.builder.build(xliff, shwvData)
    expect(rebuiltXliff).toContain('<target state="translated">こんにちは</target>')
  })
})
