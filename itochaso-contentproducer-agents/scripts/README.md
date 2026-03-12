# Scripts — テンプレート化済み統合スクリプト集

このディレクトリには、マルチエージェント content producer システムの
各クライアント向けにカスタマイズ可能なスクリプトが含まれています。

## セットアップウィザード（最初に実行）

```bash
node scripts/setup-wizard.js
```

以下の設定を対話式で行います:
- クライアント基本情報（名前、ドメイン、業種など）
- ブランド情報（代表者、理念、差別化ポイント）
- WordPress 接続情報
- Slack チャンネルの設定
- 環境変数（.env ファイル）の生成
- テンプレートプレースホルダの置換

**実行後に必ず config.yaml と .env を確認し、.env を .gitignore に追加してください。**

---

## メイン統合スクリプト

### 1. slack-feedback.js — フィードバック・デプロイ連携

**用途**: Slack #xxx-feedback チャンネルと連携したフィードバック・デプロイ管理

**サブコマンド:**

```bash
# プレビュー確認依頼を投稿（1件）
node scripts/slack-feedback.js post --url /path/to/page --title "ページタイトル" [--clinic misao|louis-kano]

# 複数ページをまとめて依頼（対話式）
node scripts/slack-feedback.js batch [--files path1 path2 ...]

# Slack スレッドからフィードバックを取得
node scripts/slack-feedback.js fetch [--dry-run]

# 全ページのステータスを表示
node scripts/slack-feedback.js status

# Slack スレッドを同期し、承認状況を更新
node scripts/slack-feedback.js sync
node scripts/slack-feedback.js check-approvals  # 同じ

# 承認済みページのデプロイ計画を投稿（#deploy チャンネルへ）
node scripts/slack-feedback.js deploy-plan

# デプロイ実行（Kosuke の承認後）
node scripts/slack-feedback.js deploy-execute

# スレッドに返信
node scripts/slack-feedback.js reply --ts THREAD_TS --message "返信メッセージ"
```

**必要な環境変数:**
```
SLACK_BOT_TOKEN         — xoxb-...
SLACK_CHANNEL_ID        — C0xxxxxx（フィードバック用）
SLACK_DEPLOY_CHANNEL_ID — C0xxxxxx（デプロイ用、オプション）
```

**カスタマイズポイント:**
- WP_PAGE_ID: ファイルパス → WordPress page ID のマッピング（config.yaml で管理推奨）
- LABEL_MAP: ファイルパス → 日本語ラベルのマッピング
- プレビュー URL の base（config.yaml から読み込む）

---

### 2. slack-seo-proposer.js — SEO コンテンツ提案

**用途**: 毎朝の競合分析に基づくコンテンツ提案を Slack に投稿

**サブコマンド:**

```bash
# 競合分析を実行し、提案を投稿（毎朝8時に自動実行推奨）
node scripts/slack-seo-proposer.js propose [--dry-run]

# Slack スレッドから「作って」指令を検出
node scripts/slack-seo-proposer.js check-commands

# 週間サマリーを投稿（毎週月曜）
node scripts/slack-seo-proposer.js weekly-summary

# 記事完成を #xxx-feedback に通知
node scripts/slack-seo-proposer.js notify-complete --slug article-slug --title "タイトル" --score 92

# バックログ（未採用提案）を表示
node scripts/slack-seo-proposer.js backlog

# 提案・作成状況を一覧表示
node scripts/slack-seo-proposer.js status
```

**必要な環境変数:**
```
SLACK_BOT_TOKEN         — xoxb-...
SLACK_SEO_CHANNEL_ID    — C0xxxxxx
SLACK_CHANNEL_ID        — C0xxxxxx（フィードバック用）
```

**カスタマイズポイント:**
- seo-targets.yaml: 競合リスト（15社まで）
- audits/seo-proposals/daily-*.json: 提案データ形式
- 提案スコアの計算ロジック

---

### 3. slack-data-ingest.js — 院長データ自動取り込み

**用途**: Slack #xxx-data チャンネルから院長のデータ（実績、想い、エピソード）を自動取り込み

**サブコマンド:**

```bash
# 新着メッセージを取得して data/ に保存
node scripts/slack-data-ingest.js fetch [--since YYYY-MM-DD] [--dry-run]

# 取り込み済みデータを分析
node scripts/slack-data-ingest.js analyze

# 取り込み状況を表示
node scripts/slack-data-ingest.js status

# 分析結果に基づく更新提案を投稿
node scripts/slack-data-ingest.js propose [--dry-run]
```

**必要な環境変数:**
```
SLACK_BOT_TOKEN       — xoxb-...
SLACK_DATA_CHANNEL_ID — C0xxxxxx
SLACK_CHANNEL_ID      — C0xxxxxx（提案投稿先）
```

**カスタマイズポイント:**
- data/ ディレクトリ構成
- メッセージ分類ロジック
- コンテンツ更新提案の生成ルール

---

### 4. seo-pre-deploy.js — SEO プリデプロイチェック

**用途**: デプロイ前に HTML ファイルの SEO 要件を検査

**使い方:**

```bash
# 1ファイルをチェック
node scripts/seo-pre-deploy.js pages/preview/service.html

# 複数ファイルをチェック
node scripts/seo-pre-deploy.js pages/preview/*.html

# レポートを指定パスに保存
node scripts/seo-pre-deploy.js pages/preview/*.html --output audits/seo-pre-deploy-custom.md
```

**チェック項目:**
- ✅ H1 タグが1個
- ✅ alt 属性が全画像についている
- ✅ http:// リンクがない（https 推奨）
- ✅ 相対パス内部リンク（絶対パス非推奨）
- ✅ JSON-LD 構造化データ
- ✅ H2/H3 見出し
- ✅ テキスト量（300文字以上推奨）

