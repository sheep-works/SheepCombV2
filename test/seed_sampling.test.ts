import { describe, it, expect, beforeAll } from 'vitest'
import { SheepShuttle } from '../logic/shuttle/sheepShuttle.js'
import { DOMParser } from '@xmldom/xmldom'

describe('Seed-based Sampling', () => {
  let shuttle: SheepShuttle

  beforeAll(() => {
    if (!(globalThis as any).DOMParser) {
      (globalThis as any).DOMParser = DOMParser
    }
    shuttle = new SheepShuttle()
  })

  it('should sample units deterministically when a seed is provided', async () => {
    // Create 10 distinct units
    const units = Array.from({ length: 10 }, (_, i) => ({
      idx: i,
      src: `Source sentence number ${i}`,
      tgt: `Target translation number ${i}`,
    }))

    shuttle.units = [...units]
    shuttle.files = [{ name: 'test.xlf', start: 0, end: 9 }]

    // Run sampling with seed = 42
    const sampled1 = shuttle.sampling(50, 42)

    // Verify first row is SEED_VAL metadata
    expect(sampled1[0].src).toBe('SEED_VAL')
    expect(sampled1[0].tgt).toBe('42')
    expect(sampled1[0].note).toBe('DO NOT EDIT')

    // Run again on a new shuttle instance with same seed = 42
    const shuttle2 = new SheepShuttle()
    shuttle2.units = [...units]
    shuttle2.files = [{ name: 'test.xlf', start: 0, end: 9 }]
    const sampled2 = shuttle2.sampling(50, 42)

    // Check that both results are identical
    expect(sampled1.length).toBe(sampled2.length)
    for (let i = 0; i < sampled1.length; i++) {
      expect(sampled1[i].src).toBe(sampled2[i].src)
      expect(sampled1[i].tgt).toBe(sampled2[i].tgt)
    }

    // Run with a different seed = 99
    const shuttle3 = new SheepShuttle()
    shuttle3.units = [...units]
    shuttle3.files = [{ name: 'test.xlf', start: 0, end: 9 }]
    const sampled3 = shuttle3.sampling(50, 99)

    // Verify first row seed is 99
    expect(sampled3[0].tgt).toBe('99')

    // Verify different seeds produce different order/selection of samples
    const values1 = sampled1.slice(1).map(u => u.src)
    const values3 = sampled3.slice(1).map(u => u.src)
    expect(values1).not.toEqual(values3)
  })
})
