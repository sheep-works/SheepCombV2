# CLI データディレクトリ

## 構成

```
cli/data/
├── src/          ← Parser 入力ファイルをここに置く
│                    対応形式: .xlf .xliff .mxliff .mqxliff .sdlxliff .tmx .xlsx .docx
├── input.json    ← SheepShuttle 用 ShWvData JSON をここに置く
└── out/          ← 全ての出力はここに生成される
```

## 使い方

```bash
npm run cli
```

1. ツール選択: `1` (Parser) または `2` (SheepShuttle)
2. 機能選択

### Parser

`cli/data/src/` に対象ファイルを配置してから実行。

### SheepShuttle

`cli/data/input.json` に ShWvData JSON を配置してから実行。
