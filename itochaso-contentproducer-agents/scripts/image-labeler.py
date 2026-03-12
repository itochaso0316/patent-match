#!/usr/bin/env python3
"""
画像ラベリング・自動 alt テキスト生成スクリプト（テンプレート）

クライアント向けにカスタマイズしてください

機能（実装予定）:
  - ローカル画像フォルダをスキャン
  - Vision API (Claude / GPT-4V / 独自) を使って画像を分析
  - alt テキストを自動生成
  - メタデータ JSON を生成（画像インベントリ）
  - WordPress に一括アップロード（オプション）

使い方:
  python scripts/image-labeler.py [--input DIR] [--output FILE] [--model claude|gpt4v|local]

必要な設定（config.yaml）:
  - image_labeling.enabled
  - image_labeling.model
  - image_labeling.brand_context
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
# 画像スキャン
# ========================================
def scan_images(input_dir):
    """
    入力ディレクトリから画像ファイルをスキャン

    Returns:
        list: 画像ファイルパスのリスト
    """
    # TODO: 実装
    # 対応形式: jpg, jpeg, png, webp, gif
    # 除外: _tmp, _archive など
    pass

# ========================================
# alt テキスト生成
# ========================================
def generate_alt_text(image_path, model='claude'):
    """
    Vision API を使って画像の alt テキストを生成

    Args:
        image_path: 画像ファイルパス
        model: 使用するモデル (claude / gpt4v / local)

    Returns:
        str: 生成された alt テキスト
    """
    # TODO: 実装
    # Vision API を呼び出す
    # クライアント固有のブランドガイドラインを適用
    # 例: 医療機関なら「患者プライバシーの配慮」など
    pass

# ========================================
# メタデータ生成
# ========================================
def generate_metadata(image_path, alt_text):
    """
    画像メタデータを生成

    Args:
        image_path: 画像ファイルパス
        alt_text: alt テキスト

    Returns:
        dict: メタデータ
    """
    # TODO: 実装
    # - ファイルサイズ、解像度
    # - 生成日時、モデル情報
    # - 使用上の注記（プライバシー等）
    pass

# ========================================
# メイン処理（テンプレート）
# ========================================
def main():
    """メイン処理"""
    log_info('画像ラベリング・alt テキスト生成スクリプト（テンプレート版）')

    # TODO: コマンドライン引数をパース
    # TODO: 画像をスキャン
    # TODO: 各画像について alt テキストを生成
    # TODO: メタデータを生成
    # TODO: JSON を保存
    # TODO: （オプション）WordPress にアップロード

    log_warn('このスクリプトはテンプレート版です。実装が必要です。')
    log_info('実装ガイド: https://github.com/itochaso/contentproducer-agents/wiki/image-labeler')

    return 0

if __name__ == '__main__':
    import sys
    sys.exit(main())
