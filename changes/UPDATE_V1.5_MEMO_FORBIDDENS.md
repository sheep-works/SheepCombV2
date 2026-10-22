# ShWvData v1.5 変更点・追加実装まとめ

本書は、コアモジュール `SheepShuttle`（`@sheep-family/types` / `@sheep-family/core`）における **`ShWvData` version 1.5** のスキーマ変更点、追加実装、および各サブプロジェクト（`SheepComb`, `SheepWeave`, `SheepBobbin` 等）への連携仕様をまとめたドキュメントです。

---

## 1. 概要

`ShWvData` のスキーマバージョンを **`1.5`** に更新し、以下の2つのフィールドおよび関連機能を追加しました。

1. **`ShWvUnit.memo?: string`**
   - 原文ファイル由来の備考・コンテキスト情報である `note` とは独立して、**ユーザーが独自に付与・編集できる備考（メモ）フィールド**を追加。
2. **`ShWvRefTb.forbiddens?: string[]`**
   - 用語集（Termbase）の一致結果に対して、訳語候補（`tgts`）だけでなく **使用禁止用語（訳文に使用してはならない語句）** を保持できるように追加。

---

## 2. 型定義の変更 (`@sheep-family/types`)

対象ファイル: `packages/types/src/index.ts`

### 2.1 スキーマバージョン (`ShWvDefine`)
```diff
 export interface ShWvDefine {
   /** Fixed dataset header name */
   name: 'SHWV_DATA'
   /** ShWv format schema version */
-  version: '1.4' | '1.3' | '1.2' | '1.1' | '1.0'
+  version: '1.5' | '1.4' | '1.3' | '1.2' | '1.1' | '1.0'
 }
```

### 2.2 翻訳ユニット (`ShWvUnit`)
```diff
 export interface ShWvUnit {
   idx: number
   src: string
   pre: string
   tgt: string
   /** Optional translator note */
   note?: string
+  /** Optional user-defined memo or remark */
+  memo?: string
   isSub?: boolean
   status?: number
   isPeRef?: boolean
   ref: ShWvRef
   placeholders?: Record<number, string>
 }
```

### 2.3 用語集参照 (`ShWvRefTb`)
```diff
 export interface ShWvRefTb {
   /** Matched source term */
   src: string
   /** Candidate target translations for the term */
   tgts: string[]
+  /** Forbidden target translations for the term (do-not-use terms) */
+  forbiddens?: string[]
   /** Usage note or term definition */
   note?: string
   /** Source TB file name */
   file?: string
 }
```

### 2.4 チャンク出力オプション (`ChunkOptions`)
```diff
 export interface ChunkOptions {
   src?: boolean
   tgt?: boolean
   note?: boolean
+  /** Include user-defined memo */
+  memo?: boolean
   history?: boolean
   terms?: boolean
   format?: 'jsonl' | 'toon'
   useToon?: boolean
 }
```
- `createChunkOptions()` のデフォルト値に `memo: options?.memo ?? false` を追加。

---

## 3. コア機能の追加実装 (`@sheep-family/core`)

### 3.1 コンバータ出力バージョンの更新 (`ShuttleConverter`)
- 対象ファイル: `packages/core/src/shuttle/components/converter.ts`
- `fromUnits()` で新規生成される `ShWvData.define.version` を `'1.5'` に更新しました。

### 3.2 JSONL チャンク生成での `memo` / `forbiddens` 出力対応 (`ShuttleManager`, `ShuttleProcessor`)
- 対象ファイル:
  - `packages/core/src/shuttle/components/manager.ts` (`chunkJsonlChunks`, `chunkJsonlBySimilarityChunks`)
  - `packages/core/src/shuttle/components/processor.ts` (`chunkUnits`)
- **挙動**:
  - `ChunkOptions` で `memo: true` が指定され、かつ対象ユニットに `unit.memo` が存在する場合、出力される JSONL の各行オブジェクトに `"memo": "..."` を含めます。
  - `ChunkOptions` で `terms: true` が指定された場合、`unit.ref.tb` がそのまま出力されるため、`forbiddens` が設定されていれば `"terms": [{"src": "...", "tgts": [...], "forbiddens": [...]}]` として JSONL に出力されます。
  - ※ TOON 形式（`@toon-format/toon`）はフラットな表構造向けであり複雑な構造には適さないため、`memo` / `forbiddens` の特別な対応は行っていません。
  - ※ `updateFromJsonl()` による AI レスポンスからの `memo` 自動書き戻しは標準では行わず、`tgt`（または `pre`）のみを更新します（既存の `unit.memo` は保持されます）。

### 3.3 仮想マージでの `memo` マージ対応 (`ShuttleManager.virtualMerge`)
- 対象ファイル: `packages/core/src/shuttle/components/manager.ts`
- **挙動**:
  - 分業パッチや外部更新データをマージする `virtualMerge(data, patchUnits)` において、従来の `tgt`, `pre`, `status`, `note` に加え、`patch.memo` の差分比較・上書きに対応しました。
  ```ts
  if (patch.memo !== undefined && patch.memo !== targetUnit.memo) {
    targetUnit.memo = patch.memo
    changed = true
  }
  ```

### 3.4 QA チェッカーでの使用禁止用語 (`forbiddens`) 検出 (`checkTerms`)
- 対象ファイル: `packages/core/src/qa/qaChecker.ts`
- **挙動**:
  - `checkTerms(unit)` において、各 `unit.ref.tb` エントリの `forbiddens` 配列を走査し、訳文（`tgt`、プレースホルダー復元後）に禁止用語が含まれている場合に `issue_type: 'Term'` の QA エラーを発行します。
  - `tgts` が空配列 `[]`（禁止用語のみ登録されたエントリ）であっても、スキップせずに `forbiddens` のチェックを実行します。
  - **エラーメッセージ形式**:
    ```text
    Forbidden term used: '<検出された禁止用語>' (Source: '<原文用語>')
    ```

---

## 4. API・プロンプト・下流プロジェクトへの影響と指針

- **API サーバー (`@sheep-family/api`)**:
  - リクエストスキーマ（`chunk: string`）はシリアライズ済み文字列を受け取るため、API エンドポイントや OpenAPI 定義への破壊的変更はありません。
- **LLM プロンプト**:
  - チャンク出力オプションで `memo: true` や `terms: true`（`forbiddens` 含む）を有効にして AI に送信する場合、システムプロンプト内の入力スキーマ説明に以下を追記することで AI に意図を伝達できます。
    - `memo`: ユーザー独自の備考・指示
    - `terms[].forbiddens`: 訳文への使用が禁止されている訳語リスト
- **後方互換性**:
  - `memo` および `forbiddens` はどちらもオプショナル（`?`）であるため、`v1.0` 〜 `v1.4` の既存 JSON データもそのまま読み込み・処理可能です。
