# {{client.name}} ブランドアイデンティティ（テンプレート）

## このファイルの目的
コンテンツの独自性の源泉となるファイル。
すべてのページ・記事制作時に参照し、{{client.name}}ならではの独自性を反映する。

---

## 1. 代表者の人格・想い

### 基本情報
- 氏名: {{representative.name}}
- 専門: {{representative.specialty}}
- 経歴: {{representative.background}}

### 代表者の経営哲学
**核心メッセージ（これが全コンテンツの根底に流れるトーン）:**
> {{representative.core_message}}

**キーワード群（代表者が大切にしている価値観）:**
{{#representative.values}}
- {{.}}
{{/representative.values}}

**代表者が使う表現・口癖:**
{{#representative.phrases}}
- {{.}}
{{/representative.phrases}}

**代表者のエピソード（コンテンツに活用可能なもの）:**
{{#representative.stories}}
1. {{.}}
{{/representative.stories}}

### 支社/支店の代表情報（複数ある場合）
```
各支社の代表情報をここに記載
- 氏名、専門、経歴、診療哲学、独自ポジション
```

---

## 2. {{client.name}}の実績・事実

### 基本実績
| 項目 | 数値 | 期間 | ソース |
|------|------|------|--------|
| {{metrics.name1}} | {{metrics.value1}} | {{metrics.period1}} | {{metrics.source1}} |
| {{metrics.name2}} | {{metrics.value2}} | {{metrics.period2}} | {{metrics.source2}} |
| {{metrics.name3}} | {{metrics.value3}} | {{metrics.period3}} | {{metrics.source3}} |

### 他社との差別化ポイント（事実ベース）
{{#differentiation}}
1. {{.}}
{{/differentiation}}

### 設備・技術の独自性
- {{unique_facilities.name1}}
- {{unique_facilities.name2}}

### 受賞・認定・メディア掲載
- {{awards.award1}}
- {{awards.award2}}

---

## 3. 会社の文化・雰囲気

### {{client.name}}のトーン
- {{brand_tone.element1}}
- {{brand_tone.element2}}
- {{brand_tone.element3}}

### 使ってはいけない表現
- ❌ {{forbidden_expressions.expr1}}
- ❌ {{forbidden_expressions.expr2}}

### 使うべき表現パターン
- ✅ {{recommended_expressions.expr1}}
- ✅ {{recommended_expressions.expr2}}

---

## 4. コンテンツ差別化マトリクス

コンテンツを作成する際、以下の3層で独自性を担保する:

```
Layer 1: 想い（Emotion）
  代表者の人格、経営哲学、顧客への姿勢
  → 他社にはコピーできない唯一無二の要素
  → 全コンテンツの「なぜ」を説明する層

Layer 2: 実績（Evidence）
  治療実績、症例数、学会発表、設備
  → 事実ベースの信頼構築
  → E-E-A-T の Experience と Expertise を満たす

Layer 3: 専門知識（Expertise）
  医療情報、治療法の解説、FAQ
  → SEO/LLMEO で上位表示を狙う層
  → 業界ガイドライン準拠の正確な情報
```

**コンテンツ制作の鉄則:**
1. まず Layer 1（想い）から書き始める — なぜこのサービスを大切にしているか
2. Layer 2（実績）で裏付ける — 何件の実績があるか、どんな成果を上げたか
3. Layer 3（専門知識）で深掘りする — 具体的な内容、流れ、費用
4. 最後に SEO/LLMEO/MEO で技術最適化する — キーワード、構造化データ、内部リンク

---

## 5. 更新ルール

### このファイルを更新するタイミング
- 代表者インタビューを実施した後
- 新しい実績データが入手できた時
- 新しいサービス・商品が開始された時
- メディア掲載や受賞があった時
- YouTube Shorts などで代表者の新しいメッセージが公開された時

### 更新担当
- Brand Researcher (BRD) エージェントが一次更新
- 人間（責任者）が内容を確認・承認
- 承認後、全エージェントが最新版を参照
