# Git 開発ワークフローの基本

このドキュメントは、新しい機能開発やバグ修正を行う際の、ブランチ作成からマージまでの基本的なGitのワークフローをまとめたものです。

## 1. 最新の `main` を取得してブランチを作成する

開発を始める前に、必ず `main` ブランチを最新の状態にしてから新しい作業ブランチを作成します。

```bash
# mainブランチに移動
git checkout main

# 最新の状態をリモート(GitHub)から取得
git pull origin main

# 新しい作業ブランチを作成して移動（例: feature/add-new-page）
git checkout -b feature/add-new-page
```

## 2. 開発とコミット

作業ブランチでコードの変更を行い、区切りの良いところでコミットします。

```bash
# 変更されたファイルを確認
git status

# 変更をステージングエリアに追加
git add .

# 変更内容をコミット（メッセージは分かりやすく）
git commit -m "新機能〇〇を追加"
```

## 3. GitHubへPushする

ローカルでの作業が完了したら、リモート（GitHub）にブランチごとPushします。

```bash
# 現在のブランチをリモートにPush
git push origin <現在のブランチ名>
# 例: git push origin feature/add-new-page
```

## 4. GitHub上でPull Request（PR）を作成・マージする

1. GitHubのリポジトリページを開きます。
2. 先ほどPushしたブランチの「**Compare & pull request**」ボタンが表示されるのでクリックします。
3. 変更内容を確認し、問題なければ「**Create pull request**」をクリックします。
4. レビュー後（または自身で）、PRを `main` へマージします（「**Merge pull request**」）。
5. マージ完了後、リモートの不要になった作業ブランチは「**Delete branch**」ボタンで削除しておくと綺麗に保てます。

## 5. ローカルの `main` を最新化する

GitHub上でマージされたら、ローカル環境の `main` ブランチにもその変更を反映させます。（**この手順は忘れやすいので注意！**）

```bash
# 作業ブランチからmainブランチに戻る
git checkout main

# GitHub上でマージされた最新のmainを取得
git pull origin main
```

## 6. ローカルの不要な作業ブランチを削除する

最新の `main` を取得し終えたら、ローカルに残っている作業済みのブランチを削除して整理します。

```bash
# ローカルの作業ブランチを削除
git branch -d <削除するブランチ名>
# 例: git branch -d feature/add-new-page
```

---

**💡 まとめフロー**
1. `git checkout main` -> `git pull`
2. `git checkout -b <ブランチ名>`
3. (開発・コミット)
4. `git push origin <ブランチ名>`
5. (GitHubでPR作成・マージ・リモートブランチ削除)
6. `git checkout main` -> `git pull`
7. `git branch -d <ブランチ名>`
