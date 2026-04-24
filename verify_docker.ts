/**
 * verify_docker.ts
 * Docker / Cloud Run 環境に向けた SheepHub API の検証スクリプト。
 * 接続確認と Vertex AI への基本疎通（greet）のみを実行します。
 * 
 * 実行方法: npx tsx verify_docker.ts
 */
import { SheepShuttle } from './logic/shuttle/sheepShuttle.ts'
import fs from 'fs'
import path from 'path'

// .env ファイルから設定を読み込む簡易関数
function getEnvConfig() {
  const envPath = path.resolve(process.cwd(), '.env')
  const config = {
    baseUrl: 'http://localhost',
    port: '8080'
  }

  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
    for (const line of lines) {
      if (line.startsWith('NUXT_PUBLIC_API_BASE_URL=')) {
        config.baseUrl = line.split('=')[1].trim()
      }
      if (line.startsWith('NUXT_PUBLIC_API_PORT=')) {
        config.port = line.split('=')[1].trim()
      }
    }
  }
  return config
}

async function verify() {
  const config = getEnvConfig()
  
  console.log('🚀 Starting Docker API Verification...')
  console.log(`📡 Target API: ${config.baseUrl}:${config.port}`)
  console.log('-------------------------------------\n')

  const shuttle = new SheepShuttle({
    baseUrl: config.baseUrl,
    port: config.port
  })

  // 1. 接続確認 (verify_connection)
  console.log('Step 1: Checking Connection...')
  try {
    const isConnected = await shuttle.requests.verifyConnection()
    if (isConnected) {
      console.log('✅ Connection Successful (HTTP 200 OK)')
    } else {
      console.log('❌ Connection Failed (Is Docker container running?)')
      return
    }
  } catch (e: any) {
    console.error(`❌ Connection Error: ${e.message}`)
    return
  }

  // 2. Vertex AI 疎通確認 (greet)
  console.log('\nStep 2: Checking Vertex AI Connectivity (Greet)...')
  try {
    const greetResult = await shuttle.requests.greet()
    console.log(`✅ Greet Successful!`)
    console.log(`   Status: ${greetResult.status}`)
    if (greetResult.model_info) {
      console.log(`   Model Info: ${greetResult.model_info}`)
    }
  } catch (e: any) {
    console.error(`❌ Greet Failed (Vertex AI Auth or Config error?)`)
    console.error(`   Error: ${e.message}`)
  }

  console.log('\n-------------------------------------')
  console.log('🏁 Verification Finished')
}

verify()
