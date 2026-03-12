# PatentMatch.jp コンテンツ制作・運用プロジェクト

PatentMatch.jp（patent-match.jp）の Hugo 静的サイトをマルチエージェントシステムで継続的に改善する。

## ディレクトリ構成
- テーマ: `themes/patent-modern/` — Tailwind CSSベースのカスタムHugoテーマ
- コンテンツ: `content/` — Markdownファイル（6セクション）
- ナレッジ: `.claude/knowledge/` — エージェント参照用ドキュメント
- エージェント: `.claude/agents/` — エージェント定義
- データ: `data/` — 特許データJSON（BigQuery/OpenClaw経由）
- スクリプト: `scripts/` — 記事生成・データ取得
- 設定: `config.yaml` — プロジェクト設定

## コンテンツセクション
| セクション | パス | 内容 |
|-----------|------|------|
| 特許活用ガイド | content/guide/ | 特許の基礎・活用方法 |
| ライセンス実務 | content/license/ | ライセンス契約・収益化 |
| 特許売却・譲渡 | content/sell/ | 売却の相場・手続き |
| マッチング | content/matching/ | マッチングサービス・戦略 |
| 調査ツール | content/tools/ | J-PlatPat・Espacenet等 |
| エージェント | content/agents/ | 弁理士・知財コンサルタント |

## 元データ参照ルール
`data/` に特許データ（BigQuery + OpenClawクロール）を格納。
- `data/ai_patents.json` — AI関連特許データ
- `data/bio_patents.json` — バイオ関連特許データ
- `data/green_patents.json` — グリーン技術特許データ
- **コンテンツ制作時は必ず `data/` 内のデータを参照し、最新の特許動向を反映する**

## OpenClaw 連携（Mac mini）
- OpenClawがMac mini上で特許データをクロール
- Gitで同期: `content/*` ブランチにMarkdownをpush
- frontmatter に `draft: true` + `source: "openclaw"` で追加
- GitHub ActionsでHugoビルドチェック → PRレビュー → main merge → 自動デプロイ

## 安全制約（最重要・全エージェント共通）
- `main` ブランチへの直接pushは禁止（PR経由のみ）
- コンテンツは `content/` 配下にMarkdownとして保存
- 新規記事のfrontmatterに `draft: true` を設定（人間レビュー後に false に）
- 全記事に required frontmatter: title, date, description, categories
- デプロイは Git merge → Cloudflare Pages 自動ビルド

## デプロイフロー（Git + Cloudflare Pages）
```
1. 記事作成 → content/[section]/[YYYY-MM-DD]-[slug].md に保存（draft: true）
2. CQG（Content Quality Guard）が品質スコアリング → Aランク以上で次へ
3. git checkout -b content/[slug] && git add && git commit
4. git push origin content/[slug] → GitHub Actions がHugoビルドチェック
5. PR作成 → プレビューURL: https://[hash].patent-match.pages.dev/
6. 人間がPRレビュー → draft: false に変更 → Approve
7. main にmerge → Cloudflare Pages自動デプロイ → https://patent-match.jp/
```

## SEO競合コンテンツ提案フロー
```
1. 週1回（月曜9時）: SCP エージェントが競合監視 → コンテンツ提案を自動生成
2. audits/seo-proposals/weekly-YYYYMMDD.json に提案データ保存
3. 人間が「作って」と指示 → CST → WRT パイプラインで記事作成
4. 以降は通常のデプロイフローへ
```
- **記事の自動作成は行わない**。指示があって初めて作成を開始
- 競合リスト: `seo-targets.yaml`

## エージェント自動ディスパッチ

**手順**: 指示を受けたら → 下表でエージェント特定 → `agents/*.md` を Read → 各エージェントの「必須参照ファイル」を Read → 実行 → 安全確認

| キーワード | エージェント（agents/） | 追加 knowledge |
|-----------|----------------------|----------------|
| 記事, コラム, リデザイン | articles-redesigner.md | design-guide.md, structured-data.md |
| 監査, 問題点, チェック | auditor-ui.md + auditor-content.md | component-rules.md, design-guide.md |
| デザイン, スタイル, CSS, Tailwind | designer.md | design-guide.md, css-dictionary.md |
| テキスト, コンテンツ, 執筆 | content-strategist.md → writer.md | brand-identity.md |
| Markdown, ビルド, 生成 | builder.md | component-rules.md |
| デプロイ, 公開, merge, 反映 | deployer.md | site-inventory.yaml |
| 内部リンク, リンク | link-optimizer.md | site-inventory.yaml |
| SEO, 検索, LLMEO | seo-aieo-meo-monitor.md | structured-data.md |
| 競合, コンテンツ提案, 記事提案 | seo-content-proposer.md | seo-targets.yaml, brand-identity.md |
| クロール, 全ページ, サイト構造 | crawler.md | site-inventory.yaml |
| ブランド, 想い, 理念 | brand-researcher.md | brand-identity.md |
| 構成案, 戦略, コンテンツ設計 | content-strategist.md | brand-identity.md, site-inventory.yaml |
| 品質, noindex, カニバリ, スコア | content-quality-guard.md | brand-identity.md, structured-data.md |
| 行政, 特許法, 知財政策 | government-policy-monitor.md | site-inventory.yaml |
| OpenClaw, データ同期, 取り込み | data-ingest.md | brand-identity.md |

## コンテンツ制作の鉄則
**順序**: 専門知識（Expertise）→ 実績データ（Evidence）→ 読者への共感（Emotion）→ SEO/LLMEO
- brand-identity.md を読まずにコンテンツを書かない
- data/ 内の特許データを必ず参照する
- 全テキストで自問:「この文章はPatentMatch.jpでなくても書けるか？」→ YES なら書き直す

## Markdown / HTML 共通ルール
- コンテンツはMarkdown形式（Hugo shortcode使用可）
- Tailwind CSSクラスを使用（インラインスタイル禁止）
- 全画像に alt 必須、内部リンクは相対パス
- 見出し: H1(title) → H2(セクション) → H3(サブセクション) → H4
- shortcodes: `callout`（注意書き）、`faq`（FAQ アコーディオン）
- ボタン: btn-primary / btn-secondary / btn-outline

## Hugo Frontmatter テンプレート
```yaml
---
title: "記事タイトル"
date: YYYY-MM-DD
draft: true
categories:
  - "guide"  # guide / license / sell / matching / tools / agents
tags:
  - "特許"
  - "タグ名"
description: "記事の説明（160文字以内）"
image: "/images/article-name.jpg"  # 任意
source: "manual"  # manual / openclaw / generated
---
```

## 品質基準
- PC(1280px)とSP(375px)両対応
- Tailwind既存クラス優先、新規CSS最小限
- Lighthouse: Performance 90+, SEO 90+, Accessibility 95+
- 全変更に git commit（セマンティックコミットメッセージ）
