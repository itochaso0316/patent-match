#!/usr/bin/env node
/**
 * Slack フィードバック連携スクリプト
 *
 * サブコマンド:
 *   post              — プレビュー確認依頼を1件投稿
 *   batch             — 複数ページの確認依頼を対話式で一括投稿（Y/N選択）
 *   fetch             — スレッド返信（フィードバック）を取得 → feedback/*.md
 *   status            — 全ページのSlack依頼ステータスを表示
 *   sync              — Slackスレッドを全スキャンし、対応状況・承認状況を slack-status.json に同期
 *   check-approvals   — 院長の公開承認をSlackスレッドから検出（syncのエイリアス）
 *   deploy-plan       — 承認済みページのデプロイ計画を #misao-deploy に投稿
 *   deploy-check      — Kosukeのデプロイ承認を確認
 *   deploy-execute    — 承認済み計画をWP REST APIで公開実行
 *   deploy-reply      — デプロイ計画スレッドに返信
 *   reply             — フィードバックスレッドに返信（院長への対応状況報告）
 *
 * 環境変数:
 *   SLACK_BOT_TOKEN        — Bot User OAuth Token（xoxb-...）
 *   SLACK_CHANNEL_ID       — フィードバック用チャンネルID（C0xxxxxxx）
 *   SLACK_DEPLOY_CHANNEL_ID — デプロイ承認用チャンネルID（未設定時は SLACK_CHANNEL_ID を使用）
 *
 * 必要な Bot Token Scopes:
 *   channels:history, channels:read, chat:write,
 *   files:read, reactions:write, reactions:read
 *
 * 使い方:
 *   node scripts/slack-feedback.js post --url URL --title TITLE [--clinic misao|louis-kano|all] [--type new|update]
 *   node scripts/slack-feedback.js batch [--files path1 path2 ...]
 *   node scripts/slack-feedback.js fetch [--dry-run] [--count]
 *   node scripts/slack-feedback.js status
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

// --- 設定 ---
const yaml = require('js-yaml');

const BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const CHANNEL_ID = process.env.SLACK_CHANNEL_ID;
const DEPLOY_CHANNEL_ID = process.env.SLACK_DEPLOY_CHANNEL_ID || CHANNEL_ID;
const FEEDBACK_DIR = path.join(__dirname, '..', 'feedback');
const STATUS_FILE = path.join(__dirname, '..', 'pages', 'preview', 'slack-status.json');
const PROCESSED_EMOJI = 'white_check_mark';

const CONFIG = require('../config.yaml');
const WP_PREVIEW_BASE = CONFIG.wordpress?.url || 'https://www.{{DOMAIN}}';
const PREVIEW_TOKEN = CONFIG.wordpress?.preview_token || 'preview-2026';

// --- コマンド解析 ---
const args = process.argv.slice(2);
const COMMAND = args[0] || 'fetch';

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}
function getArgList(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return [];
  const values = [];
  for (let i = idx + 1; i < args.length; i++) {
    if (args[i].startsWith('--')) break;
    values.push(args[i]);
  }
  return values;
}
const hasFlag = (name) => args.includes(`--${name}`);

// --- バリデーション ---
if (!BOT_TOKEN || !CHANNEL_ID) {
  console.error('❌ 環境変数が未設定です:');
  if (!BOT_TOKEN) console.error('   SLACK_BOT_TOKEN=xoxb-...');
  if (!CHANNEL_ID) console.error('   SLACK_CHANNEL_ID=C0xxxxxxx');
  process.exit(1);
}

// デプロイコマンド時にデプロイチャンネル未設定なら警告
const DEPLOY_COMMANDS = ['deploy-plan', 'deploy-check', 'deploy-reply', 'check-approvals', 'deploy-execute'];
if (DEPLOY_COMMANDS.includes(COMMAND) && !process.env.SLACK_DEPLOY_CHANNEL_ID) {
  console.warn('⚠️  SLACK_DEPLOY_CHANNEL_ID が未設定のため、SLACK_CHANNEL_ID を使用します。');
  console.warn('   デプロイ専用チャンネルを使うには .env に SLACK_DEPLOY_CHANNEL_ID を設定してください。\n');
}

// ============================================================
// ステータス管理（slack-status.json）
// ============================================================
function loadStatus() {
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
  } catch {
    return { requests: {} };
  }
}

function saveStatus(data) {
  fs.writeFileSync(STATUS_FILE, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function recordRequest(filePath, meta) {
  const data = loadStatus();
  data.requests[filePath] = {
    title: meta.title,
    clinic: meta.clinic,
    type: meta.type,
    url: meta.url,
    thread_ts: meta.thread_ts,
    requested_at: new Date().toISOString(),
  };
  saveStatus(data);
}

// ============================================================
// ページファイル → メタデータ推定
// ============================================================

// WP_PAGE_ID: ファイルパス → WordPress ページID
// これらのマッピングは、各クライアント専用に config.yaml で管理してください。
// テンプレート例:
// WP_PAGE_ID:
//   pages/preview/service1.html: 1234
//   pages/preview/service2.html: 5678

const LABEL_MAP = {
  'pages/preview/childbirth.html': '分娩・出産',
  'pages/preview/cost.html': '費用',
  'pages/preview/facilities.html': '施設・設備',
  'pages/preview/general.html': '一般婦人科',
  'pages/preview/hospitalization.html': '入院',
  'pages/preview/painless.html': '無痛分娩',
  'pages/preview/postpartum.html': '産後ケア',
  'pages/preview/reservation.html': '受診予約',
  'pages/preview/return.html': '里帰り出産',
  'pages/preview/fertility.html': '不妊治療（概要）',
  'pages/preview/doctors.html': '医師紹介',
  'pages/preview/pregnancyscan.html': '胎児ドック',
  'pages/preview/pediatric-checkup.html': '小児健診',
  'pages/preview/planned-delivery.html': '計画分娩',
  'pages/fertility/top.html': '不妊治療TOP',
  'pages/fertility/syoshin.html': '初診',
  'pages/fertility/funinsyou.html': '不妊症について',
  'pages/fertility/kensa.html': '検査',
  'pages/fertility/chiryou.html': '治療について',
  'pages/fertility/taigai-jyusei.html': '体外受精',
  'pages/fertility/taigai-jyusei-step.html': '体外受精 ステップ',
  'pages/fertility/seisyoku-hojyo.html': '生殖補助医療',
  'pages/fertility/touketu-hozon.html': '凍結保存',
  'pages/fertility/dansei-funin.html': '男性不妊',
  'pages/fertility/hanpuku-fuseikou.html': '反復不成功',
  'pages/fertility/regenerative-prp.html': '再生医療・PRP',
  'pages/fertility/risk.html': 'リスク・副作用',
  'pages/fertility/hiyou.html': '費用',
  'pages/fertility/faq.html': 'よくある質問',
  'pages/louis-kano/top.html': 'ルイかのう院 TOP',
  'pages/louis-kano/louis-kano-medical.html': '診療内容',
  'pages/louis-kano/louis-kano-reservation.html': '予約',
  'pages/recruit.html': '採用情報（一覧）',
  'pages/recruit/josanshi-jokin.html': '助産師（常勤）',
  'pages/recruit/josanshi-part.html': '助産師（パート）',
  'pages/articles-index.html': 'コラム一覧',
  'pages/articles/article-age.html': '年齢と妊娠',
  'pages/articles/article-funin.html': '不妊治療について',
  'pages/articles/article-infertility.html': '不妊症の原因',
  'pages/articles/article-ovulation.html': '排卵について',
  'pages/preview/bridal-check.html': 'ブライダルチェック',
  'pages/preview/bridal-check-mens.html': '男性ブライダルチェック',
  'pages/preview/reservation-guide.html': '予約ガイド',
  'pages/preview/slack-guide-for-director.html': 'Slackガイド（院長向け）',
};

// REPLACE_URL: プレビューページが公開時にリプレイスする既存URL（既知の場合のみ）
// Slackフィードバックスレッドで「リプレイス: URL」とコメントすると動的に追加される
const REPLACE_URL = {
  'pages/preview/childbirth.html': 'https://www.{{DOMAIN}}/childbirth/',
  'pages/preview/cost.html': 'https://www.{{DOMAIN}}/cost/',
  'pages/preview/facilities.html': 'https://www.{{DOMAIN}}/facilities/',
  'pages/preview/general.html': 'https://www.{{DOMAIN}}/general/',
  'pages/preview/hospitalization.html': 'https://www.{{DOMAIN}}/hospitalization/',
  'pages/preview/painless.html': 'https://www.{{DOMAIN}}/painless/',
  'pages/preview/postpartum.html': 'https://www.{{DOMAIN}}/postpartum/',
  'pages/preview/reservation.html': 'https://www.{{DOMAIN}}/reservation/',
  'pages/preview/return.html': 'https://www.{{DOMAIN}}/return/',
  'pages/preview/fertility.html': 'https://www.{{DOMAIN}}/fertility/',
  'pages/preview/doctors.html': 'https://www.{{DOMAIN}}/doctors/',
  'pages/preview/pregnancyscan.html': 'https://www.{{DOMAIN}}/pregnancyscan/',
  // 新規ページ（リプレイス先なし）
  // 'pages/preview/reservation-guide.html': null,
  // 'pages/preview/bridal-check.html': null,
};

// リプレイスURLを取得（slack-status.json のユーザー指定 > REPLACE_URL マップ > null）
function getReplaceUrl(filePath) {
  const data = loadStatus();
  const info = data.requests[filePath];
  // Slackスレッドで指定されたリプレイスURL（動的）
  if (info && info.replace_url) return info.replace_url;
  // 静的マップ
  if (REPLACE_URL[filePath]) return REPLACE_URL[filePath];
  return null;
}

function guessClinic(filePath) {
  if (filePath.includes('louis-kano')) return 'louis-kano';
  return 'misao';
}

function buildPreviewUrl(filePath) {
  const wpId = WP_PAGE_ID[filePath];
  if (wpId) return `${WP_PREVIEW_BASE}/?page_id=${wpId}&preview_token=${PREVIEW_TOKEN}`;
  return null;
}

// ============================================================
// Slack API ヘルパー
// ============================================================
function slackAPI(method, params = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://slack.com/api/${method}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const options = { headers: { 'Authorization': `Bearer ${BOT_TOKEN}` } };
    https.get(url.toString(), options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (!json.ok) reject(new Error(`Slack API [${method}]: ${json.error}`));
          else resolve(json);
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function slackPost(method, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const options = {
      hostname: 'slack.com',
      path: `/api/${method}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BOT_TOKEN}`,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (!json.ok) reject(new Error(`Slack API [${method}]: ${json.error}`));
          else resolve(json);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ============================================================
// readline ヘルパー（Y/N入力）
// ============================================================
function askYN(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase().startsWith('y'));
    });
  });
}

// ============================================================
// POST: 1件投稿
// ============================================================
async function postSingle(previewUrl, title, clinic, type) {
  const clinicLabel = { 'misao': '🏥 本院', 'louis-kano': '🩷 ルイかのう院', 'all': '🏥 全体' }[clinic] || '🏥 本院';
  const typeLabel = { 'new': '🆕 新規ページ', 'update': '📝 既存ページ改善' }[type] || '📝 既存ページ改善';

  const blocks = [
    { type: 'section', text: { type: 'mrkdwn', text: `<!channel>\n*📄 プレビュー確認依頼*\n\n*${title}*\n${clinicLabel}　|　${typeLabel}` } },
    { type: 'section', text: { type: 'mrkdwn', text: `👉 <${previewUrl}|プレビューを確認する>` } },
    { type: 'divider' },
    { type: 'context', elements: [{ type: 'mrkdwn', text: '💬 このメッセージに *スレッドで返信* してフィードバックをお送りください。テキスト・画像どちらもOKです。' }] }
  ];

  const result = await slackPost('chat.postMessage', {
    channel: CHANNEL_ID,
    text: `<!channel> 📄 プレビュー確認依頼: ${title}`,
    blocks,
    unfurl_links: false
  });

  return result.ts;
}

async function postPreviewRequest() {
  const previewUrl = getArg('url');
  const title = getArg('title');
  const clinic = getArg('clinic') || 'misao';
  const type = getArg('type') || 'update';
  const filePath = getArg('file') || '';

  if (!previewUrl || !title) {
    console.error('❌ 必須: --url, --title');
    console.error('例: node scripts/slack-feedback.js post --url "URL" --title "タイトル" --file "pages/recruit/josanshi-jokin.html"');
    process.exit(1);
  }

  const ts = await postSingle(previewUrl, title, clinic, type);

  // ステータス記録
  if (filePath) {
    recordRequest(filePath, { title, clinic, type, url: previewUrl, thread_ts: ts });
  }

  console.log(`✅ 投稿完了: ${title}`);
  console.log(`   thread_ts: ${ts}`);
}

// ============================================================
// BATCH: 複数ページを対話式で一括投稿
// ============================================================
async function batchPost() {
  let files = getArgList('files');

  // --files が指定されていない場合、最近変更された pages/ のHTMLを検出
  if (files.length === 0) {
    const baseDir = path.join(__dirname, '..');
    const dirs = ['pages/preview', 'pages/fertility', 'pages/louis-kano', 'pages/recruit', 'pages/articles'];
    const rootFiles = ['pages/recruit.html', 'pages/articles-index.html'];
    const allFiles = [];

    for (const dir of dirs) {
      const fullDir = path.join(baseDir, dir);
      if (!fs.existsSync(fullDir)) continue;
      for (const f of fs.readdirSync(fullDir)) {
        if (f.endsWith('.html') && !f.includes('プレビュー')) {
          allFiles.push(path.join(dir, f).replace(/\\/g, '/'));
        }
      }
    }
    for (const rf of rootFiles) {
      if (fs.existsSync(path.join(baseDir, rf))) allFiles.push(rf);
    }
    files = allFiles;
  }

  if (files.length === 0) {
    console.log('📭 対象ファイルがありません');
    process.exit(0);
  }

  // ステータス読み込み
  const status = loadStatus();

  // 一覧表示
  console.log('━'.repeat(60));
  console.log('📄 プレビュー確認依頼 — 一括送信');
  console.log('━'.repeat(60));
  console.log('');

  const pending = [];
  for (const file of files) {
    const label = LABEL_MAP[file] || path.basename(file, '.html');
    const clinic = guessClinic(file);
    const clinicIcon = clinic === 'louis-kano' ? '🩷' : '🏥';
    const previewUrl = buildPreviewUrl(file);
    const existing = status.requests[file];

    if (existing) {
      const date = existing.requested_at ? existing.requested_at.substring(0, 10) : '?';
      console.log(`  ✅ ${clinicIcon} ${label}  — 依頼済み (${date})`);
    } else if (!previewUrl) {
      console.log(`  ⚠️  ${clinicIcon} ${label}  — WP未登録（スキップ）`);
    } else {
      console.log(`  🆕 ${clinicIcon} ${label}`);
      pending.push({ file, label, clinic, previewUrl });
    }
  }

  console.log('');
  console.log(`━ 合計: ${files.length}件（未依頼: ${pending.length}件、依頼済み: ${files.length - pending.length}件）`);
  console.log('');

  if (pending.length === 0) {
    console.log('✅ 全ページ確認依頼済みです');
    process.exit(0);
  }

  // 対話式 Y/N
  let sent = 0;
  for (const item of pending) {
    const clinicIcon = item.clinic === 'louis-kano' ? '🩷' : '🏥';
    const yes = await askYN(`  ${clinicIcon} ${item.label} → Slack に送信？ [Y/n] `);

    if (yes) {
      try {
        const ts = await postSingle(item.previewUrl, item.label, item.clinic, 'update');
        recordRequest(item.file, {
          title: item.label,
          clinic: item.clinic,
          type: 'update',
          url: item.previewUrl,
          thread_ts: ts,
        });
        console.log(`    ✅ 送信完了 (ts: ${ts})`);
        sent++;
      } catch (e) {
        console.error(`    ❌ 送信失敗: ${e.message}`);
      }
    } else {
      console.log(`    ⏭  スキップ`);
    }
  }

  console.log(`\n${'━'.repeat(60)}`);
  console.log(`✅ ${sent}件 送信完了`);
  if (sent > 0) {
    console.log('ページ管理Excelを更新: python scripts/generate-status-xlsx.py');
  }
}

// ============================================================
// STATUS: ステータス一覧表示
// ============================================================
function showStatus() {
  const data = loadStatus();
  const requests = data.requests || {};
  const keys = Object.keys(requests);

  if (keys.length === 0) {
    console.log('📭 Slack確認依頼の履歴はありません');
    return;
  }

  console.log('━'.repeat(60));
  console.log('📋 Slack 確認依頼ステータス');
  console.log('━'.repeat(60));

  // カテゴリ別に分類
  const categories = {
    unhandled: [],    // 🔴 未対応FB
    conditional: [],  // 🟡 条件付き承認
    handled: [],      // 🔧 対応済み（再確認待ち）
    approved: [],     // 🟢 公開承認
    deployed: [],     // 🚀 デプロイ済み
    waiting: [],      // ⏳ 返信待ち
  };

  for (const [file, info] of Object.entries(requests)) {
    const label = info.title || file;
    const clinicIcon = info.clinic === 'louis-kano' ? '🩷' : '🏥';
    const date = info.requested_at ? info.requested_at.substring(0, 10) : '?';
    const entry = { file, label, clinicIcon, date, info };

    if (info.deployed) {
      categories.deployed.push(entry);
    } else if (info.approval === 'approved') {
      categories.approved.push(entry);
    } else if (info.approval === 'conditional') {
      categories.conditional.push(entry);
    } else if (info.handled) {
      categories.handled.push(entry);
    } else if (info.handled === false) {
      // 明示的にfalse = 未対応FBあり
      categories.unhandled.push(entry);
    } else {
      categories.waiting.push(entry);
    }
  }

  if (categories.unhandled.length > 0) {
    console.log(`\n🔴 未対応フィードバック（${categories.unhandled.length}件）:`);
    categories.unhandled.forEach(e => console.log(`  ${e.clinicIcon} ${e.label}  — ${e.date}`));
  }
  if (categories.conditional.length > 0) {
    console.log(`\n🟡 条件付き承認（${categories.conditional.length}件）:`);
    categories.conditional.forEach(e => console.log(`  ${e.clinicIcon} ${e.label}  — ${e.date}`));
  }
  if (categories.handled.length > 0) {
    console.log(`\n🔧 対応済み — 再確認待ち（${categories.handled.length}件）:`);
    categories.handled.forEach(e => {
      const handledDate = e.info.handled_at ? e.info.handled_at.substring(0, 10) : '?';
      console.log(`  ${e.clinicIcon} ${e.label}  — 対応: ${handledDate}`);
    });
  }
  if (categories.approved.length > 0) {
    console.log(`\n🟢 公開承認済み（${categories.approved.length}件）:`);
    categories.approved.forEach(e => console.log(`  ${e.clinicIcon} ${e.label}  — ${e.date}`));
  }
  if (categories.deployed.length > 0) {
    console.log(`\n🚀 デプロイ済み（${categories.deployed.length}件）:`);
    categories.deployed.forEach(e => {
      const deployDate = e.info.deployed_at ? e.info.deployed_at.substring(0, 10) : '?';
      console.log(`  ${e.clinicIcon} ${e.label}  — ${deployDate}`);
    });
  }
  if (categories.waiting.length > 0) {
    console.log(`\n⏳ 院長返信待ち（${categories.waiting.length}件）:`);
    categories.waiting.forEach(e => console.log(`  ${e.clinicIcon} ${e.label}  — ${e.date}`));
  }

  console.log(`\n${'━'.repeat(60)}`);
  console.log(`合計: ${keys.length}件 | 未対応: ${categories.unhandled.length} | 対応済: ${categories.handled.length} | 承認: ${categories.approved.length} | 待ち: ${categories.waiting.length} | 公開済: ${categories.deployed.length}`);
  console.log('');
  console.log('💡 最新状態に更新: node scripts/slack-feedback.js sync');
}

// ============================================================
// FETCH: スレッド返信からフィードバック取り込み
// ============================================================
function isProcessed(message) {
  if (!message.reactions) return false;
  return message.reactions.some(r => r.name === PROCESSED_EMOJI);
}

function classifyFeedback(text) {
  const rules = [
    [/写真|画像|差し替え|変えて|photo|image/i, 'ページ改善'],
    [/新しいページ|追加|作って|新規/i, '新規ページ要望'],
    [/文字|テキスト|書き直し|修正|誤字|タイプ/i, 'コンテンツ修正'],
    [/デザイン|色|レイアウト|余白|フォント|CSS/i, 'テーマ・デザイン修正'],
    [/動かない|エラー|崩れ|おかしい|バグ/i, 'バグ・不具合報告'],
    [/他院|競合|参考|真似/i, '競合参考'],
    [/アイデア|思いつき|メモ/i, 'アイデア・メモ'],
  ];
  for (const [regex, type] of rules) { if (regex.test(text)) return type; }
  return 'クライアント要望';
}

// --- 承認ステータス判定 ---
// 返り値: 'approved' | 'conditional' | 'feedback'
function classifyApproval(text) {
  const t = text.trim();

  // 公開承認キーワード（「公開して」「OK」「問題ない」等を含み、修正指示を含まない）
  const approvalPatterns = [
    /^(OK|ok|おk|オッケー|オーケー|いいね|いいよ|問題な[いし]|大丈夫|公開して|これでいい|LGTM|lgtm|承認|了解|よさそう|バッチリ|完璧)/,
    /公開し[てた]?(ください|OK|おk|下さい|よい|てよい|ても[いよ]い|て(構わない|かまわない|問題ない|大丈夫))?[。.！!]?$/,
    /問題(ない|なし|ありません).*公開/,
    /公開(OK|おk|可|して[よい良]い)[。.！!]?$/,
    /^👍/,
  ];

  // 条件付き承認キーワード（修正指示 + 公開指示の両方を含む）
  const conditionalPatterns = [
    /(変えて|直して|入れ替えて|修正して|差し替えて|更新して).*(公開|OK|ok|おk)/,
    /(公開|OK|ok).*(変えて|直して|入れ替えて|修正して|差し替えて|更新して)/,
    /だけ.*(変えて|直して|入れ替えて).*(公開|して|OK)/,
  ];

  // 条件付きを先にチェック（「写真変えて公開して」は conditional）
  for (const p of conditionalPatterns) {
    if (p.test(t)) return 'conditional';
  }

  // 純粋な承認チェック
  for (const p of approvalPatterns) {
    if (p.test(t)) return 'approved';
  }

  // それ以外はフィードバック
  return 'feedback';
}

// --- 承認ステータスを slack-status.json に記録 ---
function recordApproval(threadTs, approval, text) {
  const data = loadStatus();
  // thread_ts からファイルを逆引き
  for (const [file, info] of Object.entries(data.requests)) {
    if (info.thread_ts === threadTs) {
      info.approval = approval;
      info.approval_message = text.substring(0, 200);
      info.approval_at = new Date().toISOString();
      break;
    }
  }
  saveStatus(data);
}

function formatDate(ts) {
  const d = new Date(parseFloat(ts) * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatDateCompact(ts) { return formatDate(ts).replace(/-/g, ''); }

function parsePreviewPost(message) {
  const text = message.text || '';
  const blocks = message.blocks || [];
  let title = '', clinic = 'misao', type = 'update', previewUrl = '';
  for (const block of blocks) {
    if (block.type === 'section' && block.text && block.text.text) {
      const t = block.text.text;
      const titleMatch = t.match(/\*(.+?)\*/);
      if (titleMatch) title = titleMatch[1];
      if (t.includes('ルイかのう')) clinic = 'louis-kano';
      else if (t.includes('全体')) clinic = 'all';
      if (t.includes('新規')) type = 'new';
      const urlMatch = t.match(/<(.+?)\|/);
      if (urlMatch) previewUrl = urlMatch[1];
    }
  }
  if (!title) { const m = text.match(/プレビュー確認依頼:\s*(.+)/); if (m) title = m[1]; }
  return { title, clinic, type, previewUrl };
}

