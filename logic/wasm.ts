// @ts-ignore
import init, * as wasm from '../web/public/pkg-web/sheep_spindle.js'
// @ts-ignore
import wasmUrl from '../web/public/pkg-web/sheep_spindle_bg.wasm?url'

let initialized = false

export async function initWasm() {
  if (initialized) return wasm
  try {
    await init(wasmUrl)
    initialized = true
    console.log('WASM Initialized successfully')
    return wasm
  } catch (e) {
    console.error('WASM Initialization failed:', e)
    throw e
  }
}

export function getWasm() {
  if (!initialized) throw new Error('WASM not initialized. Call initWasm() first.')
  return wasm
}

export function isWasmReady() {
  return initialized
}
