# {{branch.name}} デザインガイド（テンプレート）

## 概要

{{client.name}} の{{branch.name}}における独自デザインルール。
メインサイトとは明確に差別化されたデザイン体系を採用。

## カラーパレット

### プライマリカラー

| トークン | 値 | 用途 |
|---------|-----|------|
| --branch-primary | {{branch_color.primary}} | メインカラー、ボタン、アクセント |
| --branch-primary-dark | {{branch_color.primary_dark}} | ホバー、CTAグラデーション |
| --branch-primary-light | {{branch_color.primary_light}} | ボタンボーダー、リンクホバー |
| --branch-primary-lighter | {{branch_color.primary_lighter}} | 区切り線、ヘッダー下線 |

### 背景色

| トークン | 値 | 用途 |
|---------|-----|------|
| --branch-bg-white | {{branch_color.bg_white}} | メイン背景 |
| --branch-bg-secondary1 | {{branch_color.bg_secondary1}} | セクション背景（偶数2） |
| --branch-bg-secondary2 | {{branch_color.bg_secondary2}} | セクション背景（偶数4） |

### テキストカラー

| トークン | 値 | 用途 |
|---------|-----|------|
| --branch-text | {{branch_color.text}} | 本文テキスト |
| --branch-text-light | {{branch_color.text_light}} | 補足テキスト、リード文 |

### アクセントカラー

| トークン | 値 | 用途 |
|---------|-----|------|
| --branch-accent | {{branch_color.accent}} | 高級感演出用アクセント |

## メインサイトとの比較

| 要素 | メインサイト | {{branch.name}} |
|------|-----------|-------------|
| プライマリ | {{color.main_primary}} | {{branch_color.primary}} |
| 背景 | {{color.main_bg}} | {{branch_color.bg_white}} |
| テキスト | {{color.main_text}} | {{branch_color.text}} |
| 印象 | {{brand_tone.main}} | {{branch_tone}} |

## フォント

メインサイトと同系統を使用:
- 英語見出し: {{typography.subtitle_font}}（エレガント）
- 日本語本文: {{typography.body_font}}（可読性重視）
- font-size, line-height はメインサイトと共通の theme.json 設定を使用

## 背景色ローテーション

全ページで以下のパターンを必ず守る:

```
セクション1: --branch-bg-white
セクション2: --branch-bg-secondary1
セクション3: --branch-bg-white
セクション4: --branch-bg-secondary2
セクション5: --branch-bg-white
最終CTA:     --branch-primary グラデーション
```

注意: メインサイトのクラスではなく、`--branch-` プレフィックス付きクラスを使用する。

## コンポーネント対応表

COMP-01〜11 の構造は共通。CSSクラスで色・装飾を変更:

| COMP | メインサイト版 | {{branch.name}}版 | 差分 |
|------|------------|-------------|------|
| COMP-01 ヒーロー | .cover | .branch-hero .cover | グラデーション背景 |
| COMP-02 セクション | has-white-ter-background-color 等 | .branch-bg-* | 背景色変更 |
| COMP-03 タイトル | .title-group | .branch-title-group | ボーダー色変更 |
| COMP-04 ボタン | .btn-circle / .btn-circle-xsmall | .branch-btn-circle / .branch-btn-circle-xsmall | カラー変更 |
| COMP-08 FAQ | .faq-list | .branch-faq-list | ボーダー色変更 |
| COMP-10 CTA | .cta-section | .branch-cta-section | グラデーション・ボタンデザイン変更 |

## ボタン使用ルール

- 使用可能: branch-btn-circle（大）, branch-btn-circle-xsmall（小）
- メインサイトの btn-circle / btn-circle-xsmall は使用禁止
- 記述方法: 必ず wp:html で記述（メインサイトと同じルール）

## CTAセクション

{{branch.name}}専用のCTAコンポーネント:
- .branch-cta-section: グラデーション背景（primary → primary-dark）
- .branch-cta-phone: 白背景の電話ボタン
- .branch-cta-web: 半透明の予約ボタン
- 電話番号・予約URLは{{branch.name}}のもの（メインサイトとは異なる）

## ヘッダー・フッター

### ヘッダー
- テンプレートパーツ: parts/header-branch.html
- CSSクラス: .header-branch
- 装飾: 下部にグラデーションライン
- ロゴ: {{branch.name}}専用ロゴ
- ナビゲーション: {{branch_navigation}}

### フッター
- テンプレートパーツ: parts/footer-branch.html
- CSSクラス: .footer-branch
- 背景: --branch-text
- 住所: {{branch.address}}
- ナビゲーション: {{branch_footer_navigation}}

## レスポンシブ対応

PCとSP共通の設計原則:
- ブレークポイント: {{breakpoint.tablet}}px（メインサイトと共通）
- SPではCTAボタンを縦並びに変更
- カードの角丸をSPでは{{responsive.card_radius_sp}}に縮小（PC: {{responsive.card_radius_pc}}）

## CSSファイル

- パス: {{theme_path}}/assets/css/branch.css
- 読み込み条件: page-branch テンプレート使用ページのみ
- :root でCSS custom properties を定義
- メインサイトのスタイルを上書きせず、--branch- プレフィックスで独立管理
