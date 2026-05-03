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
    baseUrl: 'https://sheephub-1093803567884.asia-northeast1.run.app',
    apiKey: ''
  }

  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
    for (const line of lines) {
      if (line.startsWith('NUXT_PUBLIC_API_BASE_URL=')) {
        config.baseUrl = line.split('=')[1].trim()
      }
      if (line.startsWith('NUXT_PUBLIC_API_KEY=')) {
        config.apiKey = line.split('=')[1].trim()
      }
    }
  }
  return config
}

async function verify() {
  const config = getEnvConfig()

  // コマンドライン引数から --dev フラグを確認
  const isDev = process.argv.includes('--dev')
  // .env または環境変数から API キーを取得
  const apiKey = config.apiKey || process.env.NUXT_PUBLIC_API_KEY || ''

  console.log('🚀 Starting Docker API Verification...')
  if (isDev) {
    console.log('🛠️  Running in DEV mode (Localhost 8080)')
  }
  console.log(`📡 Target API: ${isDev ? 'http://localhost:8080' : config.baseUrl}`)
  console.log('-------------------------------------\n')

  const shuttle = new SheepShuttle({
    baseUrl: config.baseUrl,
    apiKey: apiKey,
    isDev: isDev
  })

  // 1a. 接続確認 (認証なし)
  console.log('Step 1a: Checking Connection (WITHOUT API Key)...')
  const shuttleNoAuth = new SheepShuttle({ baseUrl: config.baseUrl, isDev, apiKey: '' })
  try {
    const isConnected = await shuttleNoAuth.requests.verifyConnection()
    if (isConnected) {
      console.log('⚠️  Connection Successful without API Key. (Is security disabled?)')
    } else {
      console.log('✅ Connection Refused without API Key. (Good, security is working)')
    }
  } catch (e: any) {
    console.log(`✅ Connection Error without API Key: ${e.message} (Security might be working)`)
  }

  // 1b. 接続確認 (認証あり)
  console.log('\nStep 1b: Checking Connection (WITH API Key)...')
  try {
    const isConnected = await shuttle.requests.verifyConnection()
    if (isConnected) {
      console.log('✅ Connection Successful with API Key.')
    } else {
      console.log('❌ Connection Failed even with API Key. (Check your NUXT_PUBLIC_API_KEY)')
      return
    }
  } catch (e: any) {
    console.error(`❌ Connection Error: ${e.message}`)
    return
  }

  // 2. Vertex AI 疎通確認 (greet - 認証あり)
  console.log('\nStep 2: Checking Vertex AI Connectivity (Greet - WITH API Key)...')
  try {
    const greetResult = await shuttle.requests.greet()
    console.log(`✅ Greet Successful!`)
    console.log(`   Status: ${greetResult.status}`)
    if (greetResult.model_info) {
      console.log(`   Model Info: ${greetResult.model_info}`)
    }
  } catch (e: any) {
    console.error(`❌ Greet Failed (Auth or Config error?)`)
    console.error(`   Error: ${e.message}`)
  }

  console.log('\n-------------------------------------')
  console.log('🏁 Verification Finished')
}

verify()
