#!/usr/bin/env python3
"""
PatentMatch.jp 記事バッチ生成スクリプト
重要テーマをClaudeで直接記事化する
"""

import os
import re
import time
import json
import subprocess
from datetime import datetime
from pathlib import Path
import requests
from bs4 import BeautifulSoup
import anthropic
from dotenv import load_dotenv

load_dotenv()

REPO_DIR = Path(__file__).parent.parent
CONTENT_DIR = REPO_DIR / "content"
COST_FILE = REPO_DIR / "scripts" / "cost_tracker.json"
GENERATED_FILE = REPO_DIR / "scripts" / "generated_articles.json"

MODEL = "claude-haiku-3-5"
COST_ALERT_USD = 10.0

# Claude APIクライアント
client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

# ========== コスト管理 ==========

def load_cost():
    if COST_FILE.exists():
        return json.loads(COST_FILE.read_text())
    return {"total_usd": 0.0, "runs": []}

def save_cost(data):
    COST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2))

def update_cost(input_tokens, output_tokens):
    # claude-sonnet-4-6: $3/1M input, $15/1M output
    cost = (input_tokens / 1_000_000 * 3.0) + (output_tokens / 1_000_000 * 15.0)
    data = load_cost()
    data["total_usd"] = round(data["total_usd"] + cost, 4)
    data["runs"].append({
        "timestamp": datetime.now().isoformat(),
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cost_usd": round(cost, 4)
    })
    save_cost(data)
    return data["total_usd"]

# ========== 生成済み管理 ==========

def load_generated():
    if GENERATED_FILE.exists():
        return json.loads(GENERATED_FILE.read_text())
    return []

def save_generated(data):
    GENERATED_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2))

# ========== 参照サイトクロール ==========

def fetch_ref_content(url: str, max_chars: int = 2000) -> str:
    try:
        headers = {"User-Agent": "Mozilla/5.0 (compatible; PatentMatchBot/1.0)"}
        r = requests.get(url, headers=headers, timeout=10)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        text = soup.get_text(separator="\n", strip=True)
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text[:max_chars]
    except Exception as e:
        return f"[クロール失敗: {e}]"

# ========== 記事生成 ==========

def slugify(title: str) -> str:
    slug = re.sub(r'[^\w\s-]', '', title.lower())
    slug = re.sub(r'[-\s]+', '-', slug).strip('-')
    if not slug or len(slug) < 3:
        slug = re.sub(r'[^\w-]', '-', title)[:50].strip('-')
    return slug[:60]

def generate_article(topic: dict, ref_content: str) -> dict:
    category = topic["category"]
    title_hint = topic["title_hint"]
    tags = topic["tags"]
    segments = topic.get("segments", [])
    prompt_extra = topic.get("prompt_extra", "")

    tags_str = "・".join(tags)
    segments_str = "・".join(segments)

    prompt = f"""あなたは特許・知的財産の専門メディア「PatentMatch.jp」の編集者です。
以下のテーマで、SEOに強く実用的な日本語記事を書いてください。

## テーマ
{title_hint}

## ターゲット読者
{segments_str}

## 必須要件
{prompt_extra}

## 参照情報（公式サイトからクロール）
{ref_content}

## 記事形式
- 1200〜1800字
- 見出し（##、###）を使って構造化
- 数字・事例を必ず含める
- 不明な数字は「要確認」と明記
- 最後に「まとめ」セクション
- 末尾にお問い合わせCTA（「特許活用について相談したい方はこちら」）

## 出力形式
Markdownのみ（Front matterなし）。タイトルは ## で始めること。
"""

    response = client.messages.create(
        model=MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )

    content = response.content[0].text
    total_cost = update_cost(response.usage.input_tokens, response.usage.output_tokens)

    return {
        "content": content,
        "title": title_hint,
        "total_cost": total_cost
    }

def save_article(topic: dict, content: str):
    category = topic["category"]
    title_hint = topic["title_hint"]
    tags = topic["tags"]
    date_str = datetime.now().strftime("%Y-%m-%d")

    # slug生成
    slug = slugify(title_hint)

    # Front matter
    tags_yaml = "\n".join([f'  - "{t}"' for t in tags])
    front_matter = f"""---
title: "{title_hint}"
date: {date_str}
draft: false
categories:
  - "{category}"
tags:
{tags_yaml}
description: "{title_hint}について詳しく解説。PatentMatch.jpが特許活用・ライセンス・マッチングの実践情報をお届けします。"
---
"""

    # 記事本文（タイトルH1を除去してFront matterと統合）
    body = content
    body = re.sub(r'^#{1,2}\s+.+\n', '', body, count=1).strip()

    full_content = front_matter + "\n" + body + "\n"

    # ファイル保存
    filepath = CONTENT_DIR / category / f"{date_str}-{slug}.md"
    filepath.parent.mkdir(parents=True, exist_ok=True)
    filepath.write_text(full_content, encoding="utf-8")

    return str(filepath)

