# Quick Start — テンプレート化スクリプト初期セットアップガイド

## 5分でセットアップを完了させるガイド

### ステップ 1: セットアップウィザードを実行（3分）

```bash
cd itochaso-contentproducer-agents/
node scripts/setup-wizard.js
```

**聞かれる内容（答えてください）:**
- クライアント名（例: 操レディスホスピタル）
- ドメイン（例: misao-ladies.jp）
- 業種（medical / dental / beauty / legal / realestate / restaurant / general）
- 代表者名
- WordPress URL（例: https://example.com）
- Slack Bot Token（xoxb-...）
- Slack チャンネル ID（C0...）

**生成されるファイル:**
- `config.yaml` — プロジェクト設定
- `.env` — 環境変数（Slack tokens 等）

### ステップ 2: .env を確認・保護（1分）

```bash
# .env の内容を確認（パスワードが含まれているので注意）
cat .env

# .gitignore に追加（重要！公開リポジトリには含めない）
echo ".env" >> .gitignore

# git で .env が無視されているか確認
git status  # .env が表示されないはず
```

### ステップ 3: config.yaml を確認（1分）

```bash
# 設定が正しく入力されているか確認
cat config.yaml

# 特に以下を確認:
# - client.name
# - client.domain
# - wordpress.url
# - slack.channels
```

### ステップ 4: 動作確認（1分）

```bash
# Slack 連携が正常か確認
node scripts/slack-feedback.js status

# ページ管理 Excel を生成
python scripts/generate-status-xlsx.py

# 確認: pages/preview/ページ管理.xlsx が生成されている
ls -lh pages/preview/ページ管理.xlsx
```

✅ **完了!** これで基本的なセットアップは終了です。

---

## 次のステップ

### よく使うコマンド

```bash
# ページのプレビュー確認依頼を Slack に投稿
node scripts/slack-feedback.js post \
  --url pages/preview/new-service.html \
  --title "新しいサービス"

# Slack のフィードバックを取得
node scripts/slack-feedback.js fetch

# デプロイ可能か SEO チェック
node scripts/seo-pre-deploy.js pages/preview/new-service.html

# ステータスを確認
node scripts/slack-feedback.js status
```

### カスタマイズが必要な部分

**1. ページマッピング（slack-feedback.js の WP_PAGE_ID）**

```javascript
// ファイルパス → WordPress page ID
const WP_PAGE_ID = {
  'pages/preview/service1.html': 1234,  // ← 自分の環境に合わせて入力
  'pages/preview/service2.html': 5678,
};
```

**2. ラベル（slack-feedback.js の LABEL_MAP）**

```javascript
// ファイルパス → 日本語ラベル
const LABEL_MAP = {
  'pages/preview/service1.html': 'サービス1',
  'pages/preview/service2.html': 'サービス2',
};
```

**3. ページセクション（generate-status-xlsx.py の SECTIONS）**

```python
# ディレクトリ構成
SECTIONS = [
    {"dir": "pages/preview", "label": "本院", "root_files": []},
    {"dir": "pages/articles", "label": "コラム", "root_files": ["pages/articles-index.html"]},
]
```

---

## トラブルシューティング

### "❌ 環境変数が未設定です"
```bash
# 原因: .env ファイルがない、または SLACK_BOT_TOKEN が未設定
# 対策: setup-wizard.js を再度実行
node scripts/setup-wizard.js
```

### "❌ Cannot find module 'js-yaml'"
```bash
# 原因: Node.js 依存パッケージがインストールされていない
# 対策: npm install
npm install
```

### "❌ Slack API error: invalid_token"
```bash
# 原因: Slack Bot Token が無効
# 対策:
# 1. Slack ワークスペースのアプリ設定を確認
# 2. Bot User OAuth Token をコピーし直す
# 3. .env で SLACK_BOT_TOKEN を更新
# 4. setup-wizard.js を再度実行
node scripts/setup-wizard.js
```

### "❌ Cannot connect to WordPress"
```bash
# 原因: WordPress URL または REST API が無効
# 対策:
# 1. config.yaml の wordpress.url と wordpress.api_base を確認
# 2. WordPress REST API が有効か確認（管理画面 → 設定 → パーマリンク）
# 3. setup-wizard.js を再度実行
node scripts/setup-wizard.js
```

---

## 毎日のワークフロー

### 朝（8:00）
```bash
# SEO 提案を確認
node scripts/slack-seo-proposer.js propose

# 院長からのデータを取り込み
node scripts/slack-data-ingest.js fetch
node scripts/slack-data-ingest.js propose
```

### ページ作成後
```bash
# Slack に確認依頼を投稿
node scripts/slack-feedback.js post \
  --url pages/preview/new-service.html \
  --title "新しいサービス"

# SEO チェック
node scripts/seo-pre-deploy.js pages/preview/new-service.html
```

### デプロイ前
```bash
# 承認を検出
node scripts/slack-feedback.js check-approvals

# デプロイ計画を投稿
node scripts/slack-feedback.js deploy-plan

# 承認後、実行
node scripts/slack-feedback.js deploy-execute
```

### 週末（金曜日）
```bash
# ページ管理 Excel を生成
python scripts/generate-status-xlsx.py

# SEO 週間サマリーを投稿
node scripts/slack-seo-proposer.js weekly-summary
```

---

## よくある質問

### Q: Slack Bot Token はどこから取得する？
**A:** Slack ワークスペースの管理画面 → アプリ → 当該アプリ → "OAuth & Permissions" → "Bot User OAuth Token" をコピー

### Q: チャンネル ID はどこから取得する？
**A:** Slack でチャンネルを開き、チャンネル名をクリック → チャンネル ID をコピー

### Q: WordPress REST API ユーザー名・パスワード（アプリケーションパスワード）は必須？
**A:** 推奨ですが、オプションです。セットアップウィザードで「オプション」と表示されたら入力をスキップできます。

### Q: 複数クライアント用に別々のプロジェクトを作成できる？
**A:** はい。各クライアント向けに以下を繰り返してください:
```bash
git clone https://github.com/itochaso/contentproducer-agents.git client-a-project
cd client-a-project
node scripts/setup-wizard.js
```

### Q: テンプレート内のスタブ（ahrefs-analyze.py 等）はいつ実装する？
**A:** 必要になったときです。最初は以下の5つのメインスクリプトで十分運用できます:
- setup-wizard.js
- slack-feedback.js
- slack-seo-proposer.js
- slack-data-ingest.js
- generate-status-xlsx.py

---

## 次に読むドキュメント

1. **scripts/README.md** — 各スクリプトの詳細なガイド
2. **scripts/TEMPLATE_MANIFEST.md** — テンプレート化の仕組み
3. **config.yaml** — すべての設定の説明（コメント参照）
4. **相親レディスホスピタルの実装例** — `/sessions/.../scripts/` フォルダ参照

---

## サポート

- **問題が発生した場合:** scripts/README.md の「トラブルシューティング」を参照
- **実装ガイドが必要な場合:** scripts/README.md の「実装ガイド」セクションを参照
- **GitHub Issues:** https://github.com/itochaso/contentproducer-agents/issues

---

**Happy deploying! 🚀**
