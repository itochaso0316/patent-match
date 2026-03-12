# 構造化データテンプレート

## {{client.name}} （Organization / LocalBusiness）

全ページのフッター or headに配置:

```json
{
  "@context": "https://schema.org",
  "@type": "{{schema_type}}",
  "name": "{{client.name}}",
  "alternateName": "{{client.alternate_name}}",
  "url": "https://{{client.domain}}/",
  "telephone": "{{client.phone}}",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "{{client.address.street}}",
    "addressLocality": "{{client.address.city}}",
    "addressRegion": "{{client.address.prefecture}}",
    "postalCode": "{{client.address.postal_code}}",
    "addressCountry": "JP"
  },
  "description": "{{client.description}}",
  {{#client.opening_hours}}
  "openingHoursSpecification": {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "opens": "{{opening_hours.open}}",
    "closes": "{{opening_hours.close}}"
  }{{/client.opening_hours}}
}
```

---

## ブランチ/支社 （Organization with parentOrganization）

各ブランチページに配置:

```json
{
  "@context": "https://schema.org",
  "@type": "{{branch_schema_type}}",
  "name": "{{branch.name}}",
  "url": "https://{{client.domain}}{{branch.url}}",
  "telephone": "{{branch.phone}}",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "{{branch.address.street}}",
    "addressLocality": "{{branch.address.city}}",
    "addressRegion": "{{branch.address.prefecture}}",
    "postalCode": "{{branch.address.postal_code}}",
    "addressCountry": "JP"
  },
  "parentOrganization": {
    "@type": "Organization",
    "name": "{{client.name}}",
    "url": "https://{{client.domain}}/"
  }
}
```

---

## FAQPage schema

FAQセクション（COMP-08）があるページに配置:

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "{{faq.question1}}",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "{{faq.answer1}}"
      }
    },
    {
      "@type": "Question",
      "name": "{{faq.question2}}",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "{{faq.answer2}}"
      }
    }
  ]
}
```

---

## WebPage schema

各サービス/商品ページに配置:

```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "{{page.title}}",
  "description": "{{page.description}}",
  "url": "https://{{client.domain}}{{page.url}}",
  "lastReviewed": "{{page.last_updated}}",
  "author": {
    "@type": "Organization",
    "name": "{{client.name}}"
  }
}
```

---

## BlogPosting schema（ブログ記事用）

/articles/ や /blog/ 配下の各記事ページに配置:

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "{{article.title}}",
  "description": "{{article.meta_description}}",
  "url": "https://{{client.domain}}{{article.url}}",
  "datePublished": "{{article.published_date}}",
  "dateModified": "{{article.updated_date}}",
  "author": {
    "@type": "Person",
    "name": "{{article.author_name}}",
    "jobTitle": "{{article.author_title}}"
  },
  "publisher": {
    "@type": "Organization",
    "name": "{{client.name}}",
    "url": "https://{{client.domain}}/",
    "logo": "https://{{client.domain}}/logo.png"
  },
  "image": "{{article.featured_image_url}}",
  "keywords": ["{{article.keyword1}}", "{{article.keyword2}}"]
}
```

**ルール**:
- 全記事に BlogPosting を必ず設定
- E-E-A-T シグナルとして author（著者）と publisher を明記
- dateModified は内容更新時に必ず更新

---

## BreadcrumbList schema（ブログ記事パンくず用）

/articles/ 配下の各記事ページのパンくずナビに配置:

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "TOP",
      "item": "https://{{client.domain}}/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "{{article_section_name}}",
      "item": "https://{{client.domain}}/{{article_section_path}}/"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "{{article.title}}",
      "item": "https://{{client.domain}}{{article.url}}"
    }
  ]
}
```

---

## JobPosting schema（求人ページ用）

/recruit/ 配下の各求人詳細ページに配置:

```json
{
  "@context": "https://schema.org",
  "@type": "JobPosting",
  "title": "{{job.title}}",
  "description": "{{job.description}}",
  "datePosted": "{{job.posted_date}}",
  "validThrough": "{{job.deadline}}",
  "employmentType": "{{job.employment_type}}",
  "hiringOrganization": {
    "@type": "Organization",
    "name": "{{client.name}}",
    "sameAs": "https://{{client.domain}}/",
    "logo": "https://{{client.domain}}/logo.png"
  },
  "jobLocation": {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "{{client.address.street}}",
      "addressLocality": "{{client.address.city}}",
      "addressRegion": "{{client.address.prefecture}}",
      "postalCode": "{{client.address.postal_code}}",
      "addressCountry": "JP"
    }
  },
  "baseSalary": {
    "@type": "MonetaryAmount",
    "currency": "JPY",
    "value": {
      "@type": "QuantitativeValue",
      "minValue": "{{job.salary_min}}",
      "maxValue": "{{job.salary_max}}",
      "unitText": "{{job.salary_unit}}"
    }
  },
  "qualifications": "{{job.qualifications}}",
  "jobBenefits": "{{job.benefits}}"
}
```

**ルール:**
- employmentType は Google 仕様に準拠: FULL_TIME / PART_TIME / CONTRACTOR / INTERN
- baseSalary.value の minValue/maxValue は数字のみ（カンマ・通貨記号なし）
- validThrough は ISO 8601 形式で記載

---

## 挿入方法

すべての構造化データは `<!-- wp:html -->` ブロック内の `<script type="application/ld+json">` で記述する。

```html
<!-- wp:html -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "{{client.name}}"
}
</script>
<!-- /wp:html -->
```
