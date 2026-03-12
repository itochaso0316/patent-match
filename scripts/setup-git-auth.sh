#!/bin/bash
# =============================================================
# patent-match Git認証セットアップスクリプト
# Cowork (MacBook Pro) / OpenClaw (Mac mini) 共用
# =============================================================
#
# 使い方:
#   cd ~/Projects/patent-match
#   bash scripts/setup-git-auth.sh
#
# 前提: GitHub PAT (Fine-grained token) が発行済みであること
#   - トークン名: patent-match-cowork-openclaw
#   - 権限: Contents (Read and write) + Metadata + Workflows
#   - 対象リポ: itochaso0316/patent-match
# =============================================================

set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_URL=$(git -C "$REPO_DIR" remote get-url origin 2>/dev/null)

echo "=== patent-match Git認証セットアップ ==="
echo "リポジトリ: $REPO_DIR"
echo "現在のリモート: $REMOTE_URL"
echo ""

# すでにトークン付きURLの場合はスキップ
if echo "$REMOTE_URL" | grep -q "@github.com"; then
    echo "✅ すでにトークン付きURLが設定されています"
    echo "   git pull/push は認証なしで実行できます"
    exit 0
fi

echo "GitHub Personal Access Token を入力してください:"
echo "(patent-match-cowork-openclaw トークン)"
read -rs GITHUB_PAT

if [ -z "$GITHUB_PAT" ]; then
    echo "❌ トークンが入力されませんでした"
    exit 1
fi

# トークン付きURLに変更
NEW_URL="https://itochaso0316:${GITHUB_PAT}@github.com/itochaso0316/patent-match.git"
git -C "$REPO_DIR" remote set-url origin "$NEW_URL"

echo ""
echo "✅ Git認証を設定しました"
echo "   以下のコマンドが認証なしで使えます:"
echo "   git pull origin main"
echo "   git push origin main"
echo ""

# 接続テスト
echo "接続テスト中..."
if git -C "$REPO_DIR" fetch origin 2>/dev/null; then
    echo "✅ 接続OK"
else
    echo "❌ 接続に失敗しました。トークンを確認してください"
    exit 1
fi

echo ""
echo "=== セットアップ完了 ==="
