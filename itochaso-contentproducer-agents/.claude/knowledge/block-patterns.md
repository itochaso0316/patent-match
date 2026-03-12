# コンポーネントカタログ（block-patterns）（テンプレート）

全エージェントが参照する公式コンポーネントテンプレート集。
**このファイルに存在しないHTML構造の生成は禁止。**

---

## COMP-01: ページヒーロー（Sub Page Hero）

**用途**: すべてのサブページ最上部

```html
<!-- wp:group {"align":"full","className":"section cover","anchor":"cover","layout":{"type":"constrained"}} -->
<div id="cover" class="wp-block-group alignfull section cover">
  <!-- wp:html -->
  <picture>
    <source media="(min-width:769px)" srcset="【PC画像URL】">
    <source media="(max-width:768px)" srcset="【SP画像URL】">
    <img src="【SP画像URL】" alt="【ページ名】">
  </picture>
  <!-- /wp:html -->
  <!-- wp:group {"className":"title-group is-pagetitle","layout":{"type":"constrained"}} -->
  <div class="wp-block-group title-group is-pagetitle">
    <!-- wp:heading {"className":"subtitle"} -->
    <h2 class="wp-block-heading subtitle">【English Title】</h2>
    <!-- /wp:heading -->
    <!-- wp:heading {"level":3,"className":"title"} -->
    <h3 class="wp-block-heading title">【日本語タイトル】</h3>
    <!-- /wp:heading -->
  </div>
  <!-- /wp:group -->
</div>
<!-- /wp:group -->
```

**ルール**:
- すべてのサブページで同一構造を使用
- PC/SP画像は必ずpicture要素で切り替え
- anchor="cover" を必ず付与

---

## COMP-02: セクションフレーム（Section Frame）

**用途**: すべてのコンテンツセクションの外枠

```html
<!-- wp:group {"backgroundColor":"【white|white-bis|white-ter】","className":"section inview","layout":{"type":"constrained"},"anchor":"【セクションID】"} -->
<div id="【セクションID】" class="wp-block-group section inview has-【色】-background-color has-background">

  <!-- COMP-03: セクションタイトルをここに配置 -->

  <!-- ここにコンテンツ -->

</div>
<!-- /wp:group -->
```

**背景色ローテーション（厳守）**:
```
セクション1: white
セクション2: white-ter
セクション3: white
セクション4: white-bis
セクション5: white
最終セクション（CTA）: primary
```

---

## COMP-03: セクションタイトル（Section Title）

**用途**: 各セクションの見出し（唯一の構造）

```html
<!-- wp:group {"className":"title-group"} -->
<div class="wp-block-group title-group">
  <!-- wp:heading {"className":"subtitle"} -->
  <h2 class="wp-block-heading subtitle">【English Title】</h2>
  <!-- /wp:heading -->
  <!-- wp:heading {"level":3,"className":"title"} -->
  <h3 class="wp-block-heading title">【日本語タイトル】</h3>
  <!-- /wp:heading -->
</div>
<!-- /wp:group -->
```

**ルール**:
- 必ずH2（英語）+ H3（日本語）のペア
- `title-group` クラスを必ず使用
- H2にsubtitle、H3にtitleクラス

---

## COMP-04: ボタン（Button）

**全3バリエーション（これ以外は使用禁止）**

### COMP-04-A: 丸ボタン大（Primary CTA）
```html
<!-- wp:html -->
<a class="btn-circle" href="【URL】">
  <span class="btn"><i class="icon-arrow"></i></span>
  <span>【ラベル】</span>
</a>
<!-- /wp:html -->
```

### COMP-04-B: 丸ボタン小（Secondary action）
```html
<!-- wp:html -->
<a class="btn-circle-xsmall" href="【URL】">
  <span class="btn"><i class="icon-arrow"></i></span>
  <span>【ラベル】</span>
</a>
<!-- /wp:html -->
```

### COMP-04-C: テキストボタン（Tertiary / inline）
```html
<!-- wp:html -->
<a class="btn" href="【URL】">
  <span>【ラベル】</span>
  <i class="icon-arrow"></i>
</a>
<!-- /wp:html -->
```

**ルール**:
- Lazy Block (`wp:lazyblock/common-button`) は使用禁止（新規）
- WP標準ボタンブロック（`wp:buttons`）は使用禁止
- 必ず wp:html で記述

---

## COMP-05: 情報カード（Information Card — 横レイアウト）

**用途**: サービス紹介、商品紹介

