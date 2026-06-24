import { describe, it, expect, beforeAll } from 'vitest'
import { SheepShuttle } from '@sheep-family/core'
import { ShuttleRequests } from '../packages/core/src/shuttle/components/requests.js'
import path from 'path'
import fs from 'fs'

describe('ShuttleRequests Integration Test', () => {
  let shuttle: SheepShuttle
  let apiKey = ''

  beforeAll(() => {
    shuttle = new SheepShuttle()
    // Load .env manually if present
    const envPath = path.resolve(__dirname, '../.env')
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8')
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim()
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '')
          process.env[key] = val
        }
      }
    }
    apiKey = process.env.API_KEY_SHEEP || '71TMRzhzwQSvITAd01PKWVlRfI4zSLa21cdpj_RWu4c'
  })

  it('Ollama connection and basic generation', async () => {
    const requests = new ShuttleRequests(shuttle, {
      provider: 'ollama',
      ollamaUrl: 'http://localhost:11434',
      honoxUrl: 'http://localhost:8000',
      honoxApiKey: apiKey
    })

    const connected = await requests.verifyConnection()
    console.log('Ollama connected:', connected)
    if (connected) {
      const models = await requests.getModels()
      console.log('Ollama models:', models)
      expect(models.length).toBeGreaterThan(0)

      // Use the first model
      requests.updateOptions({ ollamaModel: models[0] })

      const chunk = JSON.stringify([{ idx: 0, src: 'Hello', tgt: 'こんにちは' }])
      const res = await requests.checkSync(chunk)
      console.log('Ollama check result:', res)
      expect(res.status).toBe('success')
      expect(res.result).toBeDefined()
    } else {
      console.log('Skipping Ollama test because server is offline.')
    }
  }, 60000)

  it('LM Studio connection and basic generation', async () => {
    const requests = new ShuttleRequests(shuttle, {
      provider: 'lmstudio',
      lmStudioUrl: 'http://127.0.0.1:1234',
      honoxUrl: 'http://localhost:8000',
      honoxApiKey: apiKey
    })

    const connected = await requests.verifyConnection()
    console.log('LM Studio connected:', connected)
    if (connected) {
      const models = await requests.getModels()
      console.log('LM Studio models:', models)
      expect(models.length).toBeGreaterThan(0)

      // Use the first model
      requests.updateOptions({ lmStudioModel: models[0] })

      const chunk = JSON.stringify([{ idx: 0, src: 'Hello', tgt: 'こんにちは' }])
      const res = await requests.checkSync(chunk)
      console.log('LM Studio check result:', res)
      expect(res.status).toBe('success')
      expect(res.result).toBeDefined()
    } else {
      console.log('Skipping LM Studio test because server is offline.')
    }
  }, 60000)

  it('Honox-Local connection and basic translation', async () => {
    const requests = new ShuttleRequests(shuttle, {
      provider: 'honox-local',
      honoxUrl: 'http://localhost:8000',
      honoxApiKey: apiKey
    })

    const connected = await requests.verifyConnection()
    console.log('Honox-Local connected:', connected)
    if (connected) {
      const chunk = JSON.stringify([{ idx: 0, src: 'Hello', tgt: '' }])
      const res = await requests.transSync(chunk)
      console.log('Honox-Local trans result:', res)
      expect(res.status).toBe('success')
      expect(res.result).toBeDefined()
    } else {
      console.log('Skipping Honox-Local test because server is offline.')
    }
  }, 10000)
})
