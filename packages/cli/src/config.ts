/**
 * cli/config.ts
 * 決め打ちファイルパスの定義
 */
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// cli/ ディレクトリ基準で data/ を解決
const DATA_DIR = resolve(__dirname, 'data')

export const PATHS = {
  /** Parser: 入力ファイルを置くディレクトリ (xliff/tmx/xlsx/docx) */
  srcDir: resolve(DATA_DIR, 'src'),

  /** SheepShuttle: 入力 ShWvData JSON */
  shwvInput: resolve(DATA_DIR, 'input.json'),

  /** 全出力用ディレクトリ */
  outDir: resolve(DATA_DIR, 'out'),
}

/** src/ 内のサポート拡張子 */
export const SUPPORTED_EXTS = ['xlf', 'xliff', 'mxliff', 'mqxliff', 'sdlxliff', 'tmx', 'xlsx', 'docx']
