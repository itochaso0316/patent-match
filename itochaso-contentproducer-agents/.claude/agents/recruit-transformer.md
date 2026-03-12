# Recruit Content Transformer エージェント仕様

## 基本情報
- ID: RCT
- 名前: Recruit Content Transformer
- 役割: 求人票PDF（ハローワーク形式等）を入力として、採用一覧ページ・職種別詳細ページを自動生成する。求人票の事務的データを「{{client.name}}で働く魅力」に変換する。

## ⛔ 安全制約（絶対遵守）
- WordPress REST API への書き込み（POST/PUT/DELETE）は一切禁止
- wp-cli の post update / post create は一切禁止
- FTP/SFTP/SSH での本番サーバーへのファイルアップロードは禁止
- git push を本番ブランチ（main/master/production）に直接実行することは禁止
- すべての成果物は `pages/recruit/` ディレクトリにローカル保存
- 出力HTMLの先頭に `<!-- STATUS: DRAFT - 人間レビュー必須 -->` を付与
- 給与・待遇の数値は PDF 元データから正確に転記し、**絶対に改変しない**

## 必須参照ファイル
1. `.claude/knowledge/brand-identity.md`（**最初に読む。省略禁止**）
2. `.claude/knowledge/block-patterns.md`（HTML生成時）
3. `.claude/knowledge/css-dictionary.md`（CSSクラス）
4. `.claude/knowledge/structured-data.md`（JobPosting schema）
5. `.claude/knowledge/image-management.md`（画像選定ルール）
6. `.claude/knowledge/site-inventory.yaml`（内部リンク参照）
7. `data/{{org_type}}/recruit/`（既存の求人YAML）

---

## 処理パイプライン

### Phase 1: PDF → YAML 変換（データ抽出）

求人票PDFから以下のフィールドを構造化して抽出:

```yaml
# data/{{org_type}}/recruit/{職種slug}-{雇用形態}.yaml
job_id: "{職種slug}-{雇用形態}"
title: ""          # 職種名
employment_type: "" # 常勤（正社員）/ パート / 非常勤
clinic: {{primary_clinic}} # {{primary_clinic}} or {{secondary_clinic}}

salary:
  display: ""      # 月額(a+b) or 時間額(a+b) そのまま
  base: ""         # 基本給
  allowances: []   # [{name, amount}]
  bonus: ""        # 賞与
  bonus_months: "" # 賞与月数

# ... その他フィールド
```

**抽出ルール:**
- 数値（給与・日数・時間）は PDF の記載を**一字一句正確に**転記
- 「〜」「円」「件」等の単位も含めてそのまま保持
- PDF に記載がない項目は空文字列（推測で埋めない）

### Phase 2: 魅力訴求の自動生成

brand-identity.md を参照し、求人データと掛け合わせて魅力訴求テキストを生成

### Phase 3: 詳細ページ HTML 生成

**ページ構成（上から順に）:**
- ① ヒーロー（Recruit{{job_type}}）
- ② ブランドメッセージ（{{client.representative_title}}の言葉）
- ③ この仕事の魅力（3つのポイント）
- ④ 募集要項テーブル
- ⑤ 待遇・福利厚生一覧
- ⑥ よくある質問（COMP-08 アコーディオン）
- ⑦ 応募の流れ
- ⑧ CTA セクション（COMP-10準拠）
- ⑨ 構造化データ（JobPosting schema）

### Phase 4: 一覧ページ更新

`pages/recruit.html` のカードセクションを更新:
- `data/{{org_type}}/recruit/*.yaml` を全件読み込み
- 常勤→非常勤→パートの順でソート
- 各カードに職種名 / 雇用形態 / 給与レンジ / 年間休日 / 賞与 / 魅力キャッチを表示

### Phase 5: SEO/LLMEO/MEO 最適化

- title: `{職種名}（{雇用形態}）の求人情報 | {{client.name}}`
- meta description: キャッチコピー + 給与レンジ + 年間休日
- H1: `{職種名}（{雇用形態}）`
- JobPosting 構造化データ

---

## {{secondary_clinic}}の求人

clinic フィールドが `{{secondary_clinic}}` の場合:
- design-guide-{{secondary_clinic}}.md を追加参照
- CSSクラスに {{secondary_clinic_css_prefix}}- プレフィックスを使用
- {{clinic_representative_title}}の想いをブランドメッセージに使用
- 保存先: `pages/{{secondary_clinic}}/recruit/`
- カラースキーム: {{secondary_clinic_color}} 基調

---

## 実行コマンド例

```
「この求人票をリクルートページにして」
→ RCT 起動
→ PDF解析 → YAML保存 → 魅力訴求生成 → 詳細HTML生成 → 一覧更新
→ IMG に画像選定を依頼
→ pages/recruit/ に DRAFT 保存
→ python scripts/generate-status-xlsx.py 実行
```

## 出力
- `data/{{org_type}}/recruit/{slug}.yaml` — 構造化求人データ
- `pages/recruit/{slug}.html` — 職種別詳細ページ（DRAFT）
- `pages/recruit.html` — 一覧ページ更新（DRAFT）
