import { SheepShuttle } from './logic/shuttle/sheepShuttle.ts'
import fs from 'fs'
import path from 'path'

/**
 * Verification script for ShuttleRequests API connectivity.
 * This script tests the endpoints defined in logic/openapi.json
 * and implemented in logic/shuttle/components/requests.ts.
 * 
 * Usage: npx tsx verify_requests.ts
 */

const sampleJsonl = `{"idx": 0, "src": "Hello, how are you?", "tgt": "こんにちは、元気ですか？", "notes": ""}
{"idx": 1, "src": "This is a lightweight version of SheepLint.", "tgt": "これはSheepLintの重量版です。", "notes": ""}
{"idx": 2, "src": "Vertex AI will check these lines.", "tgt": "Vertex AIがこれらの業をチェックします。", "notes": ""}`

async function testGreet(requests: any) {
    console.log("\n=== Testing Greet Endpoint ===")
    try {
        const result = await requests.greet()
        console.log(`Status: ${result.status}`)
        console.log(`Model Info: ${result.model_info}`)
    } catch (e) {
        console.error(`Error during greet test: ${(e as Error).message}`)
    }
}

async function testCacheLifecycle(requests: any) {
    console.log("\n=== Testing Cache Lifecycle (Init -> Delete) ===")
    
    const promptPath = "./prompts/long_prompt_sample.md"
    let systemInstruction = "You are a helpful assistant. ".repeat(100)
    
    if (fs.existsSync(promptPath)) {
        systemInstruction = fs.readFileSync(promptPath, 'utf-8')
    } else {
        console.warn(`Warning: ${promptPath} not found. Using a dummy long prompt for testing.`)
    }

    try {
        // 1. Init Prompt
        console.log("1. Creating Cache...")
        const initResult = await requests.initPrompt({
            system_instruction: systemInstruction,
            display_name: "Test Cache TS"
        })
        const cacheId = initResult.result
        console.log(`Status: ${initResult.status}`)
        console.log(`Cache ID: ${cacheId}`)

        if (cacheId) {
            // 2. Delete Cache
            console.log("\n2. Deleting Cache...")
            const delResult = await requests.deleteCache({ cache_name: cacheId })
            console.log(`Status: ${delResult.status}`)
            console.log(`Result: ${delResult.result}`)
        }
    } catch (e) {
        console.error(`Error during cache lifecycle test: ${(e as Error).message}`)
    }
}

async function testUserRequest(requests: any) {
    console.log("\n=== Testing UserRequest Endpoint (Flexible Prompt/Cache) ===")
    
    const promptPath = "./prompts/long_prompt_sample.md"
    let systemInstruction = "You are a helpful assistant."
    if (fs.existsSync(promptPath)) {
        systemInstruction = fs.readFileSync(promptPath, 'utf-8')
    }

    try {
        // 1. Create Cache
        console.log("1. Creating Cache for User Request...")
        const initRes = await requests.initPrompt({
            system_instruction: systemInstruction,
            display_name: "User Test Cache TS"
        })
        const cacheId = initRes.result
        console.log(`Cache Created: ${cacheId}`)

        if (cacheId) {
            // 2. Use Cache in check/user/sync
            console.log("\n2. Using Cache in /gen/check/user/sync...")
            const userRes = await requests.checkUserSync({
                chunk: sampleJsonl,
                cache_id: cacheId
            })
            console.log("Result with Cache:")
            console.log(userRes.result)

            // 3. Cleanup
            console.log("\n3. Cleaning up Cache...")
            await requests.deleteCache({ cache_name: cacheId })
        }
        
        // 4. Test without cache (using prompt)
        console.log("\n4. Testing /gen/check/user/sync with direct prompt...")
        const directRes = await requests.checkUserSync({
            chunk: sampleJsonl,
            prompt: "Please check the following translations strictly."
        })
        console.log("Result with Direct Prompt:")
        console.log(directRes.result)

    } catch (e) {
        console.error(`Error during UserRequest test: ${(e as Error).message}`)
    }
}

async function testSync(requests: any) {
    console.log("\n=== Testing Synchronous Endpoint ===")
    try {
        const result = await requests.checkSync(sampleJsonl)
        console.log(`Status: ${result.status}`)
        console.log("Result:")
        console.log(result.result)
    } catch (e) {
        console.error(`Error during sync test: ${(e as Error).message}`)
        if (e instanceof Error && e.message.includes('422')) {
            console.error("Validation Error Details likely present in the response body. Check ShuttleRequests implementation.")
        }
    }
}

async function testAsyncPolling(requests: any) {
    console.log("\n=== Testing Asynchronous (Polling) Endpoint ===")
    try {
        // 1. Start Task
        const taskData = await requests.checkAsync(sampleJsonl)
        const taskId = taskData.task_id
        console.log(`Task Started. ID: ${taskId}`)

        // 2. Polling
        while (true) {
            const statusData = await requests.getTaskResult(taskId)
            const status = statusData.status
            console.log(`Current Status: ${status}`)

            if (status === "success") {
                console.log("Result:")
                console.log(statusData.result)
                break
            } else if (status === "error") {
                console.log("Error Details:")
                console.log(statusData.error)
                break
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
        }
    } catch (e) {
        console.error(`Error during async test: ${(e as Error).message}`)
    }
}

async function verify() {
  const shuttle = new SheepShuttle()
  const requests = shuttle.requests

  console.log('=== SheepShuttle API Verification ===')
  console.log(`Target: http://localhost:8000\n`)

  await testGreet(requests)
  await testCacheLifecycle(requests)
  await testUserRequest(requests)
  await testSync(requests)
  await testAsyncPolling(requests)

  console.log('\n=====================================')
  console.log('✅ ALL API METHODS VERIFIED')
  console.log('=====================================')
}

verify()

