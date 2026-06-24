import { describe, it, expect, beforeAll } from 'vitest'
import { SheepShuttle } from '@sheep-family/core'
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
    const exportedJson = shuttle.manager.getPairs(shwvData.body.units)
    expect(exportedJson).toHaveLength(1)
    expect(exportedJson[0].src).toBe('Hello')

    // 6. Builder (Rebuild XLIFF)
    const rebuiltXliff = await shuttle.builder.build(xliff, shwvData)
    expect(rebuiltXliff).toContain('<target state="translated">こんにちは</target>')
  })

  it('should sample units proportional to file character lengths', async () => {
    const localShuttle = new SheepShuttle()
    
    // Set up dummy units and files
    // File 1 has total 20 characters
    // File 2 has total 80 characters
    // Combined total = 100 characters
    // If we request sampledTotal = 50:
    // File 1 target = 10 characters
    // File 2 target = 40 characters
    localShuttle.units = [
      { idx: 0, src: '1234567890', tgt: '' }, // 10 chars
      { idx: 1, src: '1234567890', tgt: '' }, // 10 chars
      { idx: 2, src: '12345678901234567890', tgt: '' }, // 20 chars
      { idx: 3, src: '12345678901234567890', tgt: '' }, // 20 chars
      { idx: 4, src: '12345678901234567890', tgt: '' }, // 20 chars
      { idx: 5, src: '12345678901234567890', tgt: '' }  // 20 chars
    ]
    localShuttle.files = [
      { name: 'file1.xlf', start: 0, end: 1 }, // 20 chars total
      { name: 'file2.xlf', start: 2, end: 5 }  // 80 chars total
    ]

    const sampled = localShuttle.sampling(50)
    expect(sampled.length).toBeGreaterThan(0)
    expect(localShuttle.units).toBe(sampled)

    for (const unit of sampled as any[]) {
      expect(unit.striped).toBeDefined()
      expect(unit.lenWoTags).toBeDefined()
      expect(unit.lenWoTags).toBe(unit.striped.length)
      expect(unit.file).toBeDefined()
      if (unit.idx <= 1) {
        expect(unit.file).toBe('file1.xlf')
      } else {
        expect(unit.file).toBe('file2.xlf')
      }
    }
  })

  it('should strip both standard and escaped tags in striped and lenWoTags', () => {
    const localShuttle = new SheepShuttle()
    localShuttle.units = [
      { idx: 0, src: 'Hello <tag>world</tag>!', tgt: '' },
      { idx: 1, src: 'Hello &lt;tag&gt;world&lt;/tag&gt;!', tgt: '' }
    ]
    localShuttle.files = [
      { name: 'tags.xlf', start: 0, end: 1 }
    ]

    const sampled = localShuttle.sampling(100)
    expect(sampled).toHaveLength(2)
    
    // Both should strip tags down to 'Hello world!' which is 12 characters
    expect((sampled[0] as any).striped).toBe('Hello world!')
    expect((sampled[0] as any).lenWoTags).toBe(12)
    expect((sampled[0] as any).file).toBe('tags.xlf')
    
    expect((sampled[1] as any).striped).toBe('Hello world!')
    expect((sampled[1] as any).lenWoTags).toBe(12)
    expect((sampled[1] as any).file).toBe('tags.xlf')
  })

  it('should include file column in getCsv when units contain file attribute', () => {
    const localShuttle = new SheepShuttle<any>()
    localShuttle.units = [
      { idx: 0, src: 'Hello', tgt: 'こんにちは', note: 'greetings', file: 'test1.xlf' }
    ]
    
    const csv = localShuttle.getCsv()
    expect(csv).toContain('idx,src,tgt,note,file')
    expect(csv).toContain('"0","Hello","こんにちは","greetings","test1.xlf"')
  })

  it('should not include file column in getCsv when units do not contain file attribute', () => {
    const localShuttle = new SheepShuttle()
    localShuttle.units = [
      { idx: 0, src: 'Hello', tgt: 'こんにちは', note: 'greetings' }
    ]
    
    const csv = localShuttle.getCsv()
    expect(csv).toContain('idx,src,tgt,note')
    expect(csv).not.toContain('file')
    expect(csv).toContain('"0","Hello","こんにちは","greetings"')
  })

  it('should auto-cache system prompts when prompt length is greater than 3000 characters', async () => {
    const localShuttle = new SheepShuttle()
    localShuttle.chunks = [
      { chunkId: 0, data: 'dummy-data', status: 'pending', response: '' }
    ]

    let initPromptCalled = false

    // Mock request calls
    localShuttle.requests.getProvider = () => 'fastapi'
    localShuttle.requests.initPrompt = async (params) => {
      initPromptCalled = true
      expect(params.system_instruction).toHaveLength(3005)
      return { status: 'success', result: 'mock-cache-id' }
    }
    localShuttle.requests.checkUserAsync = async (params) => {
      expect(params.prompt).toBeUndefined()
      expect(params.cache_id).toBe('mock-cache-id')
      return { task_id: 'mock-task-id', status: 'pending' }
    }
    localShuttle.requests.getTaskResult = async () => {
      return { status: 'success', result: 'mock-result' }
    }

    // Create a 3005-character prompt
    const longPrompt = 'a'.repeat(3005)
    await localShuttle.processRequests(0, 'CHECK', longPrompt)

    expect(initPromptCalled).toBe(true)
    expect(localShuttle.requests.cacheName).toBe('mock-cache-id')
    expect(localShuttle.requests.cachedPromptText).toBe(longPrompt)
  }, 15000)
})