# ========== トピック定義 ==========

TOPICS = [
    {
        "category": "guide",
        "title_hint": "特許とは何か：取得から活用まで中小企業向け完全ガイド",
        "tags": ["特許", "知的財産", "中小企業", "特許活用", "入門"],
        "segments": ["中小企業経営者", "研究者・技術者"],
        "ref_urls": ["https://www.jpo.go.jp/system/patent/index.html"],
        "prompt_extra": """
特許の基礎から活用まで：
- 特許権とは（定義・保護期間20年）
- 特許取得にかかる費用（出願費用・維持費の目安）
- 特許を「持っているだけ」のリスク（維持コスト）
- 活用の選択肢：自社実施・ライセンス・売却・担保
- J-PlatPat（特許情報プラットフォーム）の使い方
- 弁理士・特許事務所の選び方
※特許庁公式情報に基づいて記述。不明な数字は「要確認」と明記。
"""
    },
    {
        "category": "license",
        "title_hint": "特許ライセンス契約の完全ガイド：専用実施権・通常実施権の違いと収益化",
        "tags": ["特許ライセンス", "専用実施権", "通常実施権", "ロイヤリティ", "収益化"],
        "segments": ["中小企業経営者", "研究者・技術者", "起業家"],
        "ref_urls": ["https://www.jpo.go.jp/system/patent/gaiyo/seidogaiyo/chizai09.html"],
        "prompt_extra": """
特許ライセンス契約について：
- 専用実施権と通常実施権の違いと使い分け
- ロイヤリティ相場（業界別・技術分野別の目安）
- ライセンス契約書の必須条項
- 許諾交渉の進め方
- 大企業へのライセンスアウト成功事例
- ライセンス管理のポイント
"""
    },
    {
        "category": "sell",
        "title_hint": "特許売却・譲渡の完全ガイド：相場・手続き・注意点",
        "tags": ["特許売却", "特許譲渡", "知財M&A", "特許買取", "相場"],
        "segments": ["中小企業経営者", "研究者・技術者", "起業家"],
        "ref_urls": ["https://www.jpo.go.jp/system/patent/index.html"],
        "prompt_extra": """
特許売却・譲渡について：
- 特許の価値算定方法（コスト法・市場法・収益法）
- 売却と維持のコスト比較
- 特許売買仲介サービスの種類と特徴
- 手続きの流れ（移転登録まで）
- 大企業・VCが求める特許の特徴
- 休眠特許の活用事例
"""
    },
    {
        "category": "matching",
        "title_hint": "特許マッチングサービス比較：ライセンサーとライセンシーをつなぐプラットフォーム",
        "tags": ["特許マッチング", "ライセンシング", "技術移転", "オープンイノベーション"],
        "segments": ["中小企業経営者", "起業家", "投資家"],
        "ref_urls": ["https://www.inpit.go.jp/"],
        "prompt_extra": """
特許マッチングについて：
- 主要な特許マッチングプラットフォーム一覧と特徴
- 大学TLO（技術移転機関）との連携方法
- オープンイノベーションでの特許活用事例
- マッチング成功の条件
- 特許仲介エージェントの選び方・費用感
- 海外ライセンスの可能性
"""
    },
    {
        "category": "tools",
        "title_hint": "J-PlatPat完全活用ガイド：特許調査から競合分析まで",
        "tags": ["J-PlatPat", "特許調査", "先行技術調査", "競合分析", "無料ツール"],
        "segments": ["研究者・技術者", "中小企業経営者", "起業家"],
        "ref_urls": ["https://www.j-platpat.inpit.go.jp/"],
        "prompt_extra": """
J-PlatPatの活用方法：
- 基本的な特許検索の手順（キーワード・番号・出願人）
- 分類コード（FI・Fターム）の使い方
- 競合他社の特許ポートフォリオ分析
- 無効資料調査の基本
- 海外特許データベースとの連携（USPTO・EPO）
- 無料で使える特許分析ツール一覧
"""
    },
    {
        "category": "agents",
        "title_hint": "特許ライセンス仲介エージェント・知財専門弁理士の選び方",
        "tags": ["特許エージェント", "弁理士", "知財戦略", "ライセンス仲介", "費用"],
        "segments": ["中小企業経営者", "研究者・技術者"],
        "ref_urls": ["https://www.jpaa.or.jp/"],
        "prompt_extra": """
特許エージェント・弁理士選びについて：
- 弁理士と特許エージェントの違い
- 費用の目安（出願・審査・維持・ライセンス交渉）
- 知財専門弁理士の探し方
- 中小企業向け支援制度（特許庁・INPIT）
- 良いエージェントを見分けるポイント
- 初回相談で聞くべきこと
"""
    },
    {
        "category": "guide",
        "title_hint": "休眠特許の発掘と収益化：眠っている知財を換金する方法",
        "tags": ["休眠特許", "知財収益化", "特許棚卸し", "ライセンスアウト"],
        "segments": ["中小企業経営者", "研究者・技術者"],
        "ref_urls": ["https://www.inpit.go.jp/"],
        "prompt_extra": """
休眠特許の活用について：
- 休眠特許とは（定義・日本の実態）
- 特許棚卸しの進め方
- 価値ある休眠特許の見つけ方
- ライセンスアウトの事例と収益規模
- INPIT（工業所有権情報・研修館）の無料支援
- 特許維持コスト削減の判断基準
"""
    },
    {
        "category": "guide",
        "title_hint": "大学・研究機関の特許技術移転（TLO）完全ガイド",
        "tags": ["TLO", "技術移転", "大学特許", "産学連携", "スタートアップ"],
        "segments": ["起業家", "投資家", "中小企業経営者"],
        "ref_urls": ["https://www.inpit.go.jp/"],
        "prompt_extra": """
大学TLOと技術移転について：
- TLO（技術移転機関）の役割と主要機関一覧
- 大学特許ライセンスの取得方法
- 費用感（ランニングロイヤリティ・マイルストーン）
- スタートアップでの大学特許活用事例
- 産学連携契約の基礎
- 主要大学TLOへのコンタクト方法
"""
    },
    {
        "category": "license",
        "title_hint": "特許ロイヤリティ収入の税務：確定申告・節税ポイント",
        "tags": ["特許ロイヤリティ", "税務", "確定申告", "節税", "知財収益"],
        "segments": ["研究者・技術者", "中小企業経営者"],
        "ref_urls": ["https://www.nta.go.jp/"],
        "prompt_extra": """
特許ロイヤリティの税務について：
- ロイヤリティ収入の税務区分（事業所得・雑所得等）
- 必要経費として認められるもの
- 法人の場合の処理
- 海外からのロイヤリティ収入と源泉徴収
- 節税のポイント
- 確定申告の手順
※国税庁公式情報に基づいて記述。
"""
    },
    {
        "category": "matching",
        "title_hint": "特許担保融資の活用：知財を担保に資金調達する方法",
        "tags": ["特許担保融資", "知財金融", "資金調達", "IP担保", "中小企業金融"],
        "segments": ["中小企業経営者", "起業家"],
        "ref_urls": ["https://www.inpit.go.jp/"],
        "prompt_extra": """
特許担保融資について：
- 知財金融（IP担保融資）とは
- 利用できる金融機関・制度
- 審査のポイント（特許の評価方法）
- 融資額の目安
- 政府系金融機関（日本政策金融公庫等）の特許担保制度
- メリット・デメリット
"""
    },
]

