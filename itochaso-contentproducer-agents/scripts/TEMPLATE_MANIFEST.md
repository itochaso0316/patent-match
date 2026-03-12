# テンプレート化スクリプト マニフェスト

作成日: 2026-03-06
用途: マルチエージェント content producer システムを複数クライアント向けにテンプレート化

---

## セットアップウィザード（必須・最初に実行）

### setup-wizard.js（全新規作成）

**目的**: 対話式でプロジェクト初期設定を行い、config.yaml と .env を生成

**機能:**
- クライアント基本情報の質問（名前、ドメイン、業種、専門分野）
- ブランド情報の質問（代表者名、理念、差別化ポイント、創業年）
- WordPress 接続情報の質問（URL、REST API base、プレビュートークン）
- Slack チャンネル ID の質問（フィードバック、デプロイ、SEO、データ）
- 環境変数を .env ファイルに保存
- config.yaml に値を埋め込む
- .claude/knowledge/*.md 内の {{PLACEHOLDER}} を置換
- バリデーション実行

**出力:**
- `config.yaml` — プロジェクト設定ファイル
- `.env` — 環境変数（Slack tokens 等）
- テンプレート置換済み knowledge ファイル

**使い方:**
```bash
node scripts/setup-wizard.js
```

---

## メイン統合スクリプト（Misao から移植・テンプレート化）

### 1. slack-feedback.js（1558行）

**来源**: `/sessions/.../scripts/slack-feedback.js`

**テンプレート化内容:**
- ✅ WP_PREVIEW_BASE を config.yaml から読み込み
- ✅ PREVIEW_TOKEN を config.yaml から読み込み
- ✅ WP_PAGE_ID, LABEL_MAP: 各クライアント向けにカスタマイズ可能な構造に
- ✅ 日本語コメントは英語・日本語混在で保持
- ⚠️ 操レディス特有の細部は残存（カスタマイズ必須）

**主要サブコマンド:**
- `post` — プレビュー確認依頼を投稿（1件）
- `batch` — 複数ページを対話式で一括投稿
- `fetch` — Slack スレッドからフィードバックを取得
- `status` — ステータス表示
- `sync` / `check-approvals` — Slack スレッド同期・承認検出
- `deploy-plan` — デプロイ計画を投稿
- `deploy-execute` — デプロイ実行（WP REST API）

**カスタマイズポイント:**
```javascript
// ファイルパス → WordPress page ID マッピング
const WP_PAGE_ID = {
  'pages/preview/service1.html': 1234,
  'pages/preview/service2.html': 5678,
  // ... 各クライアント向けに入力
};

// ファイルパス → 日本語ラベルマッピング
const LABEL_MAP = {
  'pages/preview/service1.html': 'サービス1',
  // ...
};

// WordPress base URL を config.yaml から読み込み推奨
const CONFIG = require('../config.yaml');
const WP_PREVIEW_BASE = CONFIG.wordpress?.url || 'https://example.com';
```

**ファイルサイズ:** 62KB

---

### 2. slack-seo-proposer.js（500行）

**来源**: `/sessions/.../scripts/slack-seo-proposer.js`

**テンプレート化内容:**
- ✅ SLACK_SEO_CHANNEL_ID を env var で参照
- ✅ 競合リスト（seo-targets.yaml）を外部化
- ✅ 提案スコア計算ロジックは保持
- ⚠️ 操レディス用の提案メッセージ形式は残存

**主要サブコマンド:**
- `propose` — 競合分析し、提案を投稿（毎朝8時に自動実行推奨）
- `check-commands` — Slack スレッドから「作って」指令を検出
- `weekly-summary` — 週間サマリーを投稿（毎週月曜）
- `notify-complete` — 記事完成を通知
- `backlog` — 未採用提案を表示
- `status` — 提案・作成状況を表示

**カスタマイズポイント:**
```javascript
// config.yaml で競合リストを管理
const seo_targets = CONFIG.seo?.competitors || [];

// 提案メッセージテンプレート
const PROPOSAL_TEMPLATE = {
  title: "{{title}}",
  keyword: "{{keyword}}",
  score: "{{score}}",
  // ... カスタマイズ
};
```

**ファイルサイズ:** 25KB

---

### 3. slack-data-ingest.js（350行）

**来源**: `/sessions/.../scripts/slack-data-ingest.js`

**テンプレート化内容:**
- ✅ SLACK_DATA_CHANNEL_ID を env var で参照
- ✅ data/ ディレクトリ構造を外部化
- ✅ メッセージ分類ロジックは保持（カスタマイズ対象）
- ⚠️ 操レディス用の分類カテゴリ（実績、動画、施設等）は残存

**主要サブコマンド:**
- `fetch` — Slack から新着メッセージを取得
- `analyze` — 取り込みデータを分析
- `status` — 取り込み状況を表示
- `propose` — 更新提案を投稿

**カスタマイズポイント:**
```javascript
// データ分類カテゴリをカスタマイズ
const CATEGORIES = {
  '実績': '実績・成功事例',
  '動画': 'YouTube・Shorts',
  '想い': 'ブランド・理念',
  // ... 業種・クライアント向けに追加
};

// data/ ディレクトリ構成を config.yaml で定義
const DATA_STRUCTURE = CONFIG.data?.structure || {};
```

**ファイルサイズ:** 19KB

---

### 4. seo-pre-deploy.js（183行）

**来源**: `/sessions/.../scripts/seo-pre-deploy.js`

**テンプレート化内容:**
- ✅ 完全にクライアント非依存（チェック項目は汎用的）
- ✅ HTML チェックロジックはそのまま使用可能
- ✅ Markdown レポート出力もカスタマイズ不要

**チェック項目:**
- H1 タグが1個のみ
- すべての画像に alt 属性がある
- http:// リンクがない（https 推奨）
- 相対パス内部リンク（絶対パス非推奨）
- JSON-LD 構造化データの有無
- H2/H3 見出しの有無
- テキスト量（300文字以上推奨）

**出力:**
- stdout: JSON 配列（slack-feedback.js が受け取る）
- audits/seo-pre-deploy-YYYYMMDD.md: Markdown レポート

**ファイルサイズ:** 6.1KB

---

### 5. generate-status-xlsx.py（335行）

**来源**: `/sessions/.../scripts/generate-status-xlsx.py`

**テンプレート化内容:**
- ✅ WP_PREVIEW_BASE, PREVIEW_TOKEN を config.yaml から読み込み
- ✅ WP_PAGE_ID, LABEL_MAP: テンプレート化（config.yaml 参照指示）
- ✅ SECTIONS（ディレクトリ構成）: テンプレート化
- ✅ Excel スタイル（色、フォント等）はそのまま使用

**出力:**
- pages/preview/ページ管理.xlsx （3シート: アクティブ / アーカイブ / サマリー）

**カスタマイズが必須な部分:**
```python
# config.yaml で定義
WP_PAGE_ID = config['page_mappings']['wp_page_id']
LABEL_MAP = config['page_mappings']['label_map']
SECTIONS = config['sections']
```

**ファイルサイズ:** 15KB

---

## 補助スクリプト（スタブ・テンプレート版）

以下のスクリプトはスタブとして作成され、各クライアント向けに実装が必要です。

### Python ユーティリティ

#### ahrefs-analyze.py（2.5KB、新作）

**用途**: Ahrefs API から競合データを取得し、SEO 分析

**必要な実装:**
- Ahrefs API 呼び出しロジック
- 競合比較機能
- クイックウィン検出
- レポート生成

**参照ファイル:**
- `config.yaml` の `seo.competitors`, `seo.analysis` セクション
- `data/ahrefs/` CSV インポート

**実装ガイド:** scripts/README.md → "ahrefs-analyze 実装ガイド"

---

#### image-labeler.py（3.8KB、新作）

**用途**: Vision API で画像を分析し、alt テキストを自動生成

**必要な実装:**
- Vision API 統合（Claude Vision / GPT-4V など）
- alt テキスト生成ロジック
- メタデータ JSON 生成
- ブランドガイドライン適用

**参照ファイル:**
- `config.yaml` の `image_labeling` セクション
- `brand-identity.md` 参照（ブランド文脈）

**実装ガイド:** scripts/README.md → "image-labeler 実装ガイド"

---

#### image-sorter.py（3.6KB、新作）

**用途**: 画像を用途別に分類・整理、重複検出

**必要な実装:**
- 画像ファイルスキャン
- 分類アルゴリズム（Vision API or ファイル名パターン）
- ファイル名正規化
- 重複検出（MD5/SHA256）
- フォルダ整理

**参照ファイル:**
- `config.yaml` の `image_management` セクション

---

#### inventory-excel.py（4.3KB、新作）

**用途**: サイトインベントリ Excel を生成（ページ一覧、SEO メトリクス、WP ステータス）

**必要な実装:**
- pages/ ディレクトリスキャン
- HTML パース（title, meta description, H1 抽出）
- WordPress REST API 呼び出し（page status, date 取得）
- Excel 多シート生成（openpyxl）

**参照ファイル:**
- `config.yaml` の `wordpress` セクション
- `site-inventory.yaml`（ページ構造）

---

#### wp-media-upload.py（4.0KB、新作）

**用途**: ローカル画像を WordPress メディアライブラリに一括アップロード

**必要な実装:**
- 画像ファイルスキャン
- WordPress REST API /media エンドポイント呼び出し
- メタデータ設定（alt, 説明等）
- 重複チェック
- 進捗レポート

**参照ファイル:**
- `config.yaml` の `wordpress` セクション
- 環境変数: `WP_USERNAME`, `WP_APP_PASSWORD`

---

#### approval-server.py（4.5KB、新作）

**用途**: Flask ベースのデプロイ承認 Web サーバー

**必要な実装:**
- Flask ルート定義
- Slack イベント受け取り
- 承認フロー UI（HTML/JavaScript）
- ステータス管理（JSON）
- Slack へのコールバック

**参照ファイル:**
- `config.yaml` の `slack` セクション
- `slack-feedback.js` deploy フロー連携

---

## テンプレート化の仕組み

### config.yaml

**役割:** すべてのスクリプトの設定ファイル

**構成:**
```yaml
client:
  name: クライアント名
  domain: example.com
  industry: medical / dental / beauty / legal / realestate / restaurant / general
  area:
    primary_city: 市区町村
    prefecture: 都道府県

brand:
  owner_name: 代表者名
  philosophy: 理念

wordpress:
  url: https://example.com
  api_base: https://example.com/wp-json/wp/v2
  preview_token: preview-2026
  theme: custom

seo:
  target_keywords: { tier1, tier2, tier3 }
  competitors: [ { domain, name, area, category, note } ]
  analysis: { quickwin_range, max_kd, min_volume, ... }

slack:
  channels:
    feedback: C0...
    deploy: C0...
    seo_content: C0...
    data_ingest: C0...

# クライアント固有の拡張可能（page_mappings, sections, image_management等）
```

### .env ファイル

**役割:** 秘密情報（トークン等）を環境変数で管理

```bash
SLACK_BOT_TOKEN=xoxb-...
SLACK_CHANNEL_ID=C0...
SLACK_DEPLOY_CHANNEL_ID=C0...
SLACK_SEO_CHANNEL_ID=C0...
SLACK_DATA_CHANNEL_ID=C0...
WP_USERNAME=（オプション）
WP_APP_PASSWORD=（オプション）
AHREFS_API_KEY=（オプション）
```

### テンプレート置換機構

**目的:** setup-wizard.js が {{PLACEHOLDER}} を置換

**対象ファイル:**
- `.claude/knowledge/*.md`
- `.claude/knowledge/*.yaml`

**置換例:**
```
{{CLIENT_NAME}}        → 操レディスホスピタル
{{CLIENT_SHORT}}       → 操レディス
{{DOMAIN}}             → misao-ladies.jp
{{WP_URL}}             → https://www.misao-ladies.jp
{{PREVIEW_TOKEN}}      → misao-preview-2026
{{OWNER_NAME}}         → 森 誠一郎
{{PHILOSOPHY}}         → 「患者様の幸せを第一に」
{{PRIMARY_CITY}}       → 岐阜市
{{PREFECTURE}}         → 岐阜県
```

---

## ファイルリスト（全13ファイル）

### Node.js スクリプト

| ファイル | サイズ | 状態 | 説明 |
|---------|--------|------|------|
| `setup-wizard.js` | 13KB | 新規 | セットアップウィザード（全新規作成） |
| `slack-feedback.js` | 62KB | 移植・テンプレート化 | Slack フィードバック・デプロイ連携 |
| `slack-seo-proposer.js` | 25KB | 移植・テンプレート化 | SEO コンテンツ提案 |
| `slack-data-ingest.js` | 19KB | 移植・テンプレート化 |院長データ自動取り込み |
| `seo-pre-deploy.js` | 6.1KB | 移植・汎用 | SEO プリデプロイチェック |

### Python スクリプト

| ファイル | サイズ | 状態 | 説明 |
|---------|--------|------|------|
| `generate-status-xlsx.py` | 15KB | 移植・テンプレート化 | ページ管理 Excel 生成 |
| `ahrefs-analyze.py` | 2.5KB | スタブ | Ahrefs 競合分析（実装必須） |
| `image-labeler.py` | 3.8KB | スタブ | 画像 alt テキスト自動生成（実装必須） |
| `image-sorter.py` | 3.6KB | スタブ | 画像分類・整理（実装必須） |
| `inventory-excel.py` | 4.3KB | スタブ | サイトインベントリ Excel（実装必須） |
| `wp-media-upload.py` | 4.0KB | スタブ | 画像一括アップロード（実装必須） |
| `approval-server.py` | 4.5KB | スタブ | デプロイ承認 Web サーバー（実装必須） |

### ドキュメント

| ファイル | サイズ | 説明 |
|---------|--------|------|
| `README.md` | 11KB | スクリプト使用ガイド・ワークフロー例 |
| `TEMPLATE_MANIFEST.md` | このファイル | テンプレート化マニフェスト |

---

## デプロイ手順

### 新しいクライアント向けセットアップ

```bash
# 1. リポジトリをクローン
git clone https://github.com/itochaso/contentproducer-agents.git client-project
cd client-project

# 2. セットアップウィザードを実行
node scripts/setup-wizard.js

# 3. config.yaml, .env を確認
cat config.yaml
cat .env
# ⚠️ .env は絶対に公開リポジトリに含めない
echo ".env" >> .gitignore

# 4. 動作確認
node scripts/slack-feedback.js status
python scripts/generate-status-xlsx.py

# 5. スタブの実装（必要に応じて）
# scripts/ahrefs-analyze.py の実装
# scripts/image-labeler.py の実装
# ...
```

### 本番環境での実行

```bash
# 環境変数をロード
source .env

# または、暗号化版から復号
bash scripts/env-decrypt.sh

# スクリプト実行
node scripts/slack-feedback.js post --url pages/preview/service.html --title "新サービス"
```

---

## 注意事項

### セキュリティ

- ✅ .env は .gitignore に追加（絶対必須）
- ✅ Slack Bot Token は環境変数で管理（コードに埋め込み禁止）
- ✅ WordPress REST API パスワードも環境変数で管理
- ✅ 本番環境では .env を AES-256-CBC で暗号化推奨
  ```bash
  bash scripts/env-encrypt.sh
  ```

### カスタマイズポイント

1. **WP_PAGE_ID, LABEL_MAP** — slack-feedback.js, generate-status-xlsx.py
   - 各クライアントの ページ ← → WordPress ID マッピングを定義

2. **SECTIONS** — generate-status-xlsx.py
   - ディレクトリ構成（本院、サービス、採用等）をカスタマイズ

3. **SEO targets** — slack-seo-proposer.js
   - 競合リスト（最大15社）を定義

4. **メッセージテンプレート** — slack-*.js
   - クライアント固有の通知形式にカスタマイズ

5. **スタブ実装** — ahrefs-analyze.py, image-labeler.py 等
   - Vision API の選択（Claude / GPT-4V / 独自）
   - ブランドガイドラインの適用

---

## 関連リソース

- **GitHub:** https://github.com/itochaso/contentproducer-agents
- **Wiki:** https://github.com/itochaso/contentproducer-agents/wiki
- **実装ガイド:** scripts/README.md 参照

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2026-03-06 | 初版作成・テンプレート化完了 |

