# Cowork ⟷ OpenClaw データ連携プロトコル

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────────┐
│                    Git Repository (GitHub)                       │
│                                                                 │
│  data/requests/    ← Coworkが「欲しいデータ」を書く             │
│  data/crawled/     ← OpenClawが「取得したデータ」を置く          │
│  data/openclaw/    ← OpenClawが「自主的に発見した情報」を置く    │
│  strategy/         ← Coworkが「コンテンツ戦略」を書く           │
│  content/          ← 両者が記事を生成・編集する                  │
│                                                                 │
│  ┌──────────┐  git push/pull   ┌──────────────┐                │
│  │ Cowork   │ ←──────────────→ │ OpenClaw     │                │
│  │ (Brain)  │                  │ (Mac mini)   │                │
│  └──────────┘                  └──────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

## 1. データリクエスト（Cowork → OpenClaw）

Coworkが `data/requests/` にYAMLファイルを置く。
OpenClawはこのディレクトリを監視し、`status: pending` のリクエストを処理する。

### ファイル命名規則
```
data/requests/REQ-YYYYMMDD-NNN.yaml
```

### リクエストフォーマット
```yaml
id: "REQ-20260312-001"
status: "pending"          # pending → in_progress → completed → used
priority: "high"           # high / medium / low
requested_by: "cowork"
requested_at: "2026-03-12T09:00:00+09:00"
category: "competitor"     # competitor / patent-data / market / regulation / tool
title: "競合サイトのコンテンツ構成分析"
description: |
  tokkyo.ai と ipbase.go.jp のトップ記事10件ずつのタイトル・URL・
  推定文字数・見出し構成（H2/H3）を取得してほしい。
targets:
  - url: "https://tokkyo.ai/blog/"
    scope: "latest-10-articles"
  - url: "https://ipbase.go.jp/learn/"
    scope: "latest-10-articles"
output_format: "json"      # json / csv / markdown
output_path: "data/crawled/competitor-content-analysis.json"
deadline: "2026-03-13"
notes: "SEOコンテンツ戦略の立案に使用"
```

### ステータス遷移
```
pending → in_progress（OpenClawが着手）
       → completed（データ取得完了、output_pathにファイル配置）
       → failed（取得失敗、reason記載）
       → used（Coworkがデータを使用済み）
```

## 2. 自主クロールデータ（OpenClaw → Cowork）

OpenClawは `data/openclaw/` に自主的に発見した情報を配置する。
Coworkはこのディレクトリを定期的にチェックし、戦略に組み込む。

### ファイル命名規則
```
data/openclaw/YYYYMMDD-[category]-[slug].yaml
```

### 自主データフォーマット
```yaml
id: "OC-20260312-001"
source: "openclaw"
crawled_at: "2026-03-12T08:00:00+09:00"
category: "patent-trend"   # patent-trend / regulation / competitor / opportunity
title: "2026年Q1 AI特許出願トレンド"
summary: |
  2026年1-3月のAI関連特許出願数が前年同期比25%増。
  特にLLM応用特許と医療AI特許が急増。
data_type: "structured"    # structured / raw-text / urls
data: { ... }              # or data_file: "path/to/data.json"
relevance: "high"          # サイトコンテンツとの関連度
suggested_articles:
  - title: "2026年AI特許トレンド速報：LLM応用特許が急増"
    section: "guide"
    keywords: ["AI特許", "LLM特許", "2026年"]
reviewed: false            # Coworkがレビュー済みか
```

## 3. コンテンツ戦略（Cowork → OpenClaw & 記事生成）

Coworkが `strategy/` にコンテンツ戦略を書く。
OpenClawはこれを参照して、必要なデータを先回りで取得する。

### 戦略ファイル
```
strategy/content-calendar.yaml    — 記事カレンダー
strategy/keyword-targets.yaml     — 狙うキーワード一覧
strategy/data-needs.yaml          — 今後必要なデータ一覧
strategy/competitor-watch.yaml    — 競合監視リスト
```

## 4. 記事生成フロー（双方向）

```
[Cowork] strategy/ にコンテンツ計画を書く
    ↓
[Cowork] data/requests/ に必要データをリクエスト
    ↓  (git push)
[OpenClaw] リクエストを検出 → クロール → data/crawled/ に配置
    ↓  (git push)
[Cowork] data/crawled/ のデータを読む
    ↓
[Cowork] CST → WRT → BLD → CQG パイプラインで記事生成
    ↓
[Cowork] content/[section]/YYYY-MM-DD-slug.md に保存 (draft: true)
    ↓  (git push)
[人間] PRレビュー → draft: false → merge → 自動デプロイ
```

### OpenClawの自主フロー
```
[OpenClaw] 定期クロール → 新しい特許データ / 競合動向を発見
    ↓
[OpenClaw] data/openclaw/ に発見データを配置
    ↓  (git push)
[Cowork] 自主データを検出 → 戦略に組み込む → 記事候補を生成
    ↓
（以降は上記フローと同じ）
```

## 5. Git ブランチルール

| 操作者 | ブランチ | 内容 |
|--------|---------|------|
| OpenClaw | `data/crawl-YYYYMMDD` | クロールデータの追加 |
| OpenClaw | `content/oc-[slug]` | OpenClaw起案の記事ドラフト |
| Cowork | `content/cw-[slug]` | Cowork起案の記事ドラフト |
| Cowork | `strategy/update` | 戦略ドキュメントの更新 |
| 両方 | `main` | マージ先（自動デプロイ） |

## 6. OpenClaw自主クロール設定

`data/openclaw/crawl-config.yaml` でOpenClawの自律行動を制御する。
