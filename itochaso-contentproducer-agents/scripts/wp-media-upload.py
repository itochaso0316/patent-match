#!/usr/bin/env python3
"""
WordPress メディア一括アップロードスクリプト（テンプレート）

クライアント向けにカスタマイズしてください

機能（実装予定）:
  - ローカル画像フォルダから一括アップロード
  - メディアライブラリにカテゴリ分け
  - メタデータ（alt テキスト、説明等）を自動設定
  - 既存メディアとの重複チェック
  - SEO 最適化（ファイル名正規化等）

使い方:
  python scripts/wp-media-upload.py --input DIR [--category CATEGORY] [--dry-run]

必要な設定（config.yaml）:
  - wordpress.url
  - wordpress.api_base
  - 環境変数: WP_USERNAME, WP_APP_PASSWORD
"""

import os
import json
from pathlib import Path
from datetime import datetime

# ========================================
# 設定を読み込む
# ========================================
try:
    import yaml
    CONFIG_FILE = Path(__file__).resolve().parent.parent / 'config.yaml'
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        CONFIG = yaml.safe_load(f) or {}
except:
    CONFIG = {}

WP_URL = CONFIG.get('wordpress', {}).get('url', 'https://example.com')
WP_API_BASE = CONFIG.get('wordpress', {}).get('api_base', f'{WP_URL}/wp-json/wp/v2')

# ========================================
# ロギング
# ========================================
def log_info(msg):
    """情報ログ"""
    print(f'[INFO] {msg}')

def log_error(msg):
    """エラーログ"""
    print(f'[ERROR] {msg}')

def log_warn(msg):
    """警告ログ"""
    print(f'[WARN] {msg}')

# ========================================
# WordPress REST API
# ========================================
def upload_media(file_path, alt_text=None, description=None):
    """
    WordPress メディアライブラリに画像をアップロード

    Args:
        file_path: 画像ファイルパス
        alt_text: alt テキスト
        description: 説明

    Returns:
        dict: アップロード結果（media ID等）
    """
    # TODO: 実装
    # - REST API /media エンドポイント を呼び出し
    # - multipart/form-data で画像を送信
    # - メタデータを設定
    # - エラーハンドリング
    pass

# ========================================
# メディア確認（重複チェック）
# ========================================
def get_existing_media(search_term=None):
    """
    既存メディアを取得（重複チェック用）

    Args:
        search_term: 検索キーワード

    Returns:
        list: メディア情報のリスト
    """
    # TODO: 実装
    # - REST API /media エンドポイント を呼び出し
    # - ファイル名またはメタデータで重複をチェック
    pass

# ========================================
# メディアカテゴリ設定
# ========================================
def set_media_category(media_id, category):
    """
    メディアにカテゴリを割り当て

    Args:
        media_id: WordPress media ID
        category: カテゴリ名
    """
    # TODO: 実装
    # - custom taxonomy または meta を使用
    # - メディアライブラリでの検索性向上
    pass

# ========================================
# メイン処理（テンプレート）
# ========================================
def main():
    """メイン処理"""
    log_info('WordPress メディア一括アップロードスクリプト（テンプレート版）')

    # TODO: コマンドライン引数をパース
    # TODO: 入力ディレクトリをスキャン
    # TODO: 各画像について:
    #   - 既存メディアと重複チェック
    #   - メタデータ（alt, 説明）を用意
    #   - アップロード実行
    # TODO: 進捗レポートを表示

    log_warn('このスクリプトはテンプレート版です。実装が必要です。')
    log_info('実装ガイド: https://github.com/itochaso/contentproducer-agents/wiki/wp-media-upload')

    return 0

if __name__ == '__main__':
    import sys
    sys.exit(main())
