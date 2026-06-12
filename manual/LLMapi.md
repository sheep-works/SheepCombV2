# ローカル LLM でチェックする

## SheepComb Web でのローカルLLM利用方法

SheepComb Web では、ローカルにインストールされたLLMを利用するための機能を搭載しています。

### 対応 LLM

 SheepComb Web は以下のLLMに対応しています。

- Ollama (https://ollama.com/)
- LM Studio (https://lmstudio.ai/)

また、モデルは各自でダウンロードしておいてください。
どのモデルが動くかをサッと知りたい場合はこちら
[Can I run](https://www.canirun.ai/)

## LLM 側の設定

### Ollama

起動中の Ollama を終了してPowershellを起動し、以下のコマンドを実行します。

**Windows**
```powershell
$env:OLLAMA_ORIGINS="*"
ollama serve
```

**Mac / Linux**
```bash
export OLLAMA_ORIGINS="*"
ollama serve
```

> **💡 補足（恒久的な設定方法）**
> 上記のコマンドを使った方法は、ターミナルを閉じると設定がリセットされます。毎回コマンドを打つのが面倒な場合は、OSの環境変数に直接設定を保存してください。
> - **Windows**: スタートメニューから「システム環境変数の編集」を開き、システム環境変数に新規で変数名 `OLLAMA_ORIGINS`、値 `*` を追加します。
> - **Mac**: ターミナルで `launchctl setenv OLLAMA_ORIGINS "*"` を実行し、Ollamaアプリを再起動します。

これで [APIページ](https://sheepcomb.netlify.app/shuttle/api/) にアクセスして **Ollama** を選択、モデルのリストが取得できればOKです（読み込まれない場合は、MODEL の右にある更新ボタンを試してください）。

### LM Studio

LM Studio を起動し、左側のナビゲーションから **Developer** を選び、左上のスイッチでサーバーを起動します。

次に、その横の **Server Settings** をクリックし、**Enable CORS** をオンにします。

これで [APIページ](https://sheepcomb.netlify.app/shuttle/api/) にアクセスして **LM Studio** を選択、モデルのリストが取得できればOKです（読み込まれない場合は、MODEL の右にある更新ボタンを試してください）。


## 使い方

1. [パースページ](https://sheepcomb.netlify.app/shuttle/parser) にアクセスして、チェックしたいファイルを読み込ませます。
2. 必要に応じて **構造化** や **解析** を行います。
3. [APIページ](https://sheepcomb.netlify.app/shuttle/api/) を開き、使いたい LLM とモデルを設定します。
4. 言語とプロンプトを調整します。
5. **チャンク作成** ボタンをクリックして、原文をチャンクに分割します。
6. **全チャンク処理** ボタンをクリックするか、右側のチャンクリストから処理したい項目を選んで更新ボタンをクリックします。
7. 処理が完了すると、校正結果が表示されます。
