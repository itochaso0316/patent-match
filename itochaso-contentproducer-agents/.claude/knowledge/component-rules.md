# コンポーネント使用ルール（テンプレート）

## コンポーネント選択フローチャート

```
新しいセクションを作る
  ├── ページ最上部？ → COMP-01（ページヒーロー）
  ├── ページ最下部？ → COMP-10（CTAセクション）
  └── 中間セクション？ → COMP-02（セクションフレーム）で囲む
        ├── タイトルが必要？ → COMP-03（セクションタイトル）を配置
        └── コンテンツの種類は？
              ├── 情報紹介 → COMP-05（情報カード）
              ├── FAQ / Q&A → COMP-08（アコーディオン）※リスト禁止
              ├── PC/SP画像切替 → COMP-11（レスポンシブ画像）
              ├── アクションボタン → COMP-04（ボタン3種から選択）
              │     ├── メイン導線 → COMP-04-A（丸ボタン大）
              │     ├── 補助導線 → COMP-04-B（丸ボタン小）
              │     └── テキスト内リンク → COMP-04-C（テキストボタン）
              └── 上記に該当しない → 標準WPブロック（wp:paragraph, wp:heading, wp:columns等）
```

## 使用禁止リスト

| 禁止項目 | 代替 |
|---------|------|
| Lazy Block (`wp:lazyblock/*`) | 該当COMPのwp:html版 |
| WP標準ボタンブロック (`wp:buttons`) | COMP-04 |
| インラインスタイル（余白系） | CSSユーティリティクラス（mb-30, gap-40-60等） |
| 直接H2のみのタイトル | COMP-03（title-group） |
| リスト/段落でのFAQ表示 | COMP-08（アコーディオン） |
| HTTP / 旧IP URL | HTTPS + ドメイン名 |

## 新規コンポーネント追加手順

1. DSG（Designer）が設計・HTML構造を提案
2. block-patterns.md にCOMP-XX として追記
3. 人間（責任者）が承認
4. 承認後、BLD（Builder）が使用開始

## ブランド別カラー使用ルール

- **メインサイト**: 標準カラー変数を使用（primary, white-bis等）
- **ブランチ/支社**: `--branch-` プレフィックス付きクラスのみ使用
  - `.branch-btn-circle` / `.branch-btn-circle-xsmall` を使用
  - `.btn-circle` / `.btn-circle-xsmall` は使用禁止
- **複数ブランドがある場合**: 必ずテンプレートで色分けする

## 背景色ローテーション確認表

| 順番 | 背景色 | slug | カラーコード |
|------|--------|------|------------|
| 1 | 白 | white | {{color.white}} |
| 2 | 薄グレー | white-ter | {{color.white_ter}} |
| 3 | 白 | white | {{color.white}} |
| 4 | 薄色 | white-bis | {{color.white_bis}} |
| 5 | 白 | white | {{color.white}} |
| CTA | ブランドカラー | primary | {{color.primary}} |

## テンプレート/ページの選択

- **メインサイト ページ**: `page` テンプレート使用
- **メインサイト 記事**: `single` テンプレート使用
- **ブランチ ページ**: `page-branch` テンプレート使用（ヘッダー/フッター自動切替）
- **ブランチ 記事**: `single-branch` テンプレート使用

## CTA要素の確認

### 電話番号・予約URLの分岐
```
if {{client.is_multi_brand}}:
  ├── メインサイト CTA → {{client.phone}} / {{client.reservation_url}}
  ├── ブランチ1 CTA → {{branch1.phone}} / {{branch1.reservation_url}}
  └── ブランチ2 CTA → {{branch2.phone}} / {{branch2.reservation_url}}
else:
  └── CTA → {{client.phone}} / {{client.reservation_url}}
```

各ブランドの電話番号と予約URLが正しいことを必ず確認してからページ公開。
