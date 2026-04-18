import init, * as wasm from './pkg-web/sheep_spindle.js';

let initialized = false;

export async function initWasm() {
  if (initialized) return wasm;
  try {
    await init('/pkg-web/sheep_spindle_bg.wasm');
    initialized = true;
    console.log('WASM Initialized successfully');
    return wasm;
  } catch (e) {
    console.error('WASM Initialization failed:', e);
    throw e;
  }
}

export function getWasm() {
  if (!initialized) throw new Error('WASM not initialized. Call initWasm() first.');
  return wasm;
}
