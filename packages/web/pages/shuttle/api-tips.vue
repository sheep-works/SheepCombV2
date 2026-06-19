<template>
  <div class="api-tips-view">
    <div class="tips-container card">
      <h1>ローカル LLM でチェックする</h1>

      <section>
        <h2>SheepComb Web でのローカルLLM利用方法</h2>
        <p>SheepComb Web では、ローカルにインストールされたLLMを利用するための機能を搭載しています。</p>

        <h3>対応 LLM</h3>
        <p>SheepComb Web は以下のLLMに対応しています。</p>
        <ul>
          <li><a href="https://ollama.com/" target="_blank" rel="noopener noreferrer">Ollama</a></li>
          <li><a href="https://lmstudio.ai/" target="_blank" rel="noopener noreferrer">LM Studio</a></li>
        </ul>
        <p>
          また、モデルは各自でダウンロードしておいてください。<br>
          どのモデルが動くかをサッと知りたい場合はこちら：
          <a href="https://www.canirun.ai/" target="_blank" rel="noopener noreferrer">Can I run</a>
        </p>
      </section>

      <section>
        <h2>LLM 側の設定</h2>

        <h3>Ollama</h3>
        <p>起動中の Ollama を終了してPowershell（またはターミナル）を起動し、以下のコマンドを実行します。</p>

        <h4>Windows</h4>
        <pre><code class="language-powershell">$env:OLLAMA_ORIGINS="*"
ollama serve</code></pre>

        <h4>Mac / Linux</h4>
        <pre><code class="language-bash">export OLLAMA_ORIGINS="*"
ollama serve</code></pre>

        <div class="alert-box info">
          <strong>💡 補足（恒久的な設定方法）</strong>
          <p>上記のコマンドを使った方法は、ターミナルを閉じると設定がリセットされます。毎回コマンドを打つのが面倒な場合は、OSの環境変数に直接設定を保存してください。</p>
          <ul>
            <li><strong>Windows</strong>スタートメニューから「システム環境変数の編集」を開き、システム環境変数に新規で変数名 <code>OLLAMA_ORIGINS</code>、値 <code>*</code> を追加します。</li>
            <li><strong>Mac</strong>ターミナルで <code>launchctl setenv OLLAMA_ORIGINS "*"</code> を実行し、Ollamaアプリを再起動します。</li>
          </ul>
        </div>

        <p>
          これで <NuxtLink to="/shuttle/api">APIページ</NuxtLink> にアクセスして <strong>Ollama</strong> を選択、モデルのリストが取得できればOKです（読み込まれない場合は、MODEL の右にある更新ボタンを試してください）。
        </p>

        <hr>

        <h3>LM Studio</h3>
        <p>LM Studio を起動し、左側のナビゲーションから <strong>Developer</strong> を選び、左上のスイッチでサーバーを起動します。</p>
        <p>次に、その横の <strong>Server Settings</strong> をクリックし、<strong>Enable CORS</strong> をオンにします。</p>
        <p>
          これで <NuxtLink to="/shuttle/api">APIページ</NuxtLink> にアクセスして <strong>LM Studio</strong> を選択、モデルのリストが取得できればOKです（読み込まれない場合は、MODEL の右にある更新ボタンを試してください）。
        </p>
      </section>

      <section>
        <h2>使い方</h2>
        <ol>
          <li><NuxtLink to="/shuttle/parser">パースページ</NuxtLink> にアクセスして、チェックしたいファイルを読み込ませます。</li>
          <li>必要に応じて <strong>構造化</strong> や <strong>解析</strong> を行います。</li>
          <li><NuxtLink to="/shuttle/api">APIページ</NuxtLink> を開き、使いたい LLM とモデルを設定します。</li>
          <li>言語とプロンプトを調整します。</li>
          <li><strong>チャンク作成</strong> ボタンをクリックして、原文をチャンクに分割します。</li>
          <li><strong>全チャンク処理</strong> ボタンをクリックするか、右側のチャンクリストから処理したい項目を選んで更新ボタンをクリックします。</li>
          <li>処理が完了すると、校正結果が表示されます。</li>
        </ol>
      </section>
    </div>
  </div>
</template>

<style scoped>
.api-tips-view {
  padding: 24px;
  max-width: 900px;
  margin: 0 auto;
  color: var(--text);
}

.tips-container {
  padding: 32px 40px;
  background: var(--bg-card, #1e1e1e);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

h1 {
  font-size: 1.8rem;
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
  color: var(--teal, #2dd4bf);
}

h2 {
  font-size: 1.4rem;
  margin-top: 32px;
  margin-bottom: 16px;
  color: var(--teal, #2dd4bf);
}

h3 {
  font-size: 1.2rem;
  margin-top: 24px;
  margin-bottom: 12px;
  color: var(--teal, #14b8a6);
}

h4 {
  font-size: 1rem;
  margin-top: 16px;
  margin-bottom: 8px;
  color: var(--text-muted);
}

p {
  line-height: 1.6;
  margin-bottom: 16px;
}

ul, ol {
  margin-bottom: 24px;
  padding-left: 24px;
  line-height: 1.6;
}

li {
  margin-bottom: 8px;
}

a {
  color: var(--primary, #6366f1);
  text-decoration: none;
  font-weight: 500;
}

a:hover {
  text-decoration: underline;
}

pre {
  background: #111;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  margin-bottom: 20px;
  border: 1px solid var(--border);
}

code {
  font-family: Consolas, Monaco, "Courier New", monospace;
  font-size: 0.9em;
}

.alert-box {
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.3);
  border-left: 4px solid var(--success, #4ade80);
  padding: 16px 20px;
  border-radius: 6px;
  margin: 24px 0;
}

.alert-box strong {
  display: block;
  margin-bottom: 8px;
  color: var(--success, #4ade80);
}

.alert-box p {
  margin-bottom: 12px;
  font-size: 0.95em;
}

.alert-box ul {
  margin-bottom: 0;
  font-size: 0.95em;
}

hr {
  border: 0;
  border-top: 1px solid var(--border);
  margin: 32px 0;
}
</style>
