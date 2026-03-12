# 画像管理ルール（テンプレート）

## 1. 格納場所

### WordPress メディアライブラリ（本番）
```
/public/wp-content/uploads/YYYY/MM/  ← WP標準のアップロード先
```
- 本番画像はすべてここに格納される
- WPメディアライブラリから管理

### ローカル作業用（エージェント管理）
```
data/{{client.slug}}/images/
  ├── inventory/          ← 画像台帳（YAML）
  │   └── image-inventory.yaml
  ├── canva-templates/    ← Canvaテンプレート情報
  │   └── canva-templates.yaml
  ├── generated/          ← Canva APIで生成した画像
  │   └── YYYYMMDD-{用途}-{slug}.{ext}
  └── canva-instructions/ ← API未使用時の手動作成指示書

data/{{branch.slug}}/images/   ← ブランチの画像（同構造）
```

---

## 2. 命名規則

### ファイル名
```
{カテゴリ}-{説明}-{サイズ指定}.{拡張子}
```

**カテゴリ一覧:**
| プレフィックス | 用途 | 例 |
|--------------|------|-----|
| `hero-` | ページヒーロー画像 | hero-service-main.webp |
| `card-` | カード型サムネイル | card-service-thumbnail.webp |
| `photo-` | 写真（施設・スタッフ） | photo-staff-team-2024.webp |
| `icon-` | アイコン・ピクトグラム | icon-service.svg |
| `bg-` | 背景パターン | bg-dot-pattern.webp |
| `logo-` | ロゴ | logo-main.svg |
| `ogp-` | OGP/SNS共有画像 | ogp-service.png |

**説明部分のルール:**
- 英字小文字 + ハイフン区切り
- 日本語禁止（ファイル名のエンコード問題回避）
- 人名は含めない（プライバシー）
- 年度を含める場合は末尾に: `photo-staff-team-2024.webp`

### alt テキスト（HTML属性）
- 日本語で記述
- 30〜80文字
- 「画像」「写真」「イメージ」は冒頭に書かない
- SEO対象キーワードを自然に含む

---

## 3. 画像仕様

### サイズガイドライン
| 用途 | 推奨サイズ(px) | アスペクト比 | 最大容量 |
|------|-------------|-----------|---------|
| ヒーロー（PC） | 1920×800 | 12:5 | 300KB |
| ヒーロー（SP） | 750×600 | 5:4 | 150KB |
| カード | 600×400 | 3:2 | 100KB |
| OGP | 1200×630 | 1.91:1 | 200KB |
| インライン写真 | 800×auto | 自由 | 150KB |
| アイコン | 64×64 or SVG | 1:1 | 10KB |

### フォーマット
- **WebP 優先**（JPEG比40%軽量）
- `<picture>` タグで WebP + JPEG フォールバック
- SVG: ロゴ・アイコン・ピクトグラム
- PNG: 透過が必要な場合のみ
- JPEG: WebP非対応ブラウザ向けフォールバック

### picture タグの標準記法（WPブロック）
```html
<!-- wp:html -->
<picture>
  <source srcset="/public/wp-content/uploads/2026/03/hero-service-main.webp" type="image/webp">
  <img src="/public/wp-content/uploads/2026/03/hero-service-main.jpg"
       alt="{{client.name}}のサービス紹介"
       width="1920" height="800" loading="lazy">
</picture>
<!-- /wp:html -->
```

---

## 4. 画像台帳（image-inventory.yaml）

全画像のメタデータを管理:

```yaml
# data/{{client.slug}}/images/inventory/image-inventory.yaml
images:
  - id: "hero-service-main"
    file: "/public/wp-content/uploads/2026/02/hero-service-main.webp"
    alt: "{{client.name}}のサービス内容を表現した画像"
    category: hero
    tags: [service, team, professional]
    clinic: {{client.slug}}
    size: "1920x800"
    used_on: ["/service/"]
    uploaded: "2026-02-15"

  - id: "photo-staff-01"
    file: "/public/wp-content/uploads/2025/09/photo-staff-01.webp"
    alt: "スタッフが仕事をしている様子"
    category: photo
    tags: [staff, team, work]
    clinic: {{client.slug}}
    size: "800x533"
    used_on: ["/about/", "/recruit/"]
    uploaded: "2025-09-20"
```

**台帳の更新タイミング:**
- 新規画像追加時
- 画像の使用箇所変更時
- CRL（クローラー）によるサイト全体スキャン後

---

## 5. 画像選定基準

### ブランドトーンとの整合性
- {{client.name}}: {{brand_image_tone}}
- {{branch.name}}: {{branch_image_tone}}

### 優先順位（上から選択）
1. **社内撮影の実写真**（スタッフ同意済み）← 最優先
2. **施設・設備写真**
3. **Canva で会社ブランドに合わせて生成した画像**
4. **ストック画像**（最終手段。同じ画像の使い回し不可）

### NG画像
- 顔が識別できる人物写真（同意なし）
- 他社のロゴ・名称が写り込んでいる写真
- 過度にポーズをとったストック感の強い写真
- 暗い・ネガティブな印象の画像
- 解像度が低い / ピンボケ画像

---

## 6. Canva テンプレート管理

```yaml
# data/{{client.slug}}/images/canva-templates/canva-templates.yaml
templates:
  - id: "misao-service-card"
    canva_id: ""  # ← Canva上のテンプレートID（要設定）
    purpose: "サービスカード画像"
    size: "600x400"
    autofill_fields:
      - field: "service_name"
        description: "サービス名"
      - field: "service_description"
        description: "説明文"
    brand: {{client.slug}}

  - id: "branch-service-card"
    canva_id: ""
    purpose: "{{branch.name}} サービスカード画像"
    size: "600x400"
    autofill_fields:
      - field: "service_name"
      - field: "service_description"
    brand: {{branch.slug}}
```

**テンプレート作成手順（初回のみ人間が実行）:**
1. Canva でブランドカラー・フォントを設定
2. テンプレートを作成し、差し込みフィールドを設定
3. テンプレートIDを canva-templates.yaml に記録
4. 以降は IMG エージェントが API 経由で自動生成

---

## 7. プライバシー・法的配慮

- 患者/顧客写真: 使用禁止（顔が識別不能な場合でも避ける）
- スタッフ写真: 本人の書面同意があるもののみ
- ストック画像: ライセンス確認済みのもののみ（商用利用可）
- 建物外観: 周辺の個人情報が写り込まないよう注意
- Canva生成画像: Canva利用規約に準拠（商用利用可）

---

## 8. 画像アップロード・公開フロー

1. **エージェント**: `data/{{client.slug}}/images/` に画像と台帳YAML を配置
2. **IMG (Image Manager)**: Canvaで不足分を生成、アップロード準備
3. **人間**: WP メディアライブラリに手動アップロード、image-inventory.yaml を更新
4. **CRL (Crawler)**: 定期スキャンで使用状況を確認、台帳を更新
5. **公開**: ページに埋め込み、内部リンク確認後、本番公開

---

## 9. WordPress プラグイン・最適化

### 推奨プラグイン
- **Smush** (WebP自動変換、圧縮)
- **WP Fastest Cache** (遅延読み込み対応)
- **SVG Support** (SVGアップロード対応)

### メディアライブラリ設定
- 「メディアファイルを整理」: ON
- 「YYYY/MM のサブフォルダに保存」: ON
- 「オリジナルをアップロード」: ON
