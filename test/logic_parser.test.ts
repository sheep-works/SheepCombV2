import { describe, it, expect } from 'vitest'
import { parseXliff } from '../logic/simple/parsers.js'

describe('Logic: Simple Parsers', () => {
  it('should parse XLIFF content (basic)', () => {
    const xliff = `
      <xliff version="1.2">
        <file original="test.txt" source-language="en" target-language="ja" datatype="plaintext">
          <body>
            <trans-unit id="1">
              <source>Hello</source>
              <target>こんにちは</target>
            </trans-unit>
          </body>
        </file>
      </xliff>
    `
    const segments = parseXliff(xliff)
    expect(segments).toHaveLength(1)
    expect(segments[0].src).toBe('Hello')
    expect(segments[0].tgt).toBe('こんにちは')
  })

  it('should handle empty XLIFF', () => {
    const xliff = '<xliff></xliff>'
    const segments = parseXliff(xliff)
    expect(segments).toHaveLength(0)
  })
})