function createFeedbackFromThread(reply, parentMeta, threadIndex) {
  const dateCompact = formatDateCompact(reply.ts);
  const date = formatDate(reply.ts);
  const text = reply.text || '';
  const type = classifyFeedback(text);
  const approval = classifyApproval(text);
  const clinicLabel = { 'misao': '本院', 'louis-kano': 'ルイかのう院', 'all': '全体' }[parentMeta.clinic] || '本院';
  const typeLabel = { 'new': '新規ページ', 'update': 'ページ改善' }[parentMeta.type] || 'ページ改善';
  const images = (reply.files || []).filter(f => f.mimetype && f.mimetype.startsWith('image/')).map(f => f.url_private || f.permalink);

  const approvalLabel = {
    'approved': '✅ 公開承認',
    'conditional': '⚠️ 条件付き承認（修正後に公開）',
    'feedback': '💬 フィードバック（修正必要）'
  }[approval];

  const filename = `${dateCompact}-slack-${String(threadIndex).padStart(2, '0')}.md`;
  const filepath = path.join(FEEDBACK_DIR, filename);
  if (fs.existsSync(filepath)) return { filename, skipped: true };

  const content = `# フィードバック

**日付:** ${date}
**承認ステータス:** ${approvalLabel}
**種類:**
- [${type === 'ページ改善' ? 'x' : ' '}] ページ改善
- [${type === '新規ページ要望' ? 'x' : ' '}] 新規ページ要望
- [${type === 'テーマ・デザイン修正' ? 'x' : ' '}] テーマ・デザイン修正
- [${type === 'コンテンツ修正' ? 'x' : ' '}] コンテンツ修正
- [${type === 'バグ・不具合報告' ? 'x' : ' '}] バグ・不具合報告
- [${type === 'クライアント要望' ? 'x' : ' '}] クライアント要望
- [${type === '競合参考' ? 'x' : ' '}] 競合参考
- [${type === 'アイデア・メモ' ? 'x' : ' '}] アイデア・メモ

**対象ページ:** ${parentMeta.title || '（未特定）'}
**施設:** ${clinicLabel}
**種別:** ${typeLabel}
**プレビューURL:** ${parentMeta.previewUrl || '—'}

**優先度:** ${approval === 'approved' ? '高（公開待ち）' : '中'}

**Slack送信元:** #misao-feedback スレッド (thread_ts: ${reply.thread_ts}, ts: ${reply.ts})

---

## 内容

${text}

---

## 参考（あれば）

${images.length > 0 ? images.map(url => `- 添付画像: ${url}`).join('\n') : '- なし'}
`;

  if (!hasFlag('dry-run')) {
    fs.writeFileSync(filepath, content, 'utf-8');
    // 承認ステータスを slack-status.json にも記録
    if (approval === 'approved' || approval === 'conditional') {
      recordApproval(reply.thread_ts, approval, text);
    }
  }
  return { filename, skipped: false, type, approval, title: parentMeta.title, text: text.substring(0, 60) };
}

