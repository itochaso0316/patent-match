#!/usr/bin/env python3
"""
PatentMatch.jp - Google BigQuery特許データ取得スクリプト
patents-public-data から日本特許データを取得してコンテンツ生成に活用
"""

import os
import json
import time
import re
from datetime import datetime
from pathlib import Path
import anthropic

try:
    from google.cloud import bigquery
    BQ_AVAILABLE = True
except ImportError:
    BQ_AVAILABLE = False
    print("google-cloud-bigquery not installed. Run: pip3 install google-cloud-bigquery")

REPO_DIR = Path(__file__).parent.parent
CONTENT_DIR = REPO_DIR / "content"
DATA_DIR = REPO_DIR / "data"
COST_FILE = REPO_DIR / "scripts" / "cost_tracker.json"
SA_KEY = REPO_DIR / "service-account.json"

MODEL = "claude-sonnet-4-6"
COST_LIMIT_USD = 10.0

# ========== BigQuery クライアント ==========

def get_bq_client():
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(SA_KEY)
    return bigquery.Client(project="claude-brain-vm")

# ========== コスト管理 ==========

def load_cost():
    if COST_FILE.exists():
        return json.loads(COST_FILE.read_text())
    return {"total_usd": 0.0, "runs": []}

def update_cost(inp, out):
    c = (inp / 1e6 * 3.0) + (out / 1e6 * 15.0)
    d = load_cost()
    d["total_usd"] = round(d["total_usd"] + c, 4)
    COST_FILE.write_text(json.dumps(d, ensure_ascii=False, indent=2))
    return d["total_usd"]

# ========== クエリ定義 ==========

QUERIES = {
    # 技術分野別 人気特許ランキング
    "top_ipc": """
        SELECT
            ipc.code as ipc_code,
            COUNT(*) as patent_count,
            ipc.code as category
        FROM `patents-public-data.patents.publications`,
        UNNEST(ipc) as ipc
        WHERE country_code = 'JP'
          AND grant_date > 20200101
          AND ARRAY_LENGTH(ipc) > 0
        GROUP BY ipc_code, category
        ORDER BY patent_count DESC
        LIMIT 30
    """,

    # 出願人別 特許保有数ランキング（大企業）
    "top_assignees": """
        SELECT
            assignee.name as company_name,
            COUNT(*) as patent_count
        FROM `patents-public-data.patents.publications`,
        UNNEST(assignee) as assignee
        WHERE country_code = 'JP'
          AND grant_date > 20200101
          AND assignee.name IS NOT NULL
          AND assignee.name != ''
        GROUP BY company_name
        ORDER BY patent_count DESC
        LIMIT 20
    """,

    # AI・機械学習関連特許（直近）
    "ai_patents": """
        SELECT
            publication_number,
            title_localized[SAFE_OFFSET(0)].text as title,
            abstract_localized[SAFE_OFFSET(0)].text as abstract,
            filing_date,
            grant_date
        FROM `patents-public-data.patents.publications`
        WHERE country_code = 'JP'
          AND grant_date > 20220101
          AND (
            LOWER(title_localized[SAFE_OFFSET(0)].text) LIKE '%人工知能%'
            OR LOWER(title_localized[SAFE_OFFSET(0)].text) LIKE '%機械学習%'
            OR LOWER(title_localized[SAFE_OFFSET(0)].text) LIKE '%ディープラーニング%'
            OR LOWER(title_localized[SAFE_OFFSET(0)].text) LIKE '%neural network%'
          )
        ORDER BY grant_date DESC
        LIMIT 20
    """,

    # グリーン・環境技術特許
    "green_patents": """
        SELECT
            publication_number,
            title_localized[SAFE_OFFSET(0)].text as title,
            abstract_localized[SAFE_OFFSET(0)].text as abstract,
            filing_date,
            grant_date
        FROM `patents-public-data.patents.publications`
        WHERE country_code = 'JP'
          AND grant_date > 20220101
          AND (
            LOWER(title_localized[SAFE_OFFSET(0)].text) LIKE '%再生可能エネルギー%'
            OR LOWER(title_localized[SAFE_OFFSET(0)].text) LIKE '%太陽光%'
            OR LOWER(title_localized[SAFE_OFFSET(0)].text) LIKE '%水素%'
            OR LOWER(title_localized[SAFE_OFFSET(0)].text) LIKE '%カーボンニュートラル%'
            OR LOWER(title_localized[SAFE_OFFSET(0)].text) LIKE '%蓄電%'
          )
        ORDER BY grant_date DESC
        LIMIT 20
    """,

    # バイオ・医療技術特許
    "bio_patents": """
        SELECT
            publication_number,
            title_localized[SAFE_OFFSET(0)].text as title,
            abstract_localized[SAFE_OFFSET(0)].text as abstract,
            filing_date,
            grant_date
        FROM `patents-public-data.patents.publications`
        WHERE country_code = 'JP'
          AND grant_date > 20220101
          AND (
            LOWER(title_localized[SAFE_OFFSET(0)].text) LIKE '%医療%'
            OR LOWER(title_localized[SAFE_OFFSET(0)].text) LIKE '%創薬%'
            OR LOWER(title_localized[SAFE_OFFSET(0)].text) LIKE '%バイオ%'
            OR LOWER(title_localized[SAFE_OFFSET(0)].text) LIKE '%ゲノム%'
          )
        ORDER BY grant_date DESC
        LIMIT 20
    """,
}

