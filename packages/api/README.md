# @sheep-family/api

SheepHubの翻訳・校正処理を行うHonoベースのAPIサーバー（クライアントUI上では `HonoX` と表現されます）です。
Vertex AI (Google Gen AI SDK) を使用し、インメモリのタスク管理機能や、プロンプトキャッシュによる最適化を提供します。

---

## 概要

このサーバーは、Vertex AIのAPIをラップして以下の機能を提供します。
- **高密度プロンプトキャッシュ（Prompt Caching）**: 巨大なシステムインストラクションをキャッシュし、APIコール時のレイテンシとトークンコストを削減します。
- **柔軟な翻訳・チェックエンジン**: 固定のMarkdownプロンプトベースのエンドポイントに加え、ユーザー任意のカスタムプロンプトによる処理もサポートします。
- **非同期（ポーリング型）と同期（レスポンス即時返却）処理**: タイムアウトや遅延を避けるための非同期タスクエンジンを内蔵しています。
- **OpenAPI仕様の自動生成**: 起動時に自動的にOpenAPIスペックファイルを書き出し、Swagger UIでのドキュメント確認が可能です。

---

## 環境変数

ルートディレクトリの `.env` または環境変数より以下の設定を読み込みます。

| 変数名 | 説明 | 必須 | デフォルト値 |
| :--- | :--- | :--- | :--- |
| `PORT` | サーバーの起動ポート番号 | 任意 | `8000` |
| `PROJECT_ID` | Vertex AI を実行する Google Cloud プロジェクトID | **必須** | - |
| `API_KEY_*` | サーバー認証用APIキー (例: `API_KEY_SHEEP=xxx` と定義すると、ヘッダーに `X-API-KEY: xxx` が渡された際にアクセスを許可します) | **必須** | - |

---

## 使用AIモデル仕様

現在、内部で使用されるモデルは以下に固定されています。クライアント側からのモデルの動的変更はサポートしていません。

- **モデル名**: `gemini-3.1-flash-lite-preview`
- **プロバイダー**: Vertex AI (`global` リージョン)
- **パラメーター**:
  - `temperature`: `0.0` (完全決定論的出力)
  - `maxOutputTokens`: `8192`

---

## 主要APIエンドポイント一覧

すべてのエンドポイント（Swagger UIやOpenAPI JSONを除く）は、ヘッダーに有効な `X-API-KEY` を含める必要があります。

### 1. システムエンドポイント
- **`GET /verify_connection`**
  - 認証キーが有効であり、APIサーバーがアクセス可能か疎通チェックを行います。
- **`GET /tasks/:task_id`**
  - 非同期タスクの実行ステータスと処理結果をポーリングするためのエンドポイント。
  - **レスポンス**: `status` (`pending`, `processing`, `success`, `error`), `result`, `error`
- **`GET /openapi.json`**
  - 自動生成される OpenAPI 3.1.0 仕様の JSON ドキュメント。
- **`GET /docs`**
  - インタラクティブにAPIの仕様確認と実行テストができる Swagger UI ドキュメントビューワー。

### 2. キャッシュ制御エンドポイント
- **`POST /gen/init_prompt`**
  - 巨大なシステムプロンプト（インストラクション）を Vertex AI にキャッシュします。
  - **リクエスト**: `system_instruction` (プロンプト文字列), `display_name` (キャッシュ表示名)
  - **レスポンス**: キャッシュの一意なリソース識別子（`cache_id` / `cache_name`）
- **`POST /gen/delete_cache`**
  - キャッシュされたリソースを明示的に解放（削除）します。
  - **リクエスト**: `cache_name`

### 3. ユーザーカスタムプロンプト処理
- **`POST /gen/check/user` (非同期) / `POST /gen/check/user/sync` (同期)**
  - ユーザー定義のプロンプトまたはキャッシュを適用してデータチェックを行います。
- **`POST /gen/trans/user` (非同期) / `POST /gen/trans/user/sync` (同期)**
  - ユーザー定義のプロンプトまたはキャッシュを適用してデータ翻訳を行います。

**リクエストスキーマ (`UserRequest`)**:
```json
{
  "chunk": "【必須】処理対象のJSONL形式テキストデータ",
  "prompt": "【任意】カスタムプロンプト（指示書き）",
  "cache_id": "【任意】事前に初期化したプロンプトキャッシュのID"
}
```

### 4. 動的プロンプトエンドポイント
`packages/api/prompts/` ディレクトリ配下に `カテゴリー名-プロンプト名.md` 形式で配置された Markdown ファイルに基づき、起動時に自動的に以下のエンドポイントが登録されます。

- **`POST /gen/:category/:name`** (非同期処理)
- **`POST /gen/:category/:name/sync`** (同期処理)

**例:** `check-default.md` が配置されている場合：
- `/gen/check/default` および `/gen/check/default/sync` がエンドポイントとして利用可能になります。
- **リクエストスキーマ (`RequestBody`)**:
  ```json
  {
    "chunk": "処理対象のJSONL形式テキストデータ (最大4000文字制限)"
  }
  ```

---

## 開発と実行

プロジェクトルートディレクトリから以下のpnpmコマンドで操作します。

### 開発モード起動 (ファイル変更のホットリロード付き)
```bash
pnpm --filter @sheep-family/api run dev
```

### ビルド (TypeScriptコンパイル)
```bash
pnpm --filter @sheep-family/api run build
```

### 本番用スタート
```bash
pnpm --filter @sheep-family/api run start
```