async function markProcessed(ts) {
  if (hasFlag('dry-run')) return;
  try {
    await slackPost('reactions.add', { channel: CHANNEL_ID, timestamp: ts, name: PROCESSED_EMOJI });
  } catch (e) {
    if (!e.message.includes('already_reacted')) console.warn(`  ⚠ リアクション付与失敗: ${e.message}`);
  }
}

async function fetchFeedback() {
  console.log('🔍 Slack フィードバックを取得中...\n');
  const history = await slackAPI('conversations.history', { channel: CHANNEL_ID, limit: '50' });
  const messages = history.messages || [];

  const previewPosts = messages.filter(m => m.bot_id && m.text && m.text.includes('プレビュー確認依頼'));
  const directMessages = messages.filter(m => !m.bot_id && !m.subtype && m.text && !m.thread_ts);

  if (previewPosts.length === 0 && directMessages.length === 0) {
    console.log('📭 フィードバックはありません');
    process.exit(0);
  }

  if (!fs.existsSync(FEEDBACK_DIR)) fs.mkdirSync(FEEDBACK_DIR, { recursive: true });

  let totalNew = 0, totalSkipped = 0, threadIndex = 1;
  const approvedPages = [];
  const conditionalPages = [];

  for (const post of previewPosts) {
    const meta = parsePreviewPost(post);
    console.log(`📄 ${meta.title || 'プレビュー投稿'}`);
    let replies;
    try {
      replies = await slackAPI('conversations.replies', { channel: CHANNEL_ID, ts: post.ts, limit: '100' });
    } catch (e) { console.warn(`  ⚠ スレッド取得失敗: ${e.message}`); continue; }

    const threadReplies = (replies.messages || []).filter(m => m.ts !== post.ts && !m.bot_id && !m.subtype && m.text);
    const unprocessed = threadReplies.filter(m => !isProcessed(m));
    if (unprocessed.length === 0) { console.log(`  └─ 新しい返信なし`); continue; }

    for (const reply of unprocessed) {
      const result = createFeedbackFromThread(reply, meta, threadIndex);
      if (!result.skipped) {
        await markProcessed(reply.ts);
        totalNew++;
        const badge = { 'approved': '🟢 公開承認', 'conditional': '🟡 条件付き', 'feedback': '💬' }[result.approval] || '💬';
        console.log(`  └─ ${badge} ${result.filename} — [${result.type}] ${result.text}...`);
        if (result.approval === 'approved') approvedPages.push(meta.title);
        if (result.approval === 'conditional') conditionalPages.push({ title: meta.title, text: result.text });
      } else { totalSkipped++; console.log(`  └─ ⏭  ${result.filename} — スキップ`); }
      threadIndex++;
    }
  }

  const unprocessedDirect = directMessages.filter(m => !isProcessed(m));
  if (unprocessedDirect.length > 0) {
    console.log(`\n💬 チャンネル直接投稿`);
    const tagMap = [
      [/リクルート|採用|求人|recruit/i, 'リクルート'], [/不妊|fertility/i, '不妊治療'],
      [/胎児|ドック|スクリーニング/i, '胎児ドック'], [/トップ|TOP|ホーム/i, 'TOP'],
      [/ルイ|louis|かのう/i, 'ルイかのう院'], [/診療|外来/i, '診療案内'], [/施設|院内/i, '施設案内'],
    ];
    for (const msg of unprocessedDirect) {
      const text = msg.text || '';
      const type = classifyFeedback(text);
      const dateCompact = formatDateCompact(msg.ts);
      const date = formatDate(msg.ts);
      let pageTag = '';
      for (const [regex, tag] of tagMap) { if (regex.test(text)) { pageTag = tag; break; } }
      const images = (msg.files || []).filter(f => f.mimetype && f.mimetype.startsWith('image/')).map(f => f.url_private || f.permalink);
      const filename = `${dateCompact}-slack-${String(threadIndex).padStart(2, '0')}.md`;
      const filepath = path.join(FEEDBACK_DIR, filename);
      if (fs.existsSync(filepath)) { totalSkipped++; threadIndex++; continue; }
      const content = `# フィードバック\n\n**日付:** ${date}\n**対象ページ:** ${pageTag || '（未特定）'}\n**優先度:** 中\n**Slack送信元:** #misao-feedback 直接投稿 (ts: ${msg.ts})\n\n---\n\n## 内容\n\n${text}\n\n---\n\n## 参考\n\n${images.length > 0 ? images.map(url => `- 添付画像: ${url}`).join('\n') : '- なし'}\n`;
      if (!hasFlag('dry-run')) fs.writeFileSync(filepath, content, 'utf-8');
      await markProcessed(msg.ts);
      totalNew++;
      console.log(`  └─ ✏️  ${filename} — [${type}] ${text.substring(0, 60)}...`);
      threadIndex++;
    }
  }

  console.log(`\n${'━'.repeat(50)}`);
  console.log(`✅ 完了: ${totalNew}件作成${totalSkipped > 0 ? `, ${totalSkipped}件スキップ` : ''}`);
  if (hasFlag('dry-run')) console.log('   （--dry-run: ファイル未作成）');

  // 承認サマリー
  if (approvedPages.length > 0) {
    console.log(`\n🟢 公開承認（${approvedPages.length}件）— そのまま公開可能:`);
    approvedPages.forEach(p => console.log(`   → ${p}`));
    console.log('\n   次のステップ: 「承認済みページを公開して」→ DPL エージェントが実行');
  }
  if (conditionalPages.length > 0) {
    console.log(`\n🟡 条件付き承認（${conditionalPages.length}件）— 修正後に公開:`);
    conditionalPages.forEach(p => console.log(`   → ${p.title}: ${p.text}...`));
    console.log('\n   次のステップ: 「feedback/ 処理して」→ 修正 → 自動で公開フローへ');
  }
  if (approvedPages.length === 0 && conditionalPages.length === 0 && totalNew > 0) {
    console.log('\n💬 全件フィードバック（修正対応が必要）');
    console.log('   次のステップ: 「feedback/ 処理して」で FBC → ORC に引き渡し');
  }
}