# ========== データ取得 ==========

def fetch_query(client, query_name: str, query: str) -> list:
    print(f"  クエリ実行: {query_name}")
    try:
        results = client.query(query)
        rows = [dict(row) for row in results]
        print(f"  → {len(rows)}件取得")
        return rows
    except Exception as e:
        print(f"  ❌ エラー: {e}")
        return []

# ========== 記事生成 ==========

def slugify(title: str) -> str:
    slug = re.sub(r'[^\w\s-]', '', title.lower())
    slug = re.sub(r'[-\s]+', '-', slug).strip('-')
    return slug[:60] if len(slug) >= 3 else re.sub(r'[^\w-]', '-', title)[:50].strip('-')

def generate_trend_article(client_ai, theme: str, data: list, category: str) -> str:
    """BigQueryデータをもとにトレンド記事を生成"""
    data_summary = json.dumps(data[:10], ensure_ascii=False, indent=2, default=str)

    prompt = f"""PatentMatch.jp編集者として、以下の実際の特許データをもとに日本語記事を書いてください。

## テーマ
{theme}

## 実データ（Google Patents BigQueryより取得）
{data_summary}

## 記事要件
- 1200〜1500字
- 実データの数字・特許番号を具体的に引用
- 技術トレンドの解説
- ライセンス・活用可能性の示唆
- 最後にCTA（「この技術分野の特許活用について相談したい方はこちら」）
- Markdownのみ（Front matterなし）
"""

    response = client_ai.messages.create(
        model=MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )
    total = update_cost(response.usage.input_tokens, response.usage.output_tokens)
    print(f"  💰 累計コスト: ${total:.4f}")
    return response.content[0].text

def save_article(title: str, content: str, category: str):
    date_str = datetime.now().strftime("%Y-%m-%d")
    slug = slugify(title)
    body = re.sub(r'^#{1,2}\s+.+\n', '', content, count=1).strip()
    filepath = CONTENT_DIR / category / f"{date_str}-bq-{slug}.md"
    filepath.parent.mkdir(parents=True, exist_ok=True)
    filepath.write_text(
        f'---\ntitle: "{title}"\ndate: {date_str}\ndraft: false\n'
        f'categories:\n  - "{category}"\ntags:\n  - "特許トレンド"\n  - "BigQuery"\n'
        f'  - "データ分析"\ndescription: "実際の特許データをもとに解説。{title}"\n---\n\n'
        + body + "\n",
        encoding="utf-8"
    )
    print(f"  ✅ 保存: {filepath.name}")
    return str(filepath)

# ========== データページ生成 ==========

def save_data_json(name: str, data: list):
    """dataディレクトリにJSONで保存（Hugoのデータテンプレートで使用可能）"""
    DATA_DIR.mkdir(exist_ok=True)
    filepath = DATA_DIR / f"{name}.json"
    filepath.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=str))
    print(f"  📊 データ保存: {filepath.name} ({len(data)}件)")

# ========== メイン ==========

def main():
    if not BQ_AVAILABLE:
        return

    print("=== PatentMatch.jp BigQuery特許データ取得 ===")

    bq = get_bq_client()
    ai = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

    # コスト確認
    cost = load_cost()
    if cost["total_usd"] >= COST_LIMIT_USD:
        print(f"⚠️ コスト上限: ${cost['total_usd']:.2f}")
        return

    # 1. データ取得 & JSON保存（Hugo dataテンプレート用）
    print("\n[1/2] 特許データ取得...")
    all_data = {}
    for name, query in QUERIES.items():
        rows = fetch_query(bq, name, query)
        if rows:
            save_data_json(name, rows)
            all_data[name] = rows
        time.sleep(0.5)

    # 2. トレンド記事生成（AIデータあるものだけ）
    print("\n[2/2] トレンド記事生成...")

    ARTICLE_TASKS = [
        ("ai_patents", "日本のAI特許最新動向：2022〜2024年の技術トレンドを実データで分析", "guide"),
        ("green_patents", "グリーン技術特許の最前線：再生可能エネルギー・水素・蓄電の日本特許動向", "guide"),
        ("top_assignees", "日本の特許大手ランキング：出願数トップ20社の知財戦略", "matching"),
    ]

    for data_key, title, category in ARTICLE_TASKS:
        if data_key not in all_data or not all_data[data_key]:
            print(f"  スキップ（データなし）: {title[:40]}")
            continue

        # 生成済みチェック
        existing = list((CONTENT_DIR / category).glob(f"*bq-{slugify(title)[:30]}*"))
        if existing:
            print(f"  スキップ（生成済み）: {title[:40]}")
            continue

        print(f"\n  生成中: {title[:50]}")
        content = generate_trend_article(ai, title, all_data[data_key], category)
        save_article(title, content, category)
        time.sleep(1)

    print("\n=== 完了 ===")

if __name__ == "__main__":
    main()