**出力:**
- JSON: stdout に出力（slack-feedback.js が受け取る）
- Markdown: audits/seo-pre-deploy-YYYYMMDD.md に保存

---

### 5. generate-status-xlsx.py — ページ管理 Excel 生成

**用途**: ページ制作ステータスを Excel で可視化（3シート: アクティブ / アーカイブ / サマリー）

**使い方:**

```bash
python scripts/generate-status-xlsx.py
```

**出力:**
- pages/preview/ページ管理.xlsx

**カスタマイズポイント:**
- WP_PAGE_ID: ファイルパス → WordPress page ID
- LABEL_MAP: ファイルパス → 日本語ラベル
- SECTIONS: ディレクトリセクション（本院、サービス、採用等）
- status-colors: ステータスの表示色

setup-wizard.js 実行後に config.yaml から読み込むよう対応予定。

---

## 補助スクリプト（スタブ版）

以下のスクリプトはテンプレート版として用意されています。
各クライアント向けにカスタマイズして実装してください。

### Python ユーティリティ

- **ahrefs-analyze.py** — Ahrefs API から競合データを取得し、クイックウィン検出
- **image-labeler.py** — Vision API で画像を分析し、alt テキストを自動生成
- **image-sorter.py** — 画像を用途別に分類・整理（重複検出等）
- **inventory-excel.py** — サイトインベントリ Excel を生成（ページ一覧、SEO メトリクス）
- **wp-media-upload.py** — ローカル画像を一括アップロード、メディアライブラリに整理
- **approval-server.py** — デプロイ承認用 Web サーバー（Flask）

### シェルスクリプト

- **env-decrypt.sh** — 暗号化された .env.encrypted をデコード
- **env-encrypt.sh** — .env を AES-256-CBC で暗号化
- **preview-url.sh** — プレビュー URL を生成・表示
- **remote-mode.sh** — リモート開発モードの設定
- **image-setup.sh** — 画像処理環境をセットアップ

---

## 環境変数管理

### .env ファイル

setup-wizard.js 実行時に作成されます。**必ず .gitignore に追加してください。**

```bash
# .env
SLACK_BOT_TOKEN=xoxb-...
SLACK_CHANNEL_ID=C0...
SLACK_DEPLOY_CHANNEL_ID=C0...
SLACK_SEO_CHANNEL_ID=C0...
SLACK_DATA_CHANNEL_ID=C0...
WP_USERNAME=（オプション）
WP_APP_PASSWORD=（オプション）
PROJECT_ENV=development
```

### 秘密情報の暗号化

本番環境では .env を暗号化することを推奨します:

```bash
# 暗号化
bash scripts/env-encrypt.sh

# デコード（デプロイ時）
bash scripts/env-decrypt.sh
```

---

## ワークフロー例

### 1. 初期セットアップ

```bash
# ウィザードを実行
node scripts/setup-wizard.js

# config.yaml、.env を確認
cat config.yaml
cat .env

# .env を .gitignore に追加
echo ".env" >> .gitignore

# 動作確認
node scripts/slack-feedback.js status
```

### 2. デイリーワークフロー

```bash
# 朝: SEO 提案を確認
node scripts/slack-seo-proposer.js propose

# データ取り込み（院長からのデータ）
node scripts/slack-data-ingest.js fetch
node scripts/slack-data-ingest.js propose

# ページ作成後: デプロイ依頼を投稿
node scripts/slack-feedback.js post --url pages/preview/new-service.html --title "新サービス"

# デプロイ実行前: SEO チェック
node scripts/seo-pre-deploy.js pages/preview/new-service.html

# 承認検出とデプロイ
node scripts/slack-feedback.js check-approvals
node scripts/slack-feedback.js deploy-plan
node scripts/slack-feedback.js deploy-execute
```

### 3. 週次レポート

```bash
# ページ管理 Excel を生成
python scripts/generate-status-xlsx.py

# SEO 週間サマリーを投稿
node scripts/slack-seo-proposer.js weekly-summary

# サイトインベントリを生成
python scripts/inventory-excel.py
```

---

## トラブルシューティング

### "❌ 環境変数が未設定です"

```bash
# 原因: .env がない、または設定値がない
# 対策: setup-wizard.js を再度実行
node scripts/setup-wizard.js
```

### "❌ Slack API error: invalid_token"

```bash
# 原因: SLACK_BOT_TOKEN が無効
# 対策:
# 1. Slack ワークスペースのアプリ設定を確認
# 2. Bot Token Scopes を確認
# 3. .env で正しいトークンを設定
```

### "❌ WP_PAGE_ID マッピングが見つかりません"

```bash
# 原因: ファイルパスが WP_PAGE_ID 辞書に登録されていない
# 対策: config.yaml に page_mappings セクションを追加
# または、slack-feedback.js の WP_PAGE_ID を更新
```

---

## 実装ガイド

テンプレート版スクリプトの実装方法は、以下の Wiki を参照:

- [ahrefs-analyze 実装ガイド](https://github.com/itochaso/contentproducer-agents/wiki/ahrefs-analyze)
- [image-labeler 実装ガイド](https://github.com/itochaso/contentproducer-agents/wiki/image-labeler)
- [image-sorter 実装ガイド](https://github.com/itochaso/contentproducer-agents/wiki/image-sorter)
- [approval-server 実装ガイド](https://github.com/itochaso/contentproducer-agents/wiki/approval-server)

---

## ライセンス

Copyright © itochaso. All rights reserved.