async function countFeedback() {
  const history = await slackAPI('conversations.history', { channel: CHANNEL_ID, limit: '50' });
  const messages = history.messages || [];
  let total = 0;
  const previewPosts = messages.filter(m => m.bot_id && m.text && m.text.includes('プレビュー確認依頼'));
  for (const post of previewPosts) {
    try {
      const replies = await slackAPI('conversations.replies', { channel: CHANNEL_ID, ts: post.ts, limit: '100' });
      total += (replies.messages || []).filter(m => m.ts !== post.ts && !m.bot_id && !m.subtype && m.text && !isProcessed(m)).length;
    } catch (e) { /* skip */ }
  }
  total += messages.filter(m => !m.bot_id && !m.subtype && m.text && !m.thread_ts && !isProcessed(m)).length;
  console.log(`📋 未処理フィードバック: ${total}件`);
}

// ============================================================
// SEO プリチェック（seo-pre-deploy.js を spawnSync で呼び出し）
// ============================================================
function runSeoCheck(pageFiles) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const auditDir = path.join(__dirname, '..', 'audits');
  const reportPath = path.join(auditDir, `seo-pre-deploy-${dateStr}.md`);
  const seoScript = path.join(__dirname, 'seo-pre-deploy.js');

  if (!fs.existsSync(seoScript)) {
    console.warn('⚠️  seo-pre-deploy.js が見つかりません。SEOチェックをスキップします。');
    return null;
  }

  const basedir = path.join(__dirname, '..');
  const absoluteFiles = pageFiles
    .map(f => path.join(basedir, f))
    .filter(f => fs.existsSync(f));

  if (absoluteFiles.length === 0) {
    console.warn('⚠️  SEOチェック対象HTMLが見つかりません。スキップします。');
    return null;
  }

  console.log(`\n🔍 SEOプリチェック実行中...（${absoluteFiles.length}ファイル）`);
  const result = spawnSync(process.execPath, [seoScript, ...absoluteFiles, '--output', reportPath], {
    encoding: 'utf-8',
    timeout: 30000,
  });

  if (result.error || result.status !== 0) {
    console.warn(`⚠️  SEOチェック失敗: ${result.error ? result.error.message : result.stderr}`);
    return null;
  }

  let seoResults = null;
  try {
    seoResults = JSON.parse(result.stdout);
  } catch {
    console.warn('⚠️  SEOチェック結果のJSON解析失敗。スキップします。');
    return null;
  }

  console.log(`✅ SEOチェック完了 → ${reportPath}`);
  return { results: seoResults, reportPath };
}

