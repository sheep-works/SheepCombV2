/**
 * cli/index.ts
 * SheepCombWeb CLI エントリポイント
 *
 * 使用方法:
 *   npm run cli
 *
 * 2段階メニュー:
 *   1段階目: parser / sheepshuttle
 *   2段階目: 各機能
 */
import { createInterface, Interface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { DOMParser } from '@xmldom/xmldom'

  // Shim DOMParser globally for shared logic
  ; (globalThis as any).DOMParser = DOMParser

import { runParserMenu } from './parserCli.js'
import { runShuttleMenu } from './shuttleCli.js'
import { PATHS } from './config.js'

const rl: Interface = createInterface({ input, output })

function printBanner() {
  console.log('')
  console.log('╔══════════════════════════════════════════╗')
  console.log('║      SheepCombWeb CLI                    ║')
  console.log('╠══════════════════════════════════════════╣')
  console.log('║ データディレクトリ:                      ║')
  console.log(`║  src   : ${PATHS.srcDir.slice(-30).padEnd(30)}  ║`)
  console.log(`║  input : ${PATHS.shwvInput.slice(-26).padEnd(26)}      ║`)
  console.log(`║  out   : ${PATHS.outDir.slice(-30).padEnd(30)}  ║`)
  console.log('╠══════════════════════════════════════════╣')
  console.log('║ ツールを選択してください                  ║')
  console.log('║                                          ║')
  console.log('║  1. Parser       (ファイル解析)          ║')
  console.log('║  2. SheepShuttle (ShWvData 変換)         ║')
  console.log('║  0. 終了                                 ║')
  console.log('║                                          ║')
  console.log('╚══════════════════════════════════════════╝')
}

async function main() {
  printBanner()

  const choice = await rl.question('選択 (0-2): ')

  switch (choice.trim()) {
    case '1':
      await runParserMenu(rl)
      break
    case '2':
      await runShuttleMenu(rl)
      break
    case '0':
      console.log('\n  Bye!\n')
      break
    default:
      console.log('\n  無効な選択です。0-2 で入力してください\n')
      break
  }
  rl.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
