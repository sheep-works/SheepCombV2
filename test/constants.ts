/**
 * test/constants.ts
 * Centralized test path configurations.
 */
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const USE_DIR = 'samples'

export const PATHS = {
  /** Root test directory */
  testDir: resolve(ROOT, 'test'),

  /** Source data for tests (references cli/data/src) */
  sampleSrcDir: resolve(ROOT, 'cli/data/src'),

  /** Sample ShWvData JSON for shuttle tests */
  sampleInputJson: resolve(ROOT, 'cli/data/input.json'),

  /** Output directory for test results */
  testOutDir: resolve(ROOT, 'test/out'),

  /** Actual sample files for parsing tests */
  testSamplesDir: resolve(ROOT, `test/${USE_DIR}`),

  /** Actual TM files for parsing tests */
  testTMsDir: resolve(ROOT, `test/${USE_DIR}/tm`),

  /** Actual TB files for parsing tests */
  testTBsDir: resolve(ROOT, `test/${USE_DIR}/tb`),
}

/** Supported extensions for bulk parsing tests */
export const SUPPORTED_EXTS = [
  'xlf', 'xliff', 'mxliff', 'mqxliff', 'sdlxliff',
  'tmx',
  // 'tbx',
  'docx',
  'xlsx', 'csv', 'tsv',
  'json', 'jsonl',
]
