# @sheep-family/types - ShWvData 仕様書 & バージョン変遷

本パッケージは、SheepFamily（SheepComb, SheepWeave, SheepShuttle など）で利用される対訳中間データ構造 **`ShWvData`**（`SHWV_DATA`）の TypeScript 型定義および仕様を提供します。

---

## 1. データ構造の概要

`ShWvData` は、JSON 形式で保存・交換される対訳プロジェクトデータです。
大きく分けて **`define`**、**`meta`**、**`body`**、およびオプショナルの **`projectInfo`** の 4 つのセクションで構成されます。

```json
{
  "define": {
    "name": "SHWV_DATA",
    "version": "1.3"
  },
  "meta": {
    "bilingualPath": "",
    "files": [
      { "name": "sample.xliff", "start": 1, "end": 100 }
    ],
    "sourceLang": "ja",
    "targetLang": "en",
    "projectName": "Sample Project",
    "tmFiles": [],
    "tbFiles": [],
    "workflow": {
      "index": 0,
      "role": "Extract",
      "name": "SheepComb Web",
      "segmentation": "line"
    }
  },
  "body": {
    "units": [
      {
        "idx": 1,
        "src": "原文テキスト",
        "pre": "事前翻訳または前工程の訳文",
        "tgt": "編集対象の訳文",
        "status": 0,
        "note": "備考",
        "isSub": false,
        "isPeRef": false,
        "placeholders": { "0": "{0}" },
        "ref": {
          "tms": [],
          "tb": [],
          "quoted": [],
          "quoted100": []
        }
      }
    ],
    "terms": []
  },
  "projectInfo": {
    "version": 2,
    "projectName": "Sample Project",
    "sourceLanguage": "ja",
    "targetLanguage": "en",
    "sourceFiles": [],
    "okapi": []
  }
}
```

---

## 2. バージョン変遷と差分仕様

| バージョン | 主な追加仕様・変更点 | 後方互換・フォールバック仕様 |
| :--- | :--- | :--- |
| **v1.0** | **初期コア仕様**<br>・基本3層構造（`define`, `meta`, `body.units`）<br>・セグメント単位の対訳（`src`, `tgt`, `pre`, `status`, `note`） | 最小限の必須フィールド |
| **v1.1** | **照合参照・タグ・文結合の体系化**<br>・`ref` オブジェクト（`tms`, `tb`, `quoted`, `quoted100`）<br>・`placeholders`（インラインタグ・プレースホルダーマップ）<br>・`isSub`（文分割・従属セグメントフラグ） | `ref.tms ?? []`<br>`ref.tb ?? []`<br>`placeholders ?? {}`<br>`isSub ?? false` |
| **v1.2** | **ポストエディット参照の導入**<br>・`ShWvUnit` に `isPeRef?: boolean` を追加<br>・外部TM照合と内部類似引用の識別性向上 | `isPeRef ?? false` |
| **v1.3** | **ワークフロー工程管理の追加（現行最新）**<br>・`meta.workflow`（`index`, `role`, `name`, `segmentation`）を追加<br>・SheepComb Web（抽出時）では `index: 0`, `role: 'Extract'`, `name: 'SheepComb Web'`<br>・SheepWeave など後続ツールでの工程進行（`advanceWorkflow`）による `tgt` → `pre` 繰り上げ | `meta.workflow` 未定義時は `{ index: 1, role: 'Translation', name: 'Sheep', segmentation: 'line' }` に自動初期化 |

---

## 3. 主要インターフェース詳細

### 3.1 `ShWvDefine`
```typescript
export interface ShWvDefine {
  /** 固定データセット識別名 */
  name: 'SHWV_DATA'
  /** スキーマバージョン */
  version: '1.3' | '1.2' | '1.1' | '1.0'
}
```

### 3.2 `ShWvWorkflow`
```typescript
export interface ShWvWorkflow {
  /** 工程インデックス番号 (0: 抽出, 1: 翻訳, 2: レビュー, 3: QA...) */
  index: number
  /** 工程の役割ロール ('Extract', 'Translation', 'Review' 等) */
  role: string
  /** 実行システム・ツール名 ('SheepComb Web', 'Sheep' 等) */
  name: string
  /**
   * 抽出時のセグメンテーション方式:
   * - line (デフォルト): 行単位。テキストパース時に改行でセグメント分割（splitByNewline = true）。Tikal 抽出時は -seg フラグを付けない。
   * - seg: センテンス単位（文分割）。Tikal による XLIFF 抽出時に -seg フラグを付与し、SRX等のルールに基づいた文単位のセグメンテーションを行う。
   * - raw: 改行分割なし（生データ保持）。パース時に改行による自動分割を行わない（splitByNewline = false）。
   */
  segmentation?: 'line' | 'seg' | 'raw' | string
}
```

### 3.3 `ShWvMeta`
```typescript
export interface ShWvMeta {
  bilingualPath: string
  files: ShWvFileInfo[]
  sourceLang: string
  targetLang: string
  projectName?: string
  tmFiles?: string[]
  tbFiles?: string[]
  /** [v1.3+] ワークフロー設定情報 */
  workflow?: ShWvWorkflow
}
```

### 3.3 `ShWvUnit`
```typescript
export interface ShWvUnit {
  idx: number          // 1-based のユニット通し番号
  src: string          // 原文テキスト
  pre: string          // 事前翻訳 / MT / 前工程の訳文
  tgt: string          // 編集・AI翻訳対象のアクティブな訳文
  note?: string        // 備考・コメント
  isSub?: boolean      // [v1.1+] 分割文などの従属フラグ
  status?: number      // 翻訳ステータス (0: 未翻訳, 1: 下書き, 2: 完了)
  isPeRef?: boolean    // [v1.2+] ポストエディット参照フラグ
  placeholders?: Record<number, string> // [v1.1+] タグ置換マップ
  ref: ShWvRef         // [v1.1+] 照合参照データ
}
```

### 3.4 `ShWvRef`
```typescript
export interface ShWvRef {
  /** 翻訳メモリ (TM) の一致候補 */
  tms: ShWvRefTm[]
  /** 用語集 (TB) の一致用語 */
  tb: ShWvRefTb[]
  /** ドキュメント内の類似・同一セグメント参照 [参照先idx, 一致率%] */
  quoted: [number, number][]
  /** 100% 完全一致する参照先 idx リスト */
  quoted100: number[]
}
```

---

## 4. パーサー・消費側の実装指針（フォールバック原則）

1. **バージョンの許容性**:
   `define.name === 'SHWV_DATA'` であれば、`define.version` が `1.0` 〜 `1.3` のいずれであってもパース可能である必要があります。
2. **オプショナル項目の初期化**:
   - `ref` やその配下の `tms`, `tb`, `quoted` が欠落している場合は空配列 `[]` として扱う。
   - `meta.workflow` が存在しない場合は初期ステップ（`index: 1`）として扱う。
   - `pre` が存在しない場合は空文字列 `""` として扱う。
