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
})