/**
 * SEOチェック結果をSlack Block Kit テキストに変換
 */
function buildSeoSummaryText(seoResults) {
  if (!seoResults || seoResults.length === 0) return null;

  const lines = seoResults.map(r => {
    const icon = r.errors.length > 0 ? '❌' : r.warnings.length > 0 ? '⚠️' : '✅';
    const issues = [...r.errors, ...r.warnings];
    const issueSummary = issues.length > 0 ? ` — ${issues.slice(0, 3).join(' / ')}` : '';
    return `${icon} ${r.basename}${issueSummary}`;
  });

  const errorCount = seoResults.filter(r => r.errors.length > 0).length;
  const warnCount = seoResults.filter(r => r.warnings.length > 0 && r.errors.length === 0).length;
  const header = errorCount > 0
    ? `*SEOチェック結果（❌ ${errorCount}件のエラー）*`
    : warnCount > 0
      ? `*SEOチェック結果（⚠️ ${warnCount}件の警告）*`
      : `*SEOチェック結果（問題なし ✅）*`;

  return `${header}\n${lines.join('\n')}`;
}

// ============================================================
// DEPLOY-PLAN: デプロイ計画をSlackに提出して承認を待つ
// ============================================================
async function postDeployPlan() {
  // --pages "file1,file2" または承認済みページを自動検出
  let pageFiles = getArg('pages') ? getArg('pages').split(',') : [];
  const scheduledDate = getArg('date') || '即時';

  // 指定がなければ承認済みページを自動検出
  if (pageFiles.length === 0) {
    const data = loadStatus();
    for (const [file, info] of Object.entries(data.requests)) {
      if (info.approval === 'approved' && !info.deployed) {
        pageFiles.push(file);
      }
    }
  }

  if (pageFiles.length === 0) {
    console.error('❌ デプロイ対象のページがありません。');
    console.error('   院長の公開承認を取得するか、--pages で指定してください。');
    process.exit(1);
  }

  // 各ページの情報を収集
  const data = loadStatus();
  const deployItems = pageFiles.map(file => {
    const info = data.requests[file] || {};
    const label = LABEL_MAP[file] || path.basename(file, '.html');
    const wpId = WP_PAGE_ID[file];
    const targetUrl = wpId ? `${WP_PREVIEW_BASE}/?page_id=${wpId}` : '（WP未登録）';
    const previewUrl = info.url || buildPreviewUrl(file) || '—';
    const replaceUrl = getReplaceUrl(file);
    return { file, label, targetUrl, previewUrl, wpId, replaceUrl };
  });

  // SEOプリチェック実行
  const seoCheck = runSeoCheck(pageFiles);

  // Block Kit でデプロイ計画メッセージを構成
  let planText = deployItems.map((item, i) => {
    let text = `${i + 1}. *${item.label}*\n   プレビュー: ${item.previewUrl}\n   本番反映先: ${item.targetUrl}`;
    if (item.replaceUrl) {
      text += `\n   🔄 リプレイス: ${item.replaceUrl}`;
    } else {
      text += `\n   🆕 新規ページ（既存URLのリプレイスなし）`;
    }
    return text;
  }).join('\n\n');

  const blocks = [
    { type: 'section', text: { type: 'mrkdwn', text: `<!channel>\n*🚀 デプロイ計画（承認依頼）*` } },
    { type: 'divider' },
    { type: 'section', text: { type: 'mrkdwn', text: `*公開予定日時:* ${scheduledDate}\n*対象ページ数:* ${deployItems.length}件` } },
    { type: 'section', text: { type: 'mrkdwn', text: planText } },
    { type: 'divider' },
  ];

  // SEOチェック結果ブロック追加
  const seoSummaryText = seoCheck ? buildSeoSummaryText(seoCheck.results) : null;
  if (seoSummaryText) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: seoSummaryText } });
    blocks.push({ type: 'divider' });
  }

  blocks.push({ type: 'context', elements: [{
    type: 'mrkdwn',
    text: '✅ 承認 → 「OK」「承認」と返信\n❓ 質問・調整 → スレッドで自由にやり取りできます\n❌ 差し戻し → 修正点を記載してください'
  }] });

  const result = await slackPost('chat.postMessage', {
    channel: DEPLOY_CHANNEL_ID,
    text: `<!channel> 🚀 デプロイ計画: ${deployItems.length}件の本番反映`,
    blocks,
    unfurl_links: false
  });

  // ステータスに deploy_plan を記録
  const planData = loadStatus();
  if (!planData.deploy_plans) planData.deploy_plans = {};
  planData.deploy_plans[result.ts] = {
    pages: pageFiles,
    replace_urls: Object.fromEntries(
      deployItems.filter(d => d.replaceUrl).map(d => [d.file, d.replaceUrl])
    ),
    scheduled_date: scheduledDate,
    posted_at: new Date().toISOString(),
    status: 'pending_approval',  // pending_approval → approved → deployed
  };
  saveStatus(planData);

  console.log(`✅ デプロイ計画をSlackに投稿しました`);
  console.log(`   thread_ts: ${result.ts}`);
  console.log(`   対象: ${deployItems.map(d => d.label).join(', ')}`);
  console.log(`   公開予定: ${scheduledDate}`);
  console.log('\n⏳ Slack でKosukeさんの承認を待っています...');
  console.log('承認確認: node scripts/slack-feedback.js deploy-check');
}

