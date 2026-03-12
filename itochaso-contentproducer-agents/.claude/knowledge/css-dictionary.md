# CSSクラス辞書（テンプレート）

テーマで使用可能なCSSクラス一覧。新規クラスの追加は Designer（DSG）が行い、人間の承認後にこのファイルに追記する。

## レイアウト・余白

| クラス | 効果 | 使用場面 |
|--------|------|----------|
| `section` | セクション基本 + inViewアニメーション対象 | 全セクション |
| `inview` | スクロールアニメーション対象 | section内の要素 |
| `is-fadein` | フェードインアニメーション | アニメーション要素 |
| `container` | コンテンツ幅制限 | セクション内ラッパー |
| `gap-20` | 20pxギャップ | columns間 |
| `gap-40-60` | SP:40px / PC:60px ギャップ | columns間 |
| `gap-60` | 60px固定ギャップ | columns間 |
| `mb-30` | margin-bottom: 30px | 要素間余白 |
| `mb-40-60` | SP:40px / PC:60px margin-bottom | セクション間余白 |
| `mt-30` | margin-top: 30px | 要素間余白 |
| `mt-40` | margin-top: 40px | 要素間余白 |
| `pt-60-tablet` | タブレット以上でpadding-top: 60px | セクション上余白 |

## テキスト

| クラス | 効果 | 使用場面 |
|--------|------|----------|
| `title` | セクション日本語タイトル | title-group内H3 |
| `subtitle` | 英字サブタイトル（Playfair Display） | title-group内H2 |
| `title-group` | タイトルグループ（左ボーダー付き） | セクション見出し |
| `is-pagetitle` | ページヒーロー用タイトルグループ | COMP-01内 |
| `text-lead` | リード文スタイル | セクション冒頭文 |
| `font-size-14` | 14px | 補足テキスト |
| `font-size-12-mobile` | SP時12px | モバイル小文字 |
| `is-24-42` | clamp(24px, -, 42px) | レスポンシブ見出し |
| `is-sr-only` | スクリーンリーダー専用（非表示） | SEO用H1 |

## 表示制御

| クラス | 効果 |
|--------|------|
| `is-hidden` | 非表示 |
| `is-hidden-mobile` | SP非表示 |
| `is-hidden-tablet` | タブレット以上で非表示 |
| `is-pull-x-mobile` | SP時に横幅拡張 |
| `is-medium-mobile` | SP時にメディアサイズ変更 |

## ボタン

| クラス | 効果 |
|--------|------|
| `btn` | 基本ボタン |
| `btn-circle` | 丸ボタン（大） |
| `btn-circle-small` | 丸ボタン（中） |
| `btn-circle-xsmall` | 丸ボタン（小） |
| `btn-area` | ボタンエリア拡張 |

## アイコン

| クラス | 表示 |
|--------|------|
| `icon-arrow` | 矢印 → |
| `icon-phone` | 電話アイコン |
| `icon-mail` | メールアイコン |

## コンポーネント固有

| クラス | 効果 | COMP |
|--------|------|------|
| `cover` | ページヒーロー | COMP-01 |
| `accordion` | アコーディオンラッパー | COMP-08 |
| `js-accordion` | JSアコーディオン | COMP-08 |
| `js-accordion-target` | 各Q&Aアイテム | COMP-08 |
| `js-accordion-title` | 質問テキスト | COMP-08 |
| `faq-list` | FAQリスト | COMP-08 |
| `cta-section` | CTAセクション | COMP-10 |
| `cta-buttons` | CTAボタン群 | COMP-10 |
| `cta-phone` | 電話CTAボタン | COMP-10 |
| `cta-web` | WEB予約CTAボタン | COMP-10 |

## ブランド別クラス（複数ブランド使用時）

### ブランチ/支社の場合

| クラス | 効果 | 対象 |
|--------|------|------|
| `branch-hero` | ブランチヒーロー | COMP-01 |
| `branch-title-group` | ブランチ用title-group | COMP-03 |
| `branch-btn-circle` | ブランチ用丸ボタン大 | COMP-04-A |
| `branch-btn-circle-xsmall` | ブランチ用丸ボタン小 | COMP-04-B |
| `branch-faq-list` | ブランチ用FAQ | COMP-08 |
| `branch-cta-section` | ブランチ用CTA | COMP-10 |
| `branch-bg-white` | ブランチ背景色1 | COMP-02 |
| `branch-bg-secondary1` | ブランチ背景色2 | COMP-02 |
| `branch-bg-secondary2` | ブランチ背景色3 | COMP-02 |

## WP自動生成（注意）

| クラス | 説明 |
|--------|------|
| `has-{color}-background-color` | 背景色（theme.json準拠） |
| `has-{color}-color` | テキスト色 |
| `has-text-color` | テキスト色有り |
| `has-background` | 背景色有り |
| `has-link-color` | リンク色有り |
| `alignfull` | 全幅 |
| `size-large` | 画像サイズ large |
| `size-full` | 画像サイズ full |

## ユーティリティ

| クラス | 効果 |
|--------|------|
| `text-center` | テキスト中央寄せ |
| `text-right` | テキスト右寄せ |
| `no-wrap` | テキスト折返し禁止 |
| `clearfix` | フロート初期化 |
