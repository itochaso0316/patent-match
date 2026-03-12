# {{client.name}} デザインガイド（テンプレート）

## ブランドカラー

| 名前 | slug | コード | 用途 |
|------|------|--------|------|
| Primary | primary | {{color.primary}} | ブランドカラー、CTA背景、アクセント |
| Primary Light | primary-light | {{color.primary_light}} | ホバー、補助色 |
| Primary Lighter | primary-lighter | {{color.primary_lighter}} | 淡いアクセント |
| Text | text | {{color.text}} | 本文テキスト |
| Text Light | text-light | {{color.text_light}} | サブテキスト |
| White | white | {{color.white}} | 背景（奇数セクション） |
| White Bis | white-bis | {{color.white_bis}} | 背景（淡色1） |
| White Ter | white-ter | {{color.white_ter}} | 背景（淡色2） |
| Black | black | {{color.black}} | 見出し等 |

## タイポグラフィ

- **本文**: {{typography.body_font}}, {{typography.body_size}}, line-height {{typography.body_line_height}}
- **英字見出し（subtitle）**: {{typography.subtitle_font}}
- **日本語見出し（title）**: {{typography.title_font}}, 太字
- **アイコン**: {{typography.icon_font}}

## フォントサイズ

| slug | サイズ | 用途 |
|------|--------|------|
| xsmall | {{font_size.xsmall}} | キャプション |
| small | {{font_size.small}} | 補足テキスト |
| normal | {{font_size.normal}} | 本文 |
| medium | {{font_size.medium}} | リード文 |
| large | {{font_size.large}} | 小見出し |
| x-large | {{font_size.xlarge}} | セクション見出し |

## セクション構成ルール

- 背景色は white → white-ter → white → white-bis と交互に
- 各セクションに title-group（英字subtitle + 日本語title）
- 左ボーダー装飾が自動付与（title-groupクラスによる）
- 最終セクション（CTA）は primary 背景

## レスポンシブ

- ブレークポイント: {{breakpoint.tablet}}px
- SP時: columns は縦積み、画像は全幅
- ボタンは SP 時 100%幅
- コンテンツ幅: {{layout.content_width}}（通常）/ {{layout.content_width_wide}}（ワイド）

## ボタン

- 通常リンク: btn-circle（丸ボタン＋矢印アイコン）
- 小リンク: btn-circle-xsmall
- CTA: cta-phone / cta-web
- 使用禁止: Lazy Block、WP標準ボタンブロック

## 画像

- サイズ: {{image.default_size}} を基本使用
- alt テキスト必須
- ファイル名は英数字のみ（日本語NG）
- PC/SP切り替えは picture 要素で実装

## トーン

- {{brand_tone.element1}}
- {{brand_tone.element2}}
- {{brand_tone.element3}}

## 見出し階層ルール（全ページ必須）

```
H1: ページタイトル（sr-only可、1ページに1つ必須）
  H2: セクション英語タイトル（subtitle）
    H3: セクション日本語タイトル（title）
      H4: サブセクション / カード見出し
```
