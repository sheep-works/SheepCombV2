import { describe, it, expect, beforeAll } from 'vitest'
import { parseXliff } from '../logic/shuttle/components/subparser/xliffParser.js'
import { parseJson } from '../logic/shuttle/components/subparser/jsonParser.js'
import { DOMParser } from '@xmldom/xmldom'

describe('Subparsers (Direct)', () => {
  beforeAll(() => {
    if (!(globalThis as any).DOMParser) {
      (globalThis as any).DOMParser = DOMParser
    }
  })

  it('should parse XLIFF using xliffParser', async () => {
    const xliff = `
      <xliff version="1.2">
        <body>
          <trans-unit id="1">
            <source>Direct</source>
            <target>直接</target>
          </trans-unit>
        </body>
      </xliff>
    `
    const units = await parseXliff(xliff, 0)
    expect(units).toHaveLength(1)
    expect(units[0].src).toBe('Direct')
  })

  it('should parse JSON using jsonParser', async () => {
    const json = JSON.stringify([{ src: 'JSON', tgt: 'ジェイソン' }])
    const units = await parseJson(json, 10)
    expect(units).toHaveLength(1)
    expect(units[0].idx).toBe(10)
    expect(units[0].src).toBe('JSON')
  })
})