// ============================================================
// DEPLOY-CHECK: デプロイ計画への承認を確認
// ============================================================
async function checkDeployApproval() {
  const data = loadStatus();
  const plans = data.deploy_plans || {};
  const pendingPlans = Object.entries(plans).filter(([, p]) => p.status === 'pending_approval');

  if (pendingPlans.length === 0) {
    console.log('📭 承認待ちのデプロイ計画はありません');
    return;
  }

  console.log('🔍 デプロイ承認を確認中...\n');

  for (const [threadTs, plan] of pendingPlans) {
    let replies;
    try {
      replies = await slackAPI('conversations.replies', {
        channel: DEPLOY_CHANNEL_ID,
        ts: threadTs,
        limit: '50'
      });
    } catch (e) {
      console.warn(`  ⚠ スレッド取得失敗: ${e.message}`);
      continue;
    }

    const userReplies = (replies.messages || []).filter(m =>
      m.ts !== threadTs && !m.bot_id && !m.subtype && m.text
    );

    if (userReplies.length === 0) {
      const pageLabels = plan.pages.map(f => LABEL_MAP[f] || path.basename(f, '.html'));
      console.log(`⏳ デプロイ計画（${pageLabels.join(', ')}）— 返信なし（承認待ち）`);
      continue;
    }

    const pageLabels = plan.pages.map(f => LABEL_MAP[f] || path.basename(f, '.html'));
    console.log(`📦 デプロイ計画: ${pageLabels.join(', ')}`);
    console.log(`   投稿日: ${plan.posted_at ? plan.posted_at.substring(0, 10) : '?'}`);
    console.log(`   公開予定: ${plan.scheduled_date}`);

    // 全返信を時系列で表示
    console.log(`   スレッド（${userReplies.length}件の返信）:`);
    for (const reply of userReplies) {
      const time = formatDate(reply.ts);
      const ap = classifyApproval(reply.text);
      const badge = { 'approved': '🟢', 'conditional': '🟡', 'feedback': '💬' }[ap];
      console.log(`     ${badge} ${time}: ${reply.text.substring(0, 80)}`);
    }

    // 最新の返信で最終判定
    const latestReply = userReplies[userReplies.length - 1];
    const approval = classifyApproval(latestReply.text);

    if (approval === 'approved') {
      plan.status = 'approved';
      plan.approved_at = new Date().toISOString();
      plan.approved_by = latestReply.text;
      saveStatus(data);

      console.log(`\n   → 🟢 最終判定: デプロイ承認済み`);
      console.log(`   → 次のステップ: DPL エージェントでデプロイ実行`);
    } else if (approval === 'conditional') {
      console.log(`\n   → 🟡 最終判定: 条件付き（修正後に再提出）`);
    } else {
      console.log(`\n   → 💬 最終判定: 質問・調整中 or 差し戻し`);
      console.log(`   → Slack スレッドで対話を続けるか、修正後に再度 deploy-plan を実行`);
    }
  }
}

// ============================================================
// SYNC: Slackスレッドを全スキャンし対応状況・承認状況を同期
// ============================================================
// Bot返信の「✅ 修正完了」を検出するパターン
const HANDLED_PATTERNS = [
  /✅\s*(修正完了|対応完了|完了しました|更新しました|反映しました|修正しました)/,
  /修正(を)?完了/,
  /対応(を)?完了/,
];

function isHandledReply(text) {
  return HANDLED_PATTERNS.some(p => p.test(text));
}

// リプレイスURL検出（文脈ベース）
// スレッド返信に含まれる {{DOMAIN}} の公開URLを自動検出する
// プレビューURL（preview_token, page_id, wp-json）は除外
function extractReplaceUrl(text) {
  // テキスト内の全URLを抽出
  const urlMatches = text.match(/https?:\/\/[^\s<>」』】）)]+/g);
  if (!urlMatches) return null;

  for (const rawUrl of urlMatches) {
    const url = rawUrl.replace(/[。、.!！?？]$/, ''); // 末尾の句読点を除去
    // {{DOMAIN}} の公開URLのみ対象
    if (!url.includes('{{DOMAIN}}')) continue;
    // プレビュー・管理系URLは除外
    if (url.includes('preview_token')) continue;
    if (url.includes('page_id=')) continue;
    if (url.includes('wp-json')) continue;
    if (url.includes('wp-admin')) continue;
    if (url.includes('wp-login')) continue;
    // パス付きの公開URLのみ（トップページ単体は除外）
    const pathname = new URL(url).pathname;
    if (pathname === '/' || pathname === '') continue;
    return url;
  }
  return null;
}

