import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    alias: {
      '@sheep-family/core/node-wasm': path.resolve(__dirname, './packages/core/src/pkg/sheep_spindle.js'),
      '@sheep-family/core/wasm': path.resolve(__dirname, './packages/core/src/wasm.ts'),
      '@sheep-family/core': path.resolve(__dirname, './packages/core/src/index.ts'),
      '@sheep-family/types': path.resolve(__dirname, './packages/types/src/index.ts'),
      '~': path.resolve(__dirname, './packages/web'),
      '@': path.resolve(__dirname, './packages/web'),
    },
  },
})
