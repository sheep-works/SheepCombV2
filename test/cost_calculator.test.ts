import { describe, it, expect } from 'vitest'
import { CostCalculator } from '../packages/api/src/calculator.js'

describe('CostCalculator', () => {
  it('should calculate cost correctly with caching', () => {
    const calc = new CostCalculator(150)
    // model_cost_data: input $0.25/1M, output $1.5/1M
    const res = calc.calculate(10000, 2000, [0.25, 1.5], 5000)

    // actual_input_tokens = 10000 - 5000 = 5000
    // cost_usd = (5000/1,000,000 * 0.25) + (5000/1,000,000 * 0.25 * 0.2) + (2000/1,000,000 * 1.5)
    //          = 0.00125 + 0.00025 + 0.003 = 0.0045
    // cost_jpy = 0.0045 * 150 = 0.675
    expect(res.input_tokens).toBe(10000)
    expect(res.actual_input_tokens).toBe(5000)
    expect(res.cached_tokens).toBe(5000)
    expect(res.output_tokens).toBe(2000)
    expect(res.total_tokens).toBe(12000)
    expect(res.cost_usd).toBeCloseTo(0.0045, 6)
    expect(res.cost_jpy).toBeCloseTo(0.675, 4)
  })

  it('should accumulate total stats correctly', () => {
    const calc = new CostCalculator(150)
    calc.calculate(1000, 500, [0.25, 1.5])
    calc.calculate(2000, 1000, [0.25, 1.5], 500)

    expect(calc.total_requests).toBe(2)
    expect(calc.total_input_tokens).toBe(3000)
    expect(calc.total_output_tokens).toBe(1500)
    expect(calc.total_cached_tokens).toBe(500)
  })

  it('should format logs correctly', () => {
    const calc = new CostCalculator(150)
    const res = calc.calculate(10000, 2000, [0.25, 1.5], 5000)
    const log = calc.formatLog(res)
    expect(log).toContain('Total Tokens: 12000')
    expect(log).toContain('Input Tokens: 5000 + 5000 (cached)')
    expect(log).toContain('Output Tokens: 2000')

    const totalLog = calc.formatTotalLog()
    expect(totalLog).toContain('セッション合計 (1 リクエスト)')
    expect(totalLog).toContain('Input Tokens: 10000 (内のキャッシュ: 5000)')
  })
})

import { vi } from 'vitest'
import { VertexClient } from '../packages/api/src/vertex.js'

describe('VertexClient Provider Split & Mocks', () => {
  it('should trigger authorizeSheepMock and setLogToAirtableMock for vertex-sheep', async () => {
    const client = new VertexClient()

    // Mock getAiClient to bypass network calls
    const mockGenerateContent = vi.fn().mockResolvedValue({
      text: 'mock response text',
      usageMetadata: {
        promptTokenCount: 1000,
        candidatesTokenCount: 500,
        cachedContentTokenCount: 200
      }
    })

    ;(client as any).getAiClient = () => ({
      models: {
        generateContent: mockGenerateContent
      }
    })

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const result = await client.processChunk('system prompt', 'chunk data', 'vertex-sheep')

    expect(result).toBe('mock response text')
    
    // Check that mock functions were called and printed their logs
    const loggedTexts = consoleLogSpy.mock.calls.map(args => args[0] as string)
    expect(loggedTexts.some(t => t.includes('[Mock Auth] authorizeSheepMock called.'))).toBe(true)
    expect(loggedTexts.some(t => t.includes('[Mock Log] setLogToAirtableMock called.'))).toBe(true)

    consoleLogSpy.mockRestore()
  })
})
