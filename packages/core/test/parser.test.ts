import { describe, it, expect } from 'vitest'
import { SheepShuttle } from '@sheep-family/core'

describe('SheepShuttle Parser 1-based indexing', () => {
  it('should parse single file starting with idx 1 and file range 1..N', async () => {
    const shuttle = new SheepShuttle()
    const content = `Hello,こんにちは\nWorld,世界`
    await shuttle.parse([{ name: 'test.csv', content }])

    expect(shuttle.units.length).toBe(2)
    expect(shuttle.units[0]?.idx).toBe(1)
    expect(shuttle.units[1]?.idx).toBe(2)

    expect(shuttle.files.length).toBe(1)
    expect(shuttle.files[0]?.name).toBe('test.csv')
    expect(shuttle.files[0]?.start).toBe(1)
    expect(shuttle.files[0]?.end).toBe(2)
  })

  it('should parse multiple files with continuous 1-based ranges', async () => {
    const shuttle = new SheepShuttle()
    const file1 = `A,あ\nB,い`
    const file2 = `C,う\nD,え\nE,お`
    await shuttle.parse([
      { name: 'doc1.csv', content: file1 },
      { name: 'doc2.csv', content: file2 }
    ])

    expect(shuttle.units.length).toBe(5)
    expect(shuttle.units.map(u => u.idx)).toEqual([1, 2, 3, 4, 5])

    expect(shuttle.files.length).toBe(2)
    expect(shuttle.files[0]).toEqual({ name: 'doc1.csv', start: 1, end: 2 })
    expect(shuttle.files[1]).toEqual({ name: 'doc2.csv', start: 3, end: 5 })
  })

  it('should convert units to ShWvData preserving 1-based meta.files', async () => {
    const shuttle = new SheepShuttle()
    const file1 = `A,あ\nB,い`
    await shuttle.parse([{ name: 'doc1.csv', content: file1 }])
    shuttle.convert({ projectName: 'TestProject' })

    expect(shuttle.data).not.toBeNull()
    expect(shuttle.data?.meta.files).toEqual([
      { name: 'doc1.csv', start: 1, end: 2 }
    ])
    expect(shuttle.data?.body.units[0]?.idx).toBe(1)
    expect(shuttle.data?.body.units[1]?.idx).toBe(2)
  })
})