async function syncStatus() {
  const data = loadStatus();
  const requests = data.requests || {};
  const approvedPages = [];
  const conditionalPages = [];
  const feedbackPages = [];
  const handledPages = [];
  const noReplyPages = [];

  console.log('🔄 Slackスレッドを同期中...\n');

  for (const [filePath, info] of Object.entries(requests)) {
    if (!info.thread_ts) continue;
    if (info.deployed) continue;  // 既にデプロイ済み

    const label = LABEL_MAP[filePath] || path.basename(filePath, '.html');

    let replies;
    try {
      replies = await slackAPI('conversations.replies', {
        channel: CHANNEL_ID,
        ts: info.thread_ts,
        limit: '100'
      });
    } catch (e) {
      continue;
    }

    const allReplies = (replies.messages || []).filter(m => m.ts !== info.thread_ts);
    const userReplies = allReplies.filter(m => !m.bot_id && !m.subtype && m.text);
    const botReplies = allReplies.filter(m => m.bot_id && m.text);

    // Bot返信から「✅ 修正完了」を検出 → handled
    const latestHandled = botReplies.reverse().find(m => isHandledReply(m.text));
    if (latestHandled) {
      info.handled = true;
      info.handled_at = new Date(parseFloat(latestHandled.ts) * 1000).toISOString();
    }

    // 全返信（ユーザー+Bot）からリプレイスURLコメントを検出（最新を採用）
    for (const reply of allReplies) {
      if (!reply.text) continue;
      const rUrl = extractReplaceUrl(reply.text);
      if (rUrl) {
        info.replace_url = rUrl;
        info.replace_url_set_by = reply.bot_id ? 'bot' : 'user';
        info.replace_url_set_at = new Date(parseFloat(reply.ts) * 1000).toISOString();
      }
    }

    if (userReplies.length === 0) {
      noReplyPages.push({ file: filePath, label, handled: !!info.handled });
      continue;
    }

    // 院長返信の最新で承認判定
    const latestUserReply = userReplies[userReplies.length - 1];
    const approval = classifyApproval(latestUserReply.text);

    if (approval === 'approved') {
      info.approval = 'approved';
      info.approved_at = new Date().toISOString();
      approvedPages.push({ file: filePath, label, text: latestUserReply.text.substring(0, 60) });
    } else if (approval === 'conditional') {
      info.approval = 'conditional';
      conditionalPages.push({ file: filePath, label, text: latestUserReply.text.substring(0, 60) });
    } else {
      // フィードバックの場合、handled済みかチェック
      // 院長FBの後にBot「✅ 修正完了」があれば対応済み
      const latestUserTs = parseFloat(latestUserReply.ts);
      const handledAfterFb = botReplies.find(m =>
        isHandledReply(m.text) && parseFloat(m.ts) > latestUserTs
      );

      if (handledAfterFb) {
        info.handled = true;
        info.handled_at = new Date(parseFloat(handledAfterFb.ts) * 1000).toISOString();
        handledPages.push({ file: filePath, label, text: latestUserReply.text.substring(0, 60) });
      } else {
        info.handled = false;
        delete info.handled_at;
        feedbackPages.push({ file: filePath, label, text: latestUserReply.text.substring(0, 60) });
      }
    }
  }

  saveStatus(data);

  // --- 結果表示 ---
  console.log('━'.repeat(60));
  console.log('📋 Slack同期結果');
  console.log('━'.repeat(60));

  if (feedbackPages.length > 0) {
    console.log(`\n🔴 未対応フィードバック（${feedbackPages.length}件）← 要対応:`);
    feedbackPages.forEach(p => console.log(`   💬 ${p.label}: 「${p.text}」`));
  }
  if (conditionalPages.length > 0) {
    console.log(`\n🟡 条件付き承認（${conditionalPages.length}件）← 修正後に公開:`);
    conditionalPages.forEach(p => console.log(`   🟡 ${p.label}: 「${p.text}」`));
  }
  if (handledPages.length > 0) {
    console.log(`\n✅ 対応済み — 院長の再確認待ち（${handledPages.length}件）:`);
    handledPages.forEach(p => console.log(`   🔧 ${p.label}: 「${p.text}」`));
  }
  if (approvedPages.length > 0) {
    console.log(`\n🟢 公開承認済み（${approvedPages.length}件）← デプロイ可能:`);
    approvedPages.forEach(p => console.log(`   🟢 ${p.label}: 「${p.text}」`));
    console.log(`\n   次のステップ: node scripts/slack-feedback.js deploy-plan`);
  }

  const waitingCount = noReplyPages.filter(p => !p.handled).length;
  if (waitingCount > 0) {
    console.log(`\n⏳ 院長返信待ち（${waitingCount}件）`);
  }

  const total = Object.keys(requests).length;
  console.log(`\n${'━'.repeat(60)}`);
  console.log(`合計: ${total}件 | 未対応: ${feedbackPages.length} | 対応済: ${handledPages.length} | 承認: ${approvedPages.length} | 待ち: ${waitingCount}`);

  return approvedPages;
}

// check-approvals は sync のエイリアス
const checkApprovals = syncStatus;

// ============================================================
// DEPLOY-EXECUTE: 承認済みページをWP REST APIで公開（status: publish）
// ============================================================
async function deployExecute() {
  const data = loadStatus();
  const plans = data.deploy_plans || {};

  // 承認済みのデプロイ計画を探す
  const approvedPlans = Object.entries(plans).filter(([, p]) => p.status === 'approved');

  if (approvedPlans.length === 0) {
    console.error('❌ 承認済みのデプロイ計画がありません。');
    console.error('   1. node scripts/slack-feedback.js check-approvals （院長承認を検出）');
    console.error('   2. node scripts/slack-feedback.js deploy-plan     （計画を投稿）');
    console.error('   3. node scripts/slack-feedback.js deploy-check    （Kosuke承認を確認）');
    console.error('   4. node scripts/slack-feedback.js deploy-execute  （公開実行）');
    process.exit(1);
  }

  // WP REST API 認証情報
  const WP_AUTH = Buffer.from('ito:Bt5G r7LM d2Ge bJDw VMSc qZTJ').toString('base64');
  const WP_API_BASE = 'https://www.{{DOMAIN}}/wp-json/wp/v2/pages';

  for (const [threadTs, plan] of approvedPlans) {
    const pages = plan.pages || [];
    console.log(`\n🚀 デプロイ実行中... （${pages.length}ページ）\n`);

    const results = [];
    for (const filePath of pages) {
      const wpId = WP_PAGE_ID[filePath];
      const label = LABEL_MAP[filePath] || path.basename(filePath, '.html');

      if (!wpId) {
        console.log(`   ⚠ ${label}: WPページIDが未登録 → スキップ`);
        results.push({ label, status: 'skipped', reason: 'no WP ID' });
        continue;
      }

      // WP REST API で status: publish に更新
      try {
        const published = await wpPublish(WP_API_BASE, wpId, WP_AUTH);
        if (published) {
          console.log(`   ✅ ${label} → 公開完了 (ID: ${wpId})`);

          // slack-status.json を更新
          if (data.requests[filePath]) {
            data.requests[filePath].deployed = true;
            data.requests[filePath].deployed_at = new Date().toISOString();
          }
          results.push({ label, status: 'published', wpId });
        } else {
          console.log(`   ❌ ${label} → 公開失敗 (ID: ${wpId})`);
          results.push({ label, status: 'failed', wpId });
        }
      } catch (err) {
        console.log(`   ❌ ${label} → エラー: ${err.message}`);
        results.push({ label, status: 'error', error: err.message });
      }
    }

    // デプロイ計画のステータスを更新
    plan.status = 'deployed';
    plan.deployed_at = new Date().toISOString();
    plan.results = results;
    saveStatus(data);

    // デプロイ完了をSlackに通知
    const successCount = results.filter(r => r.status === 'published').length;
    const failCount = results.filter(r => r.status !== 'published').length;
    const resultText = results.map(r => {
      const icon = r.status === 'published' ? '✅' : '❌';
      return `${icon} ${r.label}`;
    }).join('\n');

    await slackPost('chat.postMessage', {
      channel: DEPLOY_CHANNEL_ID,
      thread_ts: threadTs,
      text: `🎉 *デプロイ完了*\n成功: ${successCount}件${failCount > 0 ? ` / 失敗: ${failCount}件` : ''}\n\n${resultText}`
    });

    // 公開成功したページのフィードバックスレッドに「公開済み」ステータスを投稿
    for (const filePath of pages) {
      const info = data.requests[filePath];
      if (!info || !info.deployed || !info.thread_ts) continue;

      const label = LABEL_MAP[filePath] || path.basename(filePath, '.html');
      const wpId = WP_PAGE_ID[filePath];
      const publicUrl = wpId ? `${WP_PREVIEW_BASE}/?page_id=${wpId}` : '';
      const replaceUrl = getReplaceUrl(filePath);

      let statusMsg = `🎉 *公開済み*\n\n「${label}」を本番公開しました。`;
      if (replaceUrl) {
        statusMsg += `\n🔄 リプレイス元: ${replaceUrl}`;
      }
      if (publicUrl) {
        statusMsg += `\n🌐 公開URL: ${publicUrl}`;
      }
      statusMsg += `\n📅 公開日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`;

      try {
        await slackPost('chat.postMessage', {
          channel: CHANNEL_ID,
          thread_ts: info.thread_ts,
          text: statusMsg
        });
        console.log(`   📨 ${label}: フィードバックスレッドに公開済みステータスを投稿`);
      } catch (err) {
        console.warn(`   ⚠ ${label}: ステータス投稿失敗: ${err.message}`);
      }
    }

    console.log(`\n🎉 デプロイ完了: 成功 ${successCount}件${failCount > 0 ? ` / 失敗 ${failCount}件` : ''}`);
  }
}

