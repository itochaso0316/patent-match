#!/usr/bin/env node
/**
 * Slack #misao-data チャンネル データ取り込みスクリプト
 *
 * 院長がSlackに投稿した実績データ・想い・エピソード等を
 * 自動的に data/ 配下に格納し、コンテンツ更新を提案する。
 *
 * サブコマンド:
 *   fetch              — 新着メッセージを取得 → data/slack-ingest/ に保存
 *   analyze            — 取り込み済みデータを分析し、更新提案レポートを生成
 *   status             — 取り込み状況サマリーを表示
 *   propose            — 分析結果に基づく更新提案を #misao-feedback に投稿
 *
 * 環境変数:
 *   SLACK_BOT_TOKEN         — Bot User OAuth Token（xoxb-...）
 *   SLACK_DATA_CHANNEL_ID   — #misao-data チャンネルID（C0AKQQ798DN）
 *   SLACK_CHANNEL_ID        — #misao-feedback チャンネルID（提案投稿先）
 *
 * 必要な Bot Token Scopes:
 *   channels:history, channels:read, chat:write,
 *   files:read, reactions:write, reactions:read
 *
 * 使い方:
 *   node scripts/slack-data-ingest.js fetch [--since YYYY-MM-DD] [--dry-run]
 *   node scripts/slack-data-ingest.js analyze
 *   node scripts/slack-data-ingest.js status
 *   node scripts/slack-data-ingest.js propose [--dry-run]
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// --- 設定 ---
const BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const DATA_CHANNEL_ID = process.env.SLACK_DATA_CHANNEL_ID || 'C0AKQQ798DN';
const FEEDBACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID;

const DATA_DIR = path.join(__dirname, '..', 'data');
const INGEST_DIR = path.join(DATA_DIR, 'slack-ingest');
const STATE_FILE = path.join(INGEST_DIR, '.ingest-state.json');
const HOSPITAL_DIR = path.join(DATA_DIR, 'hospital');

// --- コマンド解析 ---
const args = process.argv.slice(2);
const COMMAND = args[0] || 'fetch';
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}
const hasFlag = (name) => args.includes(`--${name}`);

// --- バリデーション ---
if (!BOT_TOKEN) {
  console.error('❌ 環境変数が未設定です:');
  console.error('   SLACK_BOT_TOKEN=xoxb-...');
  process.exit(1);
}

// --- ディレクトリ確保 ---
[INGEST_DIR,
 path.join(INGEST_DIR, 'raw'),
 path.join(INGEST_DIR, 'classified'),
].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// --- State管理 ---
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return { last_fetch_ts: '0', processed_messages: [], stats: { total: 0, by_category: {} } };
  }
}
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}

// --- Slack API ---
function slackAPI(method, params = {}) {
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams(params).toString();
    const options = {
      hostname: 'slack.com',
      path: `/api/${method}?${qs}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${BOT_TOKEN}` },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (!data.ok) reject(new Error(`Slack API error: ${data.error}`));
          else resolve(data);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function slackPost(channel, text, blocks = null, thread_ts = null) {
  return new Promise((resolve, reject) => {
    const payload = { channel, text };
    if (blocks) payload.blocks = blocks;
    if (thread_ts) payload.thread_ts = thread_ts;

    const postData = JSON.stringify(payload);
    const options = {
      hostname: 'slack.com',
      path: '/api/chat.postMessage',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${BOT_TOKEN}`,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(postData),
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (!data.ok) reject(new Error(`Slack post error: ${data.error}`));
          else resolve(data);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// --- メッセージ分類 ---
function classifyMessage(text) {
  const categories = [];
  const lower = text.toLowerCase();

  // 実績データ
  if (/\d+件|実績|分娩|妊娠率|成功率|症例|体外受精|顕微授精|人工授精/.test(text)) {
    categories.push('achievements');
  }
  // 費用・料金
  if (/万円|円|費用|料金|自己負担|保険|助成/.test(text)) {
    categories.push('costs');
  }
  // 想い・哲学
  if (/想い|大切|信念|寄り添|心がけ|モットー|理念|哲学/.test(text)) {
    categories.push('brand-voice');
  }
  // エピソード・体験
  if (/患者さん|お産|エピソード|経験|印象的|感動|喜び/.test(text)) {
    categories.push('episodes');
  }
  // 医師・スタッフ情報
  if (/先生|医師|スタッフ|資格|学会|論文|発表/.test(text)) {
    categories.push('doctors');
  }
  // 設備・サービス
  if (/設備|機器|導入|新しい|サービス|始め/.test(text)) {
    categories.push('services');
  }
  // メディア
  if (/テレビ|新聞|取材|YouTube|動画|メディア/.test(text)) {
    categories.push('media');
  }

  // 分類できない場合は「general」
  if (categories.length === 0) categories.push('general');

  return categories;
}

// --- 日付ヘルパー ---
function tsToDate(ts) {
  return new Date(parseFloat(ts) * 1000);
}
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// ============================================================
// fetch — 新着メッセージを取り込み
// ============================================================
async function cmdFetch() {
  const state = loadState();
  const sinceArg = getArg('since');
  const dryRun = hasFlag('dry-run');

  let oldest = state.last_fetch_ts;
  if (sinceArg) {
    oldest = String(new Date(sinceArg).getTime() / 1000);
  }

  console.log(`📥 #misao-data から新着メッセージを取得中...`);
  console.log(`   (since: ${oldest === '0' ? '全件' : formatDate(tsToDate(oldest))})\n`);

  let allMessages = [];
  let cursor;
  do {
    const params = {
      channel: DATA_CHANNEL_ID,
      oldest,
      limit: 100,
      inclusive: false,
    };
    if (cursor) params.cursor = cursor;

    const res = await slackAPI('conversations.history', params);
    const msgs = (res.messages || []).filter(m => m.type === 'message' && !m.subtype);
    allMessages = allMessages.concat(msgs);
    cursor = res.response_metadata?.next_cursor;
  } while (cursor);

  // 古い順にソート
  allMessages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));

  // 既に処理済みのメッセージを除外
  const newMessages = allMessages.filter(m => !state.processed_messages.includes(m.ts));

  console.log(`   新着: ${newMessages.length} 件\n`);

  if (newMessages.length === 0) {
    console.log('✅ 新着メッセージはありません。');
    return;
  }

  // 各メッセージを分類・保存
  for (const msg of newMessages) {
    const date = formatDate(tsToDate(msg.ts));
    const categories = classifyMessage(msg.text);
    const preview = msg.text.substring(0, 60).replace(/\n/g, ' ');

    console.log(`  📝 [${date}] ${preview}...`);
    console.log(`     分類: ${categories.join(', ')}`);

    if (!dryRun) {
      // raw保存
      const rawFile = path.join(INGEST_DIR, 'raw', `${date}-${msg.ts.replace('.', '-')}.json`);
      fs.writeFileSync(rawFile, JSON.stringify({
        ts: msg.ts,
        date,
        user: msg.user,
        text: msg.text,
        categories,
        files: (msg.files || []).map(f => ({ name: f.name, url: f.url_private, mimetype: f.mimetype })),
        reactions: (msg.reactions || []).map(r => ({ name: r.name, count: r.count })),
      }, null, 2) + '\n');

      // 分類別にmarkdownファイルを追記
      for (const cat of categories) {
        const classifiedFile = path.join(INGEST_DIR, 'classified', `${cat}.md`);
        const header = fs.existsSync(classifiedFile) ? '' : `# ${cat} — Slack #misao-data からの取り込み\n\n`;
        const entry = `\n---\n### ${date}（Slack ts: ${msg.ts}）\n${msg.text}\n`;
        fs.appendFileSync(classifiedFile, header + entry);
      }

      // data/ への振り分け（実績データと費用は直接格納）
      if (categories.includes('achievements')) {
        const targetDir = path.join(HOSPITAL_DIR, 'achievements');
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        const targetFile = path.join(targetDir, `slack-${date}.md`);
        const content = `# 実績データ（Slack取り込み）\n取り込み日: ${date}\n出典: Slack #misao-data\n\n${msg.text}\n`;
        fs.appendFileSync(targetFile, content);
        console.log(`     → data/hospital/achievements/slack-${date}.md に保存`);
      }

      if (categories.includes('brand-voice') || categories.includes('episodes')) {
        // brand-identity.md への追記候補として保存
        const targetFile = path.join(INGEST_DIR, 'classified', 'brand-identity-candidates.md');
        const header2 = fs.existsSync(targetFile) ? '' : `# ブランドアイデンティティ追記候補\nbrand-identity.md への反映を検討する内容\n\n`;
        const entry2 = `\n---\n### ${date}\nカテゴリ: ${categories.join(', ')}\n\n${msg.text}\n\n**→ 反映先候補**: brand-identity.md の「院長の想い」または「エピソード」セクション\n`;
        fs.appendFileSync(targetFile, header2 + entry2);
        console.log(`     → brand-identity候補として保存`);
      }

      // 処理済みに追加
      state.processed_messages.push(msg.ts);
      state.stats.total++;
      for (const cat of categories) {
        state.stats.by_category[cat] = (state.stats.by_category[cat] || 0) + 1;
      }
    }
    console.log('');
  }

  if (!dryRun) {
    state.last_fetch_ts = newMessages[newMessages.length - 1].ts;
    saveState(state);
    console.log(`✅ ${newMessages.length} 件を取り込み完了`);
  } else {
    console.log(`🔍 Dry-run完了（${newMessages.length} 件を検出、保存はスキップ）`);
  }
}

// ============================================================
// analyze — 取り込み済みデータを分析
// ============================================================
async function cmdAnalyze() {
  console.log('📊 取り込み済みデータを分析中...\n');

  const classifiedDir = path.join(INGEST_DIR, 'classified');
  if (!fs.existsSync(classifiedDir)) {
    console.log('❌ 分類済みデータがありません。先に fetch を実行してください。');
    return;
  }

  const files = fs.readdirSync(classifiedDir).filter(f => f.endsWith('.md'));
  const analysis = {
    date: formatDate(new Date()),
    categories: {},
    update_proposals: [],
  };

  for (const file of files) {
    const content = fs.readFileSync(path.join(classifiedDir, file), 'utf-8');
    const entries = content.split('---').filter(s => s.trim());
    const cat = path.basename(file, '.md');
    analysis.categories[cat] = {
      entry_count: entries.length - 1, // ヘッダー除く
      latest_date: null,
    };

    // 最新日付を抽出
    const dateMatches = content.match(/### (\d{4}-\d{2}-\d{2})/g);
    if (dateMatches) {
      const dates = dateMatches.map(m => m.replace('### ', ''));
      analysis.categories[cat].latest_date = dates[dates.length - 1];
    }
  }

  // 更新提案の生成
  const pageMapping = {
    'achievements': ['/fertility-new/achievements/', '/fertility/', '/childbirth-2/'],
    'costs': ['/fertility/hiyou', '/hospitalization/'],
    'brand-voice': ['/', '/fertility/', '/childbirth-2/', '/general/'],
    'episodes': ['/doctors/', '/doctor/'],
    'doctors': ['/doctors/', '/doctor/'],
    'services': ['/facilities/', '/class/'],
    'media': ['/academia/'],
  };

  for (const [cat, info] of Object.entries(analysis.categories)) {
    if (info.entry_count > 0 && pageMapping[cat]) {
      analysis.update_proposals.push({
        category: cat,
        entry_count: info.entry_count,
        affected_pages: pageMapping[cat],
        action: cat === 'brand-voice'
          ? 'brand-identity.md を更新 → 関連ページのリード文を改訂'
          : cat === 'achievements'
          ? 'data/hospital/achievements/ を更新 → 該当ページの数値を最新化'
          : `data/hospital/${cat}/ のデータを更新 → 該当ページに反映`,
      });
    }
  }

  // レポート出力
  const reportDir = path.join(__dirname, '..', 'audits');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const reportFile = path.join(reportDir, `data-ingest-analysis-${analysis.date}.md`);

  let report = `# Slack #misao-data 取り込みデータ分析レポート\n日付: ${analysis.date}\n\n`;
  report += `## カテゴリ別取り込み状況\n\n`;
  report += `| カテゴリ | 件数 | 最新取り込み日 |\n|----------|------|----------------|\n`;
  for (const [cat, info] of Object.entries(analysis.categories)) {
    report += `| ${cat} | ${info.entry_count} | ${info.latest_date || '-'} |\n`;
  }

  if (analysis.update_proposals.length > 0) {
    report += `\n## 更新提案\n\n`;
    for (const proposal of analysis.update_proposals) {
      report += `### ${proposal.category}（${proposal.entry_count}件の新データ）\n`;
      report += `- **アクション**: ${proposal.action}\n`;
      report += `- **影響ページ**: ${proposal.affected_pages.join(', ')}\n\n`;
    }
  }

  fs.writeFileSync(reportFile, report);
  console.log(`📄 分析レポートを保存: audits/data-ingest-analysis-${analysis.date}.md`);
  console.log('\n' + report);
}

// ============================================================
// status — 取り込み状況を表示
// ============================================================
function cmdStatus() {
  const state = loadState();
  console.log('📊 Slack #misao-data 取り込みステータス\n');
  console.log(`  総取り込み数: ${state.stats.total}`);
  console.log(`  最終取り込み: ${state.last_fetch_ts === '0' ? '未実行' : formatDate(tsToDate(state.last_fetch_ts))}`);

  if (Object.keys(state.stats.by_category).length > 0) {
    console.log('\n  カテゴリ別:');
    for (const [cat, count] of Object.entries(state.stats.by_category)) {
      console.log(`    ${cat}: ${count}件`);
    }
  }

  // 分類済みファイルの確認
  const classifiedDir = path.join(INGEST_DIR, 'classified');
  if (fs.existsSync(classifiedDir)) {
    const files = fs.readdirSync(classifiedDir).filter(f => f.endsWith('.md'));
    if (files.length > 0) {
      console.log('\n  分類済みファイル:');
      for (const f of files) {
        const content = fs.readFileSync(path.join(classifiedDir, f), 'utf-8');
        const entries = content.split('---').filter(s => s.trim()).length - 1;
        console.log(`    ${f}: ${entries}件`);
      }
    }
  }
}

// ============================================================
// propose — 更新提案を #misao-feedback に投稿
// ============================================================
async function cmdPropose() {
  const dryRun = hasFlag('dry-run');

  if (!FEEDBACK_CHANNEL_ID) {
    console.error('❌ SLACK_CHANNEL_ID が未設定です（提案投稿先）');
    process.exit(1);
  }

  console.log('📤 更新提案を生成中...\n');

  // brand-identity候補があるか確認
  const candidateFile = path.join(INGEST_DIR, 'classified', 'brand-identity-candidates.md');
  const classifiedDir = path.join(INGEST_DIR, 'classified');

  const proposals = [];

  // 分類済みデータをスキャン
  if (fs.existsSync(classifiedDir)) {
    const files = fs.readdirSync(classifiedDir).filter(f => f.endsWith('.md') && f !== 'brand-identity-candidates.md');
    for (const f of files) {
      const cat = path.basename(f, '.md');
      const content = fs.readFileSync(path.join(classifiedDir, f), 'utf-8');
      const entries = content.split('---').filter(s => s.trim()).length - 1;
      if (entries > 0) {
        proposals.push({ category: cat, count: entries });
      }
    }
  }

  if (proposals.length === 0) {
    console.log('📭 提案するデータがありません。');
    return;
  }

  // Slack投稿テキスト組み立て
  let text = `📊 *Slack #misao-data 取り込みレポート*\n\n`;
  text += `院長から以下のデータが投稿されました:\n\n`;

  for (const p of proposals) {
    const emoji = { achievements: '📈', costs: '💰', 'brand-voice': '💬', episodes: '📖', doctors: '👨‍⚕️', services: '🏥', media: '📺', general: '📝' };
    text += `${emoji[p.category] || '📝'} *${p.category}*: ${p.count}件\n`;
  }

  text += `\n*🔄 更新提案:*\n`;
  text += `取り込んだデータに基づき、以下のページの更新を提案します。\n`;
  text += `プレビュー版を作成してよろしいですか？\n\n`;
  text += `返信で「OK」→ プレビュー作成開始\n`;
  text += `返信で「確認」→ 取り込んだデータの詳細を表示`;

  if (dryRun) {
    console.log('--- Dry-run: 投稿内容 ---');
    console.log(text);
    console.log('--- ここまで ---');
  } else {
    const res = await slackPost(FEEDBACK_CHANNEL_ID, text);
    console.log(`✅ #misao-feedback に投稿しました（ts: ${res.ts}）`);
  }
}

// ============================================================
// メインルーター
// ============================================================
async function main() {
  switch (COMMAND) {
    case 'fetch':
      await cmdFetch();
      break;
    case 'analyze':
      await cmdAnalyze();
      break;
    case 'status':
      cmdStatus();
      break;
    case 'propose':
      await cmdPropose();
      break;
    default:
      console.error(`❌ 不明なコマンド: ${COMMAND}`);
      console.error('使い方: node scripts/slack-data-ingest.js [fetch|analyze|status|propose]');
      process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ エラー:', err.message);
  process.exit(1);
});
