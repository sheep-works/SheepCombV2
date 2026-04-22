import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    alias: {
      '~': path.resolve(__dirname, './web'),
      '@': path.resolve(__dirname, './web'),
      '~~': path.resolve(__dirname, './'),
    },
  },
})