// WP REST API でページを公開
function wpPublish(apiBase, pageId, auth) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ status: 'publish' });
    const url = new URL(`${apiBase}/${pageId}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(postData),
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300 && json.status === 'publish') {
            resolve(true);
          } else {
            resolve(false);
          }
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ============================================================
// REPLY: フィードバックスレッドに返信（院長への対応報告）
// ============================================================
async function feedbackReply() {
  const message = getArg('message');
  const threadTs = getArg('thread');
  const targetPage = getArg('page'); // ファイルパスまたはラベルで指定

  if (!message) {
    console.error('❌ 必須: --message "返信テキスト"');
    console.error('');
    console.error('使い方:');
    console.error('  node scripts/slack-feedback.js reply --message "修正しました！明日中に反映します。"');
    console.error('  node scripts/slack-feedback.js reply --page 予約ガイド --message "修正対応中です。3/5までに反映します。"');
    console.error('  node scripts/slack-feedback.js reply --thread 1234567890.123456 --message "確認ありがとうございます。"');
    process.exit(1);
  }

  let targetTs = threadTs;

  // --page でページ名 or ファイルパスからスレッドを特定
  if (!targetTs && targetPage) {
    const data = loadStatus();
    for (const [filePath, info] of Object.entries(data.requests || {})) {
      const label = LABEL_MAP[filePath] || '';
      if (filePath.includes(targetPage) || label.includes(targetPage) || (info.title && info.title.includes(targetPage))) {
        if (info.thread_ts) {
          targetTs = info.thread_ts;
          console.log(`📌 ページ "${label || info.title}" のスレッドを検出: ${targetTs}`);
          break;
        }
      }
    }
    if (!targetTs) {
      console.error(`❌ ページ "${targetPage}" のスレッドが見つかりません。`);
      console.error('   --thread でthread_tsを直接指定するか、status コマンドで確認してください。');
      process.exit(1);
    }
  }

  // 指定がなければ最新のフィードバック付きスレッドを使用
  if (!targetTs) {
    const data = loadStatus();
    const withFeedback = Object.entries(data.requests || {})
      .filter(([, info]) => info.thread_ts && (info.has_feedback || info.approval))
      .sort(([, a], [, b]) => (b.requested_at || '').localeCompare(a.requested_at || ''));

    if (withFeedback.length === 0) {
      // フィードバックが無くても最新のスレッドを使う
      const all = Object.entries(data.requests || {})
        .filter(([, info]) => info.thread_ts)
        .sort(([, a], [, b]) => (b.requested_at || '').localeCompare(a.requested_at || ''));
      if (all.length > 0) {
        targetTs = all[0][1].thread_ts;
        const label = LABEL_MAP[all[0][0]] || all[0][1].title || all[0][0];
        console.log(`📌 最新スレッド "${label}" に返信します`);
      }
    } else {
      targetTs = withFeedback[0][1].thread_ts;
      const label = LABEL_MAP[withFeedback[0][0]] || withFeedback[0][1].title || withFeedback[0][0];
      console.log(`📌 最新フィードバック付きスレッド "${label}" に返信します`);
    }
  }

  if (!targetTs) {
    console.error('❌ 返信先のスレッドが見つかりません。');
    console.error('   --page "ページ名" または --thread "thread_ts" を指定してください。');
    console.error('');
    console.error('利用可能なページ一覧:');
    const data = loadStatus();
    for (const [filePath, info] of Object.entries(data.requests || {})) {
      if (info.thread_ts) {
        const label = LABEL_MAP[filePath] || info.title || filePath;
        console.error(`   • ${label} (thread: ${info.thread_ts})`);
      }
    }
    process.exit(1);
  }

  await slackPost('chat.postMessage', {
    channel: CHANNEL_ID,
    thread_ts: targetTs,
    text: message,
  });

  console.log(`✅ フィードバックスレッドに返信しました`);
  console.log(`   チャンネル: #misao-feedback`);
  console.log(`   thread_ts: ${targetTs}`);
  console.log(`   メッセージ: ${message}`);
}

// ============================================================
// DEPLOY-REPLY: デプロイ計画スレッドに返信（質問対応・調整報告）
// ============================================================
async function deployReply() {
  const message = getArg('message');
  const threadTs = getArg('thread');

  if (!message) {
    console.error('❌ 必須: --message "返信テキスト"');
    console.error('例: node scripts/slack-feedback.js deploy-reply --message "写真を差し替えました。再度ご確認ください。"');
    process.exit(1);
  }

  // thread_ts が指定されていなければ最新のデプロイ計画を使う
  let targetTs = threadTs;
  if (!targetTs) {
    const data = loadStatus();
    const plans = data.deploy_plans || {};
    const pending = Object.entries(plans)
      .filter(([, p]) => p.status === 'pending_approval')
      .sort(([, a], [, b]) => (b.posted_at || '').localeCompare(a.posted_at || ''));
    if (pending.length > 0) {
      targetTs = pending[0][0];
    }
  }

  if (!targetTs) {
    console.error('❌ 返信先のデプロイ計画が見つかりません。--thread でthread_tsを指定してください。');
    process.exit(1);
  }

  await slackPost('chat.postMessage', {
    channel: DEPLOY_CHANNEL_ID,
    thread_ts: targetTs,
    text: message,
  });

  console.log(`✅ デプロイ計画スレッドに返信しました`);
  console.log(`   thread_ts: ${targetTs}`);
  console.log(`   メッセージ: ${message}`);
}

// ============================================================
// メイン
// ============================================================
async function main() {
  switch (COMMAND) {
    case 'post': await postPreviewRequest(); break;
    case 'batch': await batchPost(); break;
    case 'fetch':
      if (hasFlag('count')) await countFeedback();
      else await fetchFeedback();
      break;
    case 'status': showStatus(); break;
    case 'sync': await syncStatus(); break;
    case 'check-approvals': await checkApprovals(); break;
    case 'deploy-plan': await postDeployPlan(); break;
    case 'deploy-check': await checkDeployApproval(); break;
    case 'deploy-execute': await deployExecute(); break;
    case 'deploy-reply': await deployReply(); break;
    case 'reply': await feedbackReply(); break;
    default:
      console.error(`❌ 不明なコマンド: ${COMMAND}`);
      console.error('使い方: post | batch | fetch | status | sync | check-approvals | deploy-plan | deploy-check | deploy-execute | deploy-reply | reply');
      process.exit(1);
  }
}

main().catch(err => { console.error('❌ エラー:', err.message); process.exit(1); });