```html
<!-- wp:columns {"verticalAlignment":"top","className":"gap-40-60"} -->
<div class="wp-block-columns are-vertically-aligned-top gap-40-60">
  <!-- wp:column {"verticalAlignment":"center","width":"29.5vw","className":"is-medium-mobile"} -->
  <div class="wp-block-column is-vertically-aligned-center is-medium-mobile" style="flex-basis:29.5vw">
    <!-- wp:image {"sizeSlug":"large"} -->
    <figure class="wp-block-image size-large">
      <img src="【画像URL】" alt="【名称】" />
    </figure>
    <!-- /wp:image -->
  </div>
  <!-- /wp:column -->
  <!-- wp:column {"verticalAlignment":"center"} -->
  <div class="wp-block-column is-vertically-aligned-center">
    <!-- wp:heading {"level":3,"className":"title"} -->
    <h3 class="wp-block-heading title">【名称】</h3>
    <!-- /wp:heading -->
    <!-- wp:group {"textColor":"grey-dark","className":"text-lead mb-30 font-size-14"} -->
    <div class="wp-block-group text-lead mb-30 font-size-14 has-grey-dark-color has-text-color">
      <!-- wp:paragraph -->
      <p>【説明文】</p>
      <!-- /wp:paragraph -->
    </div>
    <!-- /wp:group -->
    <!-- COMP-04-A: ボタン -->
    <!-- wp:html -->
    <a class="btn-circle btn-area" href="【リンク先】">
      <span class="btn"><i class="icon-arrow"></i></span>
      <span>詳しく見る</span>
    </a>
    <!-- /wp:html -->
  </div>
  <!-- /wp:column -->
</div>
<!-- /wp:columns -->
```

---

## COMP-08: FAQアコーディオン（FAQ Accordion）

**用途**: FAQ、経歴の折りたたみ
**注意**: Q&Aは必ずこの形式で表示。リスト/段落での展開は禁止。

```html
<!-- wp:group {"className":"accordion js-accordion faq-list","layout":{"type":"constrained","contentSize":"820px"}} -->
<div class="wp-block-group accordion js-accordion faq-list">

  <!-- 各Q&A -->
  <!-- wp:group {"className":"js-accordion-target"} -->
  <div class="wp-block-group js-accordion-target">
    <!-- wp:heading {"level":3,"className":"js-accordion-title"} -->
    <h3 class="wp-block-heading js-accordion-title">【質問テキスト】</h3>
    <!-- /wp:heading -->
    <!-- wp:group -->
    <div class="wp-block-group">
      <!-- wp:paragraph -->
      <p>【回答テキスト】</p>
      <!-- /wp:paragraph -->
    </div>
    <!-- /wp:group -->
  </div>
  <!-- /wp:group -->

  <!-- 繰り返し... -->

</div>
<!-- /wp:group -->
```

---

## COMP-10: CTAセクション（Call to Action）

**用途**: 全ページ最下部（フッター直前）

```html
<!-- wp:group {"align":"full","backgroundColor":"primary","className":"section cta-section","layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull section cta-section has-primary-background-color has-background">
  <!-- wp:group {"className":"title-group"} -->
  <div class="wp-block-group title-group">
    <!-- wp:heading {"className":"subtitle","textColor":"white"} -->
    <h2 class="wp-block-heading subtitle has-white-color has-text-color">【English Title】</h2>
    <!-- /wp:heading -->
    <!-- wp:heading {"level":3,"className":"title","textColor":"white"} -->
    <h3 class="wp-block-heading title has-white-color has-text-color">【日本語タイトル】</h3>
    <!-- /wp:heading -->
  </div>
  <!-- /wp:group -->
  <!-- wp:html -->
  <div class="cta-buttons">
    <a class="cta-phone" href="tel:【電話番号】">
      <span class="cta-icon">📞</span>
      <span class="cta-label">お電話</span>
      <span class="cta-number">【電話番号】</span>
    </a>
    <a class="cta-web" href="【予約URL】" target="_blank">
      <span class="cta-icon">🌐</span>
      <span class="cta-label">WEB予約</span>
    </a>
  </div>
  <!-- /wp:html -->
  <!-- wp:paragraph {"align":"center","textColor":"white","className":"font-size-14"} -->
  <p class="has-text-align-center has-white-color has-text-color font-size-14">【受付時間】</p>
  <!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
```

---

## COMP-11: PC/SP画像切り替え（Responsive Image）

**用途**: ヒーロー画像、大型バナー

```html
<!-- wp:html -->
<picture>
  <source media="(min-width:769px)" srcset="【PC画像URL】">
  <source media="(max-width:768px)" srcset="【SP画像URL】">
  <img src="【SP画像URL】" alt="【説明テキスト】">
</picture>
<!-- /wp:html -->
```

**ルール**: Lazy Block (`common-img-device-change`) は使用禁止（新規）

---

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
              └── 上記に該当しない → 標準WPブロック
```

---

## 使用禁止リスト

| 禁止項目 | 代替 |
|---------|------|
| Lazy Block (`wp:lazyblock/*`) | 該当COMPのwp:html版 |
| WP標準ボタンブロック (`wp:buttons`) | COMP-04 |
| インラインスタイル（余白系） | CSSユーティリティクラス |
| リスト/段落でのFAQ表示 | COMP-08（アコーディオン） |
