import { describe, it, expect } from 'vitest'
import {
  checkNumbers,
  checkTags,
  checkTerms,
  checkConsistency,
  checkUnmodifiedPe,
  checkUnit,
  checkAllUnits,
  checkShWvData,
  SheepShuttle,
} from '@sheep-family/core'
import type { ShWvData, ShWvUnit } from '@sheep-family/types'

describe('QA Checker', () => {
  describe('checkNumbers', () => {
    it('should return null when numbers match', () => {
      const unit: ShWvUnit = {
        idx: 1,
        src: 'There are 10 apples and 3.5 oranges.',
        tgt: '10個のりんごと3.5個のオレンジがあります。',
        pre: '',
        ref: { tms: [], tb: [], quoted: [], quoted100: [] },
      }
      expect(checkNumbers(unit)).toBeNull()
    })

    it('should return issue when number is missing in target', () => {
      const unit: ShWvUnit = {
        idx: 2,
        src: 'Error code: 404',
        tgt: 'エラーが発生しました',
        pre: '',
        ref: { tms: [], tb: [], quoted: [], quoted100: [] },
      }
      const issue = checkNumbers(unit)
      expect(issue).not.toBeNull()
      expect(issue?.issue_type).toBe('Number')
      expect(issue?.idx).toBe(2)
      expect(issue?.message).toContain('Missing in target: ["404"]')
    })

    it('should return issue when extra number exists in target', () => {
      const unit: ShWvUnit = {
        idx: 3,
        src: 'No numbers here',
        tgt: 'ここに123があります',
        pre: '',
        ref: { tms: [], tb: [], quoted: [], quoted100: [] },
      }
      const issue = checkNumbers(unit)
      expect(issue).not.toBeNull()
      expect(issue?.issue_type).toBe('Number')
      expect(issue?.message).toContain('Missing in source: ["123"]')
    })
  })

  describe('checkTags', () => {
    it('should return null when tags match', () => {
      const unit: ShWvUnit = {
        idx: 1,
        src: 'Click <b>here</b> or {0} or [link].',
        tgt: '<b>ここ</b> または {0} または [link] をクリック。',
        pre: '',
        ref: { tms: [], tb: [], quoted: [], quoted100: [] },
      }
      expect(checkTags(unit)).toBeNull()
    })

    it('should return issue when tag is missing in target', () => {
      const unit: ShWvUnit = {
        idx: 2,
        src: 'Please check <span class="highlight">this</span>.',
        tgt: 'これを確認してください。',
        pre: '',
        ref: { tms: [], tb: [], quoted: [], quoted100: [] },
      }
      const issue = checkTags(unit)
      expect(issue).not.toBeNull()
      expect(issue?.issue_type).toBe('Tag')
      expect(issue?.idx).toBe(2)
      expect(issue?.message).toContain('Missing in target')
    })

    it('should correctly handle placeholders without triggering false number issues', () => {
      const unit: ShWvUnit = {
        idx: 4,
        src: '2つの{@0}テーマ{@1}',
        tgt: '2个{@2}主题{@1}',
        pre: '',
        placeholders: {
          0: '<color>',
          1: '</color>',
          2: '<colour>',
        },
        ref: { tms: [], tb: [], quoted: [], quoted100: [] },
      }
      // 数字チェックは '2' だけなので一致（0や2のプレースホルダーインデックスを誤認しない）
      expect(checkNumbers(unit)).toBeNull()

      // タグチェックは元のタグ名で差異が検出される
      const tagIssue = checkTags(unit)
      expect(tagIssue).not.toBeNull()
      expect(tagIssue?.issue_type).toBe('Tag')
      expect(tagIssue?.message).toContain('Missing in target: ["<color>"]')
      expect(tagIssue?.message).toContain('Missing in source: ["<colour>"]')
    })
  })

  describe('checkTerms', () => {
    it('should return no issues when term is present', () => {
      const unit: ShWvUnit = {
        idx: 1,
        src: 'Open the settings menu.',
        tgt: '設定メニューを開きます。',
        pre: '',
        ref: {
          tms: [],
          tb: [
            {
              src: 'settings',
              tgts: ['設定', '環境設定'],
            },
          ],
          quoted: [],
          quoted100: [],
        },
      }
      expect(checkTerms(unit)).toHaveLength(0)
    })

    it('should return issue when term translation is missing', () => {
      const unit: ShWvUnit = {
        idx: 2,
        src: 'Open the settings menu.',
        tgt: 'オプションメニューを開きます。',
        pre: '',
        ref: {
          tms: [],
          tb: [
            {
              src: 'settings',
              tgts: ['設定', '環境設定'],
            },
          ],
          quoted: [],
          quoted100: [],
        },
      }
      const issues = checkTerms(unit)
      expect(issues).toHaveLength(1)
      expect(issues[0].issue_type).toBe('Term')
      expect(issues[0].message).toContain("Target term missing: '設定 / 環境設定'")
    })

    it('should return issue when forbidden term is used', () => {
      const unit: ShWvUnit = {
        idx: 3,
        src: 'Open the settings menu.',
        tgt: 'コンフィグメニューを開きます。',
        pre: '',
        ref: {
          tms: [],
          tb: [
            {
              src: 'settings',
              tgts: [],
              forbiddens: ['コンフィグ', 'セッティング'],
            },
          ],
          quoted: [],
          quoted100: [],
        },
      }
      const issues = checkTerms(unit)
      expect(issues).toHaveLength(1)
      expect(issues[0].issue_type).toBe('Term')
      expect(issues[0].message).toContain("Forbidden term used: 'コンフィグ' (Source: 'settings')")
    })
  })

  describe('checkConsistency', () => {
    it('should return no issues when translation matches quoted100 reference', () => {
      const unit1: ShWvUnit = {
        idx: 1,
        src: 'Cancel',
        tgt: 'キャンセル',
        pre: '',
        ref: { tms: [], tb: [], quoted: [], quoted100: [] },
      }
      const unit2: ShWvUnit = {
        idx: 2,
        src: 'Cancel',
        tgt: 'キャンセル',
        pre: '',
        ref: { tms: [], tb: [], quoted: [], quoted100: [1] },
      }
      const map = new Map([[1, unit1], [2, unit2]])
      expect(checkConsistency(unit2, map)).toHaveLength(0)
    })

    it('should return issue when translation is inconsistent with quoted100 reference', () => {
      const unit1: ShWvUnit = {
        idx: 1,
        src: 'Cancel',
        tgt: 'キャンセル',
        pre: '',
        ref: { tms: [], tb: [], quoted: [], quoted100: [] },
      }
      const unit2: ShWvUnit = {
        idx: 2,
        src: 'Cancel',
        tgt: '取り消し',
        pre: '',
        ref: { tms: [], tb: [], quoted: [], quoted100: [1] },
      }
      const map = new Map([[1, unit1], [2, unit2]])
      const issues = checkConsistency(unit2, map)
      expect(issues).toHaveLength(1)
      expect(issues[0].issue_type).toBe('Consistency')
      expect(issues[0].message).toContain('Inconsistent translation with segment 1')
    })
  })

  describe('checkUnmodifiedPe', () => {
    it('should detect issue when referenced segment was modified but current segment remains unmodified MT', () => {
      const unit1: ShWvUnit = {
        idx: 1,
        src: 'Submit the application form.',
        pre: '申請書を提出する。',
        tgt: '申込フォームを送信してください。', // modified
        ref: { tms: [], tb: [], quoted: [], quoted100: [] },
      }
      const unit2: ShWvUnit = {
        idx: 2,
        src: 'Submit the application form now.',
        pre: '今すぐ申請書を提出する。',
        tgt: '今すぐ申請書を提出する。', // unmodified (pre === tgt)
        ref: { tms: [], tb: [], quoted: [[1, 85]], quoted100: [] }, // quotes unit 1
      }
      const map = new Map([[1, unit1], [2, unit2]])
      const issues = checkUnmodifiedPe(unit2, map)
      expect(issues).toHaveLength(1)
      expect(issues[0].issue_type).toBe('UnmodifiedPe')
      expect(issues[0].idx).toBe(2)
      expect(issues[0].message).toContain('Referenced segment 1 was modified from pre-translation, but this segment remains unmodified')
    })

    it('should detect issue when current segment was modified but previous referenced segment remains unmodified MT', () => {
      const unit1: ShWvUnit = {
        idx: 1,
        src: 'Submit the application form.',
        pre: '申請書を提出する。',
        tgt: '申請書を提出する。', // unmodified
        ref: { tms: [], tb: [], quoted: [], quoted100: [] },
      }
      const unit2: ShWvUnit = {
        idx: 2,
        src: 'Submit the application form.',
        pre: '申請書を提出する。',
        tgt: '申込フォームを送信してください。', // modified
        ref: { tms: [], tb: [], quoted: [], quoted100: [1] },
      }
      const map = new Map([[1, unit1], [2, unit2]])
      const issues = checkUnmodifiedPe(unit2, map)
      expect(issues).toHaveLength(1)
      expect(issues[0].issue_type).toBe('UnmodifiedPe')
      expect(issues[0].idx).toBe(2)
      expect(issues[0].message).toContain('This segment was modified from pre-translation, but referenced segment 1 remains unmodified')
    })
  })

  describe('checkUnit & checkAllUnits & checkShWvData', () => {
    const sampleUnits: ShWvUnit[] = [
      {
        idx: 1,
        src: '100% accurate translation.',
        tgt: '100% 正確な翻訳。',
        pre: '',
        ref: { tms: [], tb: [], quoted: [], quoted100: [] },
      },
      {
        idx: 2,
        src: 'Error 500: Server error.',
        tgt: 'サーバーエラー。', // missing 500
        pre: '',
        ref: { tms: [], tb: [], quoted: [], quoted100: [] },
      },
      {
        idx: 3,
        src: 'Save file',
        tgt: 'ファイルを保存',
        pre: '',
        ref: {
          tms: [],
          tb: [{ src: 'Save', tgts: ['セーブ', '保存'] }],
          quoted: [],
          quoted100: [],
        },
      },
    ]

    it('should detect issues across all units', () => {
      const issues = checkAllUnits(sampleUnits)
      expect(issues).toHaveLength(1)
      expect(issues[0].idx).toBe(2)
      expect(issues[0].issue_type).toBe('Number')
    })

    it('should respect config toggles', () => {
      const issues = checkAllUnits(sampleUnits, { check_numbers: false })
      expect(issues).toHaveLength(0)
    })

    it('should work with checkShWvData and SheepShuttle.runQa', () => {
      const mockData: ShWvData = {
        define: { name: 'SHWV_DATA', version: '1.3' },
        meta: {
          bilingualPath: '',
          files: [{ name: 'test.txt', start: 1, end: 3 }],
          sourceLang: 'en',
          targetLang: 'ja',
        },
        body: {
          units: sampleUnits,
          terms: [],
        },
      }

      const issues = checkShWvData(mockData)
      expect(issues).toHaveLength(1)

      const shuttle = new SheepShuttle()
      shuttle.setNewData(mockData)
      expect(shuttle.runQa()).toEqual(issues)
    })
  })

  describe('ShWvData v1.5 (memo & forbiddens in chunks and virtualMerge)', () => {
    it('should include memo in JSONL chunks when ChunkOptions.memo is true and merge memo in virtualMerge', () => {
      const mockData: ShWvData = {
        define: { name: 'SHWV_DATA', version: '1.5' },
        meta: {
          bilingualPath: '',
          files: [{ name: 'test.txt', start: 1, end: 1 }],
          sourceLang: 'en',
          targetLang: 'ja',
        },
        body: {
          units: [
            {
              idx: 1,
              src: 'Hello',
              tgt: 'こんにちは',
              pre: '',
              note: 'File note',
              memo: 'User memo',
              ref: {
                tms: [],
                tb: [{ src: 'Hello', tgts: ['こんにちは'], forbiddens: ['ハロー'] }],
                quoted: [],
                quoted100: [],
              },
            },
          ],
          terms: [],
        },
      }

      const shuttle = new SheepShuttle()
      const chunks = shuttle.manager.chunkJsonlChunks(mockData, 4000, 'CHECK', {
        src: true,
        tgt: true,
        note: true,
        memo: true,
        terms: true,
      })
      expect(chunks).toHaveLength(1)
      const parsed = JSON.parse(chunks[0]!)
      expect(parsed.memo).toBe('User memo')
      expect(parsed.note).toBe('File note')
      expect(parsed.terms[0].forbiddens).toEqual(['ハロー'])

      const updated = shuttle.manager.virtualMerge(mockData, [{ idx: 1, memo: 'Updated memo' }])
      expect(updated).toEqual([1])
      expect(mockData.body.units[0]!.memo).toBe('Updated memo')
    })

    it('should parse forbidden terms from CSV by filename and by __FORBIDDEN__ marker, then analyze and run QA', async () => {
      const shuttle = new SheepShuttle()

      // 1. Add TB files: one with filename containing "forbidden", one with __FORBIDDEN__ marker in note
      const forbiddenCsv = `Device,端末\nBug,バグ`
      const regularCsv = `Apple,アップル,推奨訳\nApple,リンゴ,旧表記のため禁止 __FORBIDDEN__`

      await shuttle.addTbs([
        { name: 'project_forbiddens.csv', content: forbiddenCsv },
        { name: 'glossary.csv', content: regularCsv },
      ])

      // Check parsed TB entries in shuttle.tbs
      const forbiddenEntries = shuttle.tbs.filter(t => t.file === 'project_forbiddens.csv')
      expect(forbiddenEntries).toHaveLength(2)
      expect(forbiddenEntries[0]!.forbiddens).toEqual(['端末'])
      expect(forbiddenEntries[0]!.tgt).toBe('')

      const regularEntries = shuttle.tbs.filter(t => t.file === 'glossary.csv')
      expect(regularEntries).toHaveLength(2)
      expect(regularEntries[0]!.tgt).toBe('アップル')
      expect(regularEntries[0]!.forbiddens).toBeUndefined()
      expect(regularEntries[1]!.tgt).toBe('')
      expect(regularEntries[1]!.forbiddens).toEqual(['リンゴ'])
      expect(regularEntries[1]!.note).toBe('旧表記のため禁止')

      // 2. Set up ShWvData with units and analyze
      const mockData: ShWvData = {
        define: { name: 'SHWV_DATA', version: '1.5' },
        meta: {
          bilingualPath: '',
          files: [{ name: 'test.txt', start: 1, end: 2 }],
          sourceLang: 'en',
          targetLang: 'ja',
        },
        body: {
          units: [
            {
              idx: 1,
              src: 'Check this Apple Device.',
              tgt: 'このアップル端末を確認してください。', // '端末' is forbidden!
              pre: '',
              ref: { tms: [], tb: [], quoted: [], quoted100: [] },
            },
            {
              idx: 2,
              src: 'Found a Bug on Apple.',
              tgt: 'リンゴで問題を発見。', // 'リンゴ' is forbidden, and 'アップル' is missing!
              pre: '',
              ref: { tms: [], tb: [], quoted: [], quoted100: [] },
            },
          ],
          terms: [],
        },
      }

      shuttle.setNewData(mockData)
      await shuttle.analyze(false, true) // legacy true to test substring matching directly

      // Check unit.ref.tb populated correctly
      const unit1Tb = shuttle.data!.body.units[0]!.ref.tb
      const appleTb = unit1Tb.find(t => t.src === 'Apple')
      expect(appleTb).toBeDefined()
      expect(appleTb?.tgts).toContain('アップル')
      expect(appleTb?.forbiddens).toContain('リンゴ')

      const deviceTb = unit1Tb.find(t => t.src === 'Device')
      expect(deviceTb).toBeDefined()
      expect(deviceTb?.forbiddens).toContain('端末')

      // 3. Run QA
      const issues = shuttle.runQa()
      // Unit 1: 'Device' forbidden term '端末' used
      const unit1Issues = issues.filter(i => i.idx === 1)
      expect(unit1Issues.some(i => i.message.includes("Forbidden term used: '端末'"))).toBe(true)

      // Unit 2: 'Apple' forbidden term 'リンゴ' used, and 'アップル' missing
      const unit2Issues = issues.filter(i => i.idx === 2)
      expect(unit2Issues.some(i => i.message.includes("Forbidden term used: 'リンゴ'"))).toBe(true)
      expect(unit2Issues.some(i => i.message.includes("Target term missing: 'アップル'"))).toBe(true)
    })

    it('should parse forbidden terms from JSON and JSONL files', async () => {
      const shuttle = new SheepShuttle()

      const jsonContent = JSON.stringify([
        { src: 'Dog', tgt: 'イヌ', forbiddens: ['ワンちゃん', 'ポチ'] },
        { src: 'Cat', tgt: 'ネコ', forbidden: 'ニャンコ' },
      ])
      const jsonlContent = `{"src": "Bird", "tgt": "トリ", "note": "ペット用語は禁止 __FORBIDDEN__"}\n{"src": "Fish", "tgt": "サカナ"}`

      await shuttle.addTbs([
        { name: 'terms.json', content: jsonContent },
        { name: 'terms.jsonl', content: jsonlContent },
      ])

      const dog = shuttle.tbs.find(t => t.src === 'Dog')
      expect(dog?.tgt).toBe('イヌ')
      expect(dog?.forbiddens).toEqual(['ワンちゃん', 'ポチ'])

      const cat = shuttle.tbs.find(t => t.src === 'Cat')
      expect(cat?.tgt).toBe('ネコ')
      expect(cat?.forbiddens).toEqual(['ニャンコ'])

      const bird = shuttle.tbs.find(t => t.src === 'Bird')
      expect(bird?.tgt).toBe('')
      expect(bird?.forbiddens).toEqual(['トリ'])
      expect(bird?.note).toBe('ペット用語は禁止')

      const fish = shuttle.tbs.find(t => t.src === 'Fish')
      expect(fish?.tgt).toBe('サカナ')
      expect(fish?.forbiddens).toBeUndefined()
    })
  })
})
