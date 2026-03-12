#!/usr/bin/env node
/**
 * SEO プリデプロイチェック
 *
 * 使い方:
 *   node scripts/seo-pre-deploy.js <file1.html> [file2.html...] [--output audits/seo-pre-deploy-YYYYMMDD.md]
 *
 * stdoutにJSON配列を出力（slack-feedback.js から spawnSync で呼び出す）
 * チェック項目:
 *   1. H1タグ数（1個のみ許可）
 *   2. alt="" または alt属性なしの画像
 *   3. href="http://" リンク（http非推奨）
 *   4. 絶対パス内部リンク（misao-ladies.jpへのhref）
 *   5. JSON-LD構造化データの有無
 *   6. H2/H3見出しの有無
 *   7. 概算ワード数（300語未満で警告）
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const outputIdx = args.indexOf('--output');
const outputFile = outputIdx !== -1 ? args[outputIdx + 1] : null;
const htmlFiles = args.filter((a, i) => !a.startsWith('--') && i !== outputIdx - 0 && (outputIdx === -1 || i !== outputIdx + 1));

if (htmlFiles.length === 0) {
  console.error('使い方: node scripts/seo-pre-deploy.js <file.html> [...] [--output path]');
  process.exit(1);
}

/**
 * HTMLファイルをチェックして結果オブジェクトを返す
 */
function checkFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      file: filePath,
      basename: path.basename(filePath),
      ok: false,
      errors: [`ファイルが見つかりません: ${filePath}`],
      warnings: [],
      info: [],
    };
  }

  const html = fs.readFileSync(filePath, 'utf-8');
  const errors = [];
  const warnings = [];
  const info = [];

  // 1. H1タグ数
  const h1Matches = html.match(/<h1[\s>]/gi) || [];
  if (h1Matches.length === 0) {
    errors.push('H1タグがありません');
  } else if (h1Matches.length > 1) {
    errors.push(`H1タグが${h1Matches.length}個あります（1個のみ許可）`);
  }

  // 2. alt属性なし or alt="" の画像
  const imgTags = html.match(/<img[^>]+>/gi) || [];
  let emptyAlt = 0;
  let missingAlt = 0;
  for (const img of imgTags) {
    if (!/alt\s*=/i.test(img)) {
      missingAlt++;
    } else if (/alt\s*=\s*["']\s*["']/i.test(img)) {
      emptyAlt++;
    }
  }
  if (missingAlt > 0) errors.push(`alt属性なしの画像: ${missingAlt}件`);
  if (emptyAlt > 0) warnings.push(`空のalt属性: ${emptyAlt}件`);

  // 3. http:// リンク（非推奨）
  const httpLinks = (html.match(/href\s*=\s*["']http:\/\//gi) || []).length;
  if (httpLinks > 0) warnings.push(`http://リンク: ${httpLinks}件（https推奨）`);

  // 4. 絶対パス内部リンク（misao-ladies.jp）
  const absInternalLinks = (html.match(/href\s*=\s*["']https?:\/\/(?:www\.)?misao-ladies\.jp/gi) || []).length;
  if (absInternalLinks > 0) warnings.push(`絶対パス内部リンク: ${absInternalLinks}件（相対パス推奨）`);

  // 5. JSON-LD構造化データ
  const hasJsonLd = /<script[^>]+type\s*=\s*["']application\/ld\+json["']/i.test(html);
  if (!hasJsonLd) warnings.push('JSON-LD構造化データなし');

  // 6. H2/H3見出し
  const hasH2 = /<h2[\s>]/i.test(html);
  const hasH3 = /<h3[\s>]/i.test(html);
  if (!hasH2) warnings.push('H2見出しがありません');
  if (!hasH3) info.push('H3見出しがありません');

  // 7. 概算ワード数（タグを除いたテキスト、日本語は1文字=1語換算）
  const textOnly = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const wordCount = textOnly.replace(/[^\u3000-\u9fff\u30a0-\u30ff\uff00-\uffef\u0021-\u007e]/g, '').length;
  if (wordCount < 300) warnings.push(`テキスト量が少ない: 約${wordCount}文字（300文字以上推奨）`);
  else info.push(`テキスト量: 約${wordCount}文字`);

  const ok = errors.length === 0 && warnings.length === 0;

  return {
    file: filePath,
    basename: path.basename(filePath),
    ok,
    errors,
    warnings,
    info,
  };
}

/**
 * Markdown レポートを生成
 */
function buildMarkdown(results, date) {
  const lines = [
    `# SEO プリデプロイチェック — ${date}`,
    '',
    `チェック日時: ${new Date().toISOString()}`,
    `対象ファイル: ${results.length}件`,
    '',
    '---',
    '',
  ];

  for (const r of results) {
    const statusIcon = r.errors.length > 0 ? '❌' : r.warnings.length > 0 ? '⚠️' : '✅';
    lines.push(`## ${statusIcon} ${r.basename}`);
    lines.push('');
    if (r.errors.length > 0) {
      lines.push('**エラー（要修正）:**');
      r.errors.forEach(e => lines.push(`- ❌ ${e}`));
      lines.push('');
    }
    if (r.warnings.length > 0) {
      lines.push('**警告:**');
      r.warnings.forEach(w => lines.push(`- ⚠️ ${w}`));
      lines.push('');
    }
    if (r.info.length > 0) {
      lines.push('**情報:**');
      r.info.forEach(i => lines.push(`- ℹ️ ${i}`));
      lines.push('');
    }
    if (r.ok) {
      lines.push('問題なし ✅');
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  // サマリー
  const errorCount = results.filter(r => r.errors.length > 0).length;
  const warnCount = results.filter(r => r.warnings.length > 0 && r.errors.length === 0).length;
  const okCount = results.filter(r => r.ok).length;
  lines.push(`## サマリー`);
  lines.push('');
  lines.push(`- ✅ 問題なし: ${okCount}件`);
  lines.push(`- ⚠️ 警告あり: ${warnCount}件`);
  lines.push(`- ❌ エラーあり: ${errorCount}件`);
  lines.push('');

  return lines.join('\n');
}

// メイン処理
const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const results = htmlFiles.map(f => checkFile(f));

// Markdown レポート保存
const reportPath = outputFile || path.join(__dirname, '..', 'audits', `seo-pre-deploy-${dateStr}.md`);
const reportDir = path.dirname(reportPath);
if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportPath, buildMarkdown(results, dateStr), 'utf-8');

// stdout に JSON 出力（slack-feedback.js が受け取る）
process.stdout.write(JSON.stringify(results));
