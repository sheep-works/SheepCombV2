import { describe, it, expect, vi, beforeAll } from 'vitest'
import * as fs from 'node:fs'
import { parseFile } from '../cli/api.js'
import { DOMParser } from '@xmldom/xmldom'

vi.mock('node:fs')

describe('CLI: API (api.ts)', () => {
  beforeAll(() => {
    // Ensure DOMParser is available globally for the parser logic called within api.ts
    if (!(globalThis as any).DOMParser) {
      (globalThis as any).DOMParser = DOMParser
    }
  })

  it('should parse XLIFF file through cli/api', async () => {
    // Mock fs.existsSync and fs.readFileSync
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('<xliff version="1.2"><body><trans-unit id="1"><source>Src</source><target>Tgt</target></trans-unit></body></xliff>')

    const units = await parseFile('dummy.xlf')
    expect(units).toHaveLength(1)
    expect(units[0].src).toBe('Src')
    expect(units[0].tgt).toBe('Tgt')
  })

  it('should throw error if file not found', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    await expect(parseFile('missing.xlf')).rejects.toThrow('File not found')
  })
})
