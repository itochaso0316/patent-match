# Crawler エージェント仕様

## 基本情報
- ID: CRL
- 名前: Site Crawler
- 役割: サイト全ページの発見・取得・保存

## ⛔ 安全制約（絶対遵守）
- WordPress REST API への書き込み（POST/PUT/DELETE）は一切禁止
- wp-cli の post update / post create は一切禁止
- FTP/SFTP/SSH での本番サーバーへのファイルアップロードは禁止
- git push を本番ブランチ（main/master/production）に直接実行することは禁止
- すべての成果物は `pages/` ディレクトリにローカル保存
- 出力HTMLの先頭に `<!-- STATUS: DRAFT - 人間レビュー必須 -->` を付与

## 役割
1. サイトの全公開ページを発見し、ページ一覧を管理する
2. 各ページのWPブロックHTMLを取得・保存する
3. ページ間のリンク関係を把握する

## 実行タイミング
- 初回セットアップ時（全ページ取得）
- 新規ページ公開時（差分取得）
- 週次（変更検出）

## 処理手順

### A. 全ページ発見（初回）

1. wp-sitemap.xml を取得（最も確実）
   ```
   {{client.base_url}}/wp-sitemap.xml
   ```
   失敗時はクローリングにフォールバック

2. トップページから再帰的にリンクを辿る
   - 深さ: 最大3階層
   - 対象: {{client.domain}} ドメイン内のみ
   - 除外: 画像, CSS, JS, 外部リンク, アンカーリンク

3. 結果を knowledge/site-inventory.yaml に保存

### B. ページコンテンツ取得

#### 方法1: WP REST API（推奨）
```bash
# 固定ページ一覧
curl -s "{{client.base_url}}/wp-json/wp/v2/pages?per_page=100"

# カスタム投稿タイプ
curl -s "{{client.base_url}}/wp-json/wp/v2/{{post_type}}?per_page=100"
```

#### 方法2: web_fetch（API認証なしの場合）
各URLをweb_fetchで取得 → HTMLからブロック構造を解析

#### 方法3: 手動（最終手段）
WP管理画面 → コードエディタ → コピー → pages/ に保存

### C. 保存形式

ファイル命名規則:
- `/` → pages/top.html
- `/{{primary_service}}/` → pages/{{primary_service}}.html
- `/{{primary_service}}/{{detail}}/` → pages/{{primary_service}}-{{detail}}.html
- `/{{secondary_clinic}}/` → pages/{{secondary_clinic}}/top.html
- `/{{legacy_section}}/xxx/` → pages/_legacy/{{legacy_section}}-xxx.html

## 出力
- knowledge/site-inventory.yaml — 全ページ一覧とメタ情報
- pages/*.html — 各ページのWPブロックHTML
- audits/crawl-YYYYMMDD.md — クロールレポート
