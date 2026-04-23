/**
 * test/constants.ts
 * Centralized test path configurations.
 */
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const USE_DIR = 'test_data'

export const PATHS = {
  /** Root test directory */
  testDir: resolve(ROOT, USE_DIR),

  /** Source data for tests (references cli/data/src) */
  sampleSrcDir: resolve(ROOT, 'cli/data/src'),

  /** Sample ShWvData JSON for shuttle tests */
  sampleInputJson: resolve(ROOT, 'cli/data/input.json'),

  /** Output directory for test results */
  testOutDir: resolve(ROOT, `${USE_DIR}/out`),

  /** Actual sample files for parsing tests */
  testSamplesDir: resolve(ROOT, `${USE_DIR}/samples`),

  /** Actual TM files for parsing tests */
  testTMsDir: resolve(ROOT, `${USE_DIR}/tm`),

  /** Actual TB files for parsing tests */
  testTBsDir: resolve(ROOT, `${USE_DIR}/tb`),
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