# ========== メイン処理 ==========

def main():
    generated = load_generated()
    generated_titles = {g["title"] for g in generated}

    print(f"=== PatentMatch.jp 記事生成開始 ===")
    print(f"対象トピック: {len(TOPICS)}件")

    cost_data = load_cost()
    if cost_data["total_usd"] >= COST_ALERT_USD:
        print(f"⚠️ コスト上限到達: ${cost_data['total_usd']:.2f}")
        return

    new_count = 0
    for i, topic in enumerate(TOPICS):
        title = topic["title_hint"]

        if title in generated_titles:
            print(f"[{i+1}/{len(TOPICS)}] スキップ（生成済み）: {title[:40]}")
            continue

        print(f"\n[{i+1}/{len(TOPICS)}] 生成中: {title[:50]}")

        # 参照サイトクロール
        ref_content = ""
        for url in topic.get("ref_urls", []):
            print(f"  クロール: {url}")
            content = fetch_ref_content(url)
            ref_content += f"\n[{url}]\n{content}\n"

        # 記事生成
        try:
            result = generate_article(topic, ref_content)
            filepath = save_article(topic, result["content"])
            print(f"  ✅ 保存: {filepath}")
            print(f"  💰 累計コスト: ${result['total_cost']:.4f}")

            generated.append({
                "title": title,
                "category": topic["category"],
                "filepath": filepath,
                "generated_at": datetime.now().isoformat()
            })
            save_generated(generated)
            new_count += 1

            # コスト上限チェック
            if result["total_cost"] >= COST_ALERT_USD:
                print(f"⚠️ コスト上限到達: ${result['total_cost']:.2f}")
                break

            time.sleep(2)  # API レート制限対策

        except Exception as e:
            print(f"  ❌ エラー: {e}")
            continue

    print(f"\n=== 完了: {new_count}件生成 ===")

if __name__ == "__main__":
    main()
