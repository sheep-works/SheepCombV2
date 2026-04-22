import { describe, it, expect, vi } from 'vitest'
import * as fs from 'node:fs'
import { parseFile } from '../cli/api.js'

vi.mock('node:fs')

describe('CLI: API (api.ts)', () => {
  it('should route to XLIFF parser for .xlf extensions', async () => {
    // Mock fs.existsSync and fs.readFileSync
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('<xliff><trans-unit id="1"><source>Src</source></trans-unit></xliff>')

    const segments = await parseFile('dummy.xlf')
    expect(segments).toHaveLength(1)
    expect(segments[0].src).toBe('Src')
  })

  it('should throw error if file not found', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    await expect(parseFile('missing.xlf')).rejects.toThrow('File not found')
  })
})
