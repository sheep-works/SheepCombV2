/**
 * test/constants.ts
 * Centralized test path configurations.
 */
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

export const PATHS = {
  /** Root test directory */
  testDir: resolve(ROOT, 'test'),

  /** Source data for tests (references cli/data/src) */
  sampleSrcDir: resolve(ROOT, 'cli/data/src'),

  /** Sample ShWvData JSON for shuttle tests */
  sampleInputJson: resolve(ROOT, 'cli/data/input.json'),

  /** Output directory for test results */
  testOutDir: resolve(ROOT, 'test/out'),
}

/** Supported extensions for bulk parsing tests */
export const SUPPORTED_EXTS = ['xlf', 'xliff', 'mxliff', 'mqxliff', 'sdlxliff', 'tmx', 'xlsx', 'docx']
