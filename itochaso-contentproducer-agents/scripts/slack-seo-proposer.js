#!/usr/bin/env node
/**
 * SEO競合コンテンツ提案 Slack連携スクリプト
 *
 * サブコマンド:
 *   propose           — 競合分析を実行し、コンテンツ提案を #misao-seo-meo-lleo-content に投稿
 *   check-commands    — Slackスレッドから「作って」指令を検出
 *   weekly-summary    — 週間サマリーを投稿
 *   notify-complete   — 記事完成を #misao-hp-feedback に通知
 *   backlog           — 未採用提案のバックログを表示
 *   status            — 提案・作成状況の一覧表示
 *
 * 環境変数:
 *   SLACK_BOT_TOKEN              — Bot User OAuth Token（xoxb-...）
 *   SLACK_SEO_CHANNEL_ID         — SEO提案チャンネルID（C0AJQC5AP51）
 *   SLACK_CHANNEL_ID             — フィードバックチャンネルID（既存）
 *
 * 必要な Bot Token Scopes:
 *   channels:history, channels:read, chat:write,
 *   reactions:write, reactions:read
 *
 * 使い方:
 *   node scripts/slack-seo-proposer.js propose [--dry-run]
 *   node scripts/slack-seo-proposer.js check-commands
 *   node scripts/slack-seo-proposer.js weekly-summary
 *   node scripts/slack-seo-proposer.js notify-complete --slug SLUG --title TITLE --score SCORE [--preview-url URL]
 *   node scripts/slack-seo-proposer.js backlog
 *   node scripts/slack-seo-proposer.js status
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// --- 設定 ---
const BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SEO_CHANNEL_ID = process.env.SLACK_SEO_CHANNEL_ID || 'C0AJQC5AP51';
const FEEDBACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID;

const PROJECT_ROOT = path.join(__dirname, '..');
const PROPOSALS_DIR = path.join(PROJECT_ROOT, 'audits', 'seo-proposals');
const STATE_FILE = path.join(PROPOSALS_DIR, 'seo-proposer-state.json');
const BACKLOG_FILE = path.join(PROPOSALS_DIR, 'backlog.md');
const SEO_TARGETS = path.join(PROJECT_ROOT, '.claude', 'knowledge', 'seo-targets.yaml');
const SITE_INVENTORY = path.join(PROJECT_ROOT, '.claude', 'knowledge', 'site-inventory.yaml');

// --- コマンド解析 ---
const args = process.argv.slice(2);
const COMMAND = args[0] || 'status';

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}
const hasFlag = (name) => args.includes(`--${name}`);
const DRY_RUN = hasFlag('dry-run');

// --- バリデーション ---
if (!BOT_TOKEN) {
  console.error('❌ 環境変数が未設定です:');
  console.error('   SLACK_BOT_TOKEN=xoxb-...');
  process.exit(1);
}

if (!FEEDBACK_CHANNEL_ID && COMMAND === 'notify-complete') {
  console.error('❌ SLACK_CHANNEL_ID が未設定です');
  process.exit(1);
}

// ============================================================
// ディレクトリ初期化
// ============================================================
if (!fs.existsSync(PROPOSALS_DIR)) {
  fs.mkdirSync(PROPOSALS_DIR, { recursive: true });
}

// ============================================================
// ステート管理
// ============================================================
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return {
      proposals: {},       // id → { date, title, kw, score, status, slackTs, articleSlug }
      lastRunDate: null,
      totalProposed: 0,
      totalCreated: 0
    };
  }
}

function saveState(data) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// ============================================================
// Slack API ヘルパー
// ============================================================
function slackAPI(method, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: 'slack.com',
      path: `/api/${method}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BOT_TOKEN}`,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let buf = '';
      res.on('data', (chunk) => buf += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(buf);
          if (!json.ok) {
            console.error(`Slack API error (${method}):`, json.error);
          }
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function postMessage(channel, text, blocks = null, threadTs = null) {
  const body = { channel, text };
  if (blocks) body.blocks = blocks;
  if (threadTs) body.thread_ts = threadTs;
  return slackAPI('chat.postMessage', body);
}

async function getChannelHistory(channel, limit = 100) {
  return slackAPI('conversations.history', { channel, limit });
}

async function getThreadReplies(channel, ts) {
  return slackAPI('conversations.replies', { channel, ts, limit: 100 });
}

// ============================================================
// 日付ヘルパー
// ============================================================
function today() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function todayCompact() {
  return today().replace(/-/g, '');
}

// ============================================================
// 提案ブロック生成
// ============================================================
function buildProposalBlocks(proposals) {
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `📋 SEOコンテンツ提案 — ${today()}`, emoji: true }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `本日の競合分析に基づくコンテンツ提案です。\n作成したい記事があれば、スレッドで *「これを作って」* と返信してください。`
      }
    },
    { type: 'divider' }
  ];

  proposals.forEach((p, i) => {
    const urgencyEmoji = p.urgency === 'high' ? '🔴' : p.urgency === 'medium' ? '🟡' : '🟢';
    const scoreBar = '█'.repeat(Math.floor(p.score / 10)) + '░'.repeat(10 - Math.floor(p.score / 10));

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `*提案 #${i + 1}* ${urgencyEmoji} *${p.title}*`,
          ``,
          `🔍 *KW*: \`${p.keywords.join('` / `')}\``,
          `📊 *推定ボリューム*: ${p.volume}`,
          `🏆 *競合*: ${p.competitors.map(c => `${c.name}（${c.status}）`).join(' / ')}`,
          `⚡ *勝ちポイント*: ${p.advantage}`,
          `📐 *記事タイプ*: ${p.articleType}`,
          `💡 *LLMEO効果*: ${p.llmeoEffect}`,
          `📈 *スコア*: ${scoreBar} ${p.score}/100`,
        ].join('\n')
      }
    });
    blocks.push({ type: 'divider' });
  });

  blocks.push({
    type: 'context',
    elements: [{
      type: 'mrkdwn',
      text: `🤖 SCP（SEO Content Proposer）自動提案 | スコア算出基準: 検索Vol(25) + 競合優位(25) + ブランド適合(20) + 緊急性(15) + LLMEO(15)`
    }]
  });

  return blocks;
}

// ============================================================
// 提案レポート保存
// ============================================================
function saveProposalReport(proposals) {
  const dateStr = todayCompact();
  const filePath = path.join(PROPOSALS_DIR, `daily-${dateStr}.md`);

  let md = `# SEOコンテンツ提案 日次レポート\n`;
  md += `日付: ${today()}\n`;
  md += `提案数: ${proposals.length}\n\n`;

  proposals.forEach((p, i) => {
    const urgency = p.urgency === 'high' ? '🔴 高' : p.urgency === 'medium' ? '🟡 中' : '🟢 低';
    md += `## 提案 #${i + 1}: ${p.title}\n\n`;
    md += `| 項目 | 内容 |\n|------|------|\n`;
    md += `| ターゲットKW | ${p.keywords.join(', ')} |\n`;
    md += `| 推定ボリューム | ${p.volume} |\n`;
    md += `| 緊急度 | ${urgency} |\n`;
    md += `| スコア | ${p.score}/100 |\n`;
    md += `| 記事タイプ | ${p.articleType} |\n`;
    md += `| LLMEO効果 | ${p.llmeoEffect} |\n\n`;

    md += `### 競合状況\n`;
    p.competitors.forEach(c => {
      md += `- **${c.name}**: ${c.status}${c.url ? ` — ${c.url}` : ''}\n`;
    });
    md += `\n### 勝ちポイント\n${p.advantage}\n\n`;
    md += `### 構成案メモ\n${p.outline || '（記事作成指令時に詳細化）'}\n\n`;
    md += `---\n\n`;
  });

  fs.writeFileSync(filePath, md, 'utf-8');
  console.log(`📝 レポート保存: ${filePath}`);
  return filePath;
}

// ============================================================
// バックログ管理
// ============================================================
function updateBacklog(proposals, state) {
  let md = `# SEOコンテンツ提案バックログ\n`;
  md += `最終更新: ${today()}\n\n`;
  md += `| # | 提案日 | タイトル | KW | スコア | ステータス |\n`;
  md += `|---|--------|---------|-----|--------|----------|\n`;

  const allProposals = Object.entries(state.proposals)
    .sort((a, b) => b[1].score - a[1].score);

  allProposals.forEach(([id, p], i) => {
    const status = p.status === 'created' ? '✅ 作成済み'
      : p.status === 'in_progress' ? '🔨 作成中'
      : p.status === 'rejected' ? '❌ 不採用'
      : '📋 待機中';
    md += `| ${i + 1} | ${p.date} | ${p.title} | ${p.kw} | ${p.score} | ${status} |\n`;
  });

  fs.writeFileSync(BACKLOG_FILE, md, 'utf-8');
  console.log(`📝 バックログ更新: ${BACKLOG_FILE}`);
}

// ============================================================
// コマンド: propose（競合分析→提案投稿）
// ============================================================
async function cmdPropose() {
  console.log('🔍 競合分析を開始...\n');

  const state = loadState();

  // 提案データは外部（Claude Code / エージェント）から生成される
  // このスクリプトは、audits/seo-proposals/daily-YYYYMMDD.json を読み込んで投稿する
  const jsonPath = path.join(PROPOSALS_DIR, `daily-${todayCompact()}.json`);

  if (!fs.existsSync(jsonPath)) {
    console.log(`⚠️  提案データが見つかりません: ${jsonPath}`);
    console.log('');
    console.log('提案データの生成方法:');
    console.log('  1. Claude Code で SCP エージェントを実行');
    console.log('  2. agents/seo-content-proposer.md の手順に従って競合分析');
    console.log('  3. 分析結果を以下の JSON 形式で保存:');
    console.log(`     ${jsonPath}`);
    console.log('');
    console.log('JSON形式:');
    console.log(JSON.stringify([{
      id: "scp-YYYYMMDD-01",
      title: "記事タイトル",
      keywords: ["KW1", "KW2"],
      volume: "中（月間100-500）",
      urgency: "high|medium|low",
      score: 85,
      competitors: [{ name: "競合名", status: "記事あり（3位）", url: "https://..." }],
      advantage: "操レディスの強み",
      articleType: "コラム記事",
      llmeoEffect: "LLMEO効果の説明",
      outline: "構成案メモ"
    }], null, 2));
    return;
  }

  let proposals;
  try {
    proposals = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } catch (e) {
    console.error(`❌ JSONの解析に失敗: ${e.message}`);
    return;
  }

  if (!Array.isArray(proposals) || proposals.length === 0) {
    console.log('ℹ️  本日の提案はありません。');
    return;
  }

  // 上位3件を投稿
  const topProposals = proposals.slice(0, 3);

  console.log(`📋 ${topProposals.length}件の提案を投稿します:\n`);
  topProposals.forEach((p, i) => {
    console.log(`  ${i + 1}. [${p.score}点] ${p.title}`);
  });
  console.log('');

  if (DRY_RUN) {
    console.log('🔄 --dry-run モード: Slack投稿をスキップ');
    saveProposalReport(topProposals);
    return;
  }

  // Slack に投稿
  const blocks = buildProposalBlocks(topProposals);
  const plainText = `📋 SEOコンテンツ提案 — ${today()}\n${topProposals.map((p, i) => `${i + 1}. [${p.score}点] ${p.title}`).join('\n')}`;

  const result = await postMessage(SEO_CHANNEL_ID, plainText, blocks);

  if (result.ok) {
    console.log(`✅ Slack投稿完了（ts: ${result.ts}）`);

    // ステート更新
    topProposals.forEach(p => {
      state.proposals[p.id] = {
        date: today(),
        title: p.title,
        kw: p.keywords[0],
        score: p.score,
        status: 'proposed',
        slackTs: result.ts,
        articleSlug: null
      };
    });
    state.lastRunDate = today();
    state.totalProposed += topProposals.length;
    saveState(state);

    // レポート保存
    saveProposalReport(topProposals);

    // バックログ更新
    updateBacklog(topProposals, state);

    // 残りはバックログに追加
    if (proposals.length > 3) {
      console.log(`\nℹ️  残り ${proposals.length - 3}件はバックログに追加`);
      proposals.slice(3).forEach(p => {
        state.proposals[p.id] = {
          date: today(),
          title: p.title,
          kw: p.keywords[0],
          score: p.score,
          status: 'backlog',
          slackTs: null,
          articleSlug: null
        };
      });
      saveState(state);
    }
  } else {
    console.error('❌ Slack投稿に失敗:', result.error);
  }
}

// ============================================================
// コマンド: check-commands（「作って」指令検出）
// ============================================================
async function cmdCheckCommands() {
  console.log('🔍 「作って」指令を検出中...\n');

  const state = loadState();
  const pendingProposals = Object.entries(state.proposals)
    .filter(([_, p]) => p.status === 'proposed' && p.slackTs);

  if (pendingProposals.length === 0) {
    console.log('ℹ️  返信待ちの提案はありません。');
    return;
  }

  const createPatterns = [
    /作って/,
    /作成して/,
    /これ.*作/,
    /お願い/,
    /作りたい/,
    /GO/i,
    /実行/
  ];

  let commandsFound = [];

  for (const [id, proposal] of pendingProposals) {
    console.log(`  📋 チェック中: ${proposal.title} (ts: ${proposal.slackTs})`);

    const replies = await getThreadReplies(SEO_CHANNEL_ID, proposal.slackTs);
    if (!replies.ok || !replies.messages) continue;

    // Bot自身の投稿を除外してスレッド返信を確認
    const humanReplies = replies.messages.filter(m =>
      !m.bot_id && m.ts !== proposal.slackTs
    );

    for (const reply of humanReplies) {
      const text = reply.text || '';
      const matched = createPatterns.some(p => p.test(text));

      if (matched) {
        // 提案番号の特定を試みる
        const numMatch = text.match(/#?(\d+)/);
        const proposalNum = numMatch ? parseInt(numMatch[1]) : null;

        commandsFound.push({
          proposalId: id,
          title: proposal.title,
          requestedBy: reply.user,
          requestedAt: new Date(parseFloat(reply.ts) * 1000).toISOString(),
          replyText: text,
          targetNum: proposalNum
        });

        // ステータス更新
        state.proposals[id].status = 'commanded';
        console.log(`  ✅ 指令検出: 「${text}」 → ${proposal.title}`);
      }
    }
  }

  saveState(state);

  if (commandsFound.length === 0) {
    console.log('\nℹ️  新しい「作って」指令はありませんでした。');
  } else {
    console.log(`\n🎯 ${commandsFound.length}件の作成指令を検出:\n`);
    commandsFound.forEach((cmd, i) => {
      console.log(`  ${i + 1}. ${cmd.title}`);
      console.log(`     指令: 「${cmd.replyText}」`);
      console.log(`     日時: ${cmd.requestedAt}`);
      console.log('');
    });

    // 指令リストをJSON出力（パイプラインで利用）
    const outputPath = path.join(PROPOSALS_DIR, `commands-${todayCompact()}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(commandsFound, null, 2) + '\n', 'utf-8');
    console.log(`📝 指令リスト保存: ${outputPath}`);
  }
}

// ============================================================
// コマンド: weekly-summary（週間サマリー）
// ============================================================
async function cmdWeeklySummary() {
  console.log('📊 週間サマリーを生成中...\n');

  const state = loadState();

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weekAgoStr = oneWeekAgo.toISOString().split('T')[0];

  const weekProposals = Object.entries(state.proposals)
    .filter(([_, p]) => p.date >= weekAgoStr)
    .sort((a, b) => b[1].score - a[1].score);

  const proposed = weekProposals.filter(([_, p]) => ['proposed', 'backlog'].includes(p.status)).length;
  const commanded = weekProposals.filter(([_, p]) => p.status === 'commanded').length;
  const created = weekProposals.filter(([_, p]) => p.status === 'created').length;
  const inProgress = weekProposals.filter(([_, p]) => p.status === 'in_progress').length;

  const summaryText = [
    `📊 *SEOコンテンツ提案 週間サマリー*`,
    `期間: ${weekAgoStr} 〜 ${today()}`,
    ``,
    `📋 提案数: *${weekProposals.length}件*`,
    `🎯 作成指令: *${commanded}件*`,
    `🔨 作成中: *${inProgress}件*`,
    `✅ 完成: *${created}件*`,
    `📋 待機中: *${proposed}件*`,
    ``,
    `*提案一覧（スコア順）:*`,
    ...weekProposals.map(([_, p], i) => {
      const status = p.status === 'created' ? '✅'
        : p.status === 'in_progress' ? '🔨'
        : p.status === 'commanded' ? '🎯'
        : '📋';
      return `${i + 1}. ${status} [${p.score}点] ${p.title} (${p.kw})`;
    })
  ].join('\n');

  if (DRY_RUN) {
    console.log('🔄 --dry-run モード:\n');
    console.log(summaryText);
    return;
  }

  const result = await postMessage(SEO_CHANNEL_ID, summaryText);
  if (result.ok) {
    console.log('✅ 週間サマリーを投稿しました');
  } else {
    console.error('❌ 投稿失敗:', result.error);
  }

  // マークダウンレポートも保存
  const reportPath = path.join(PROPOSALS_DIR, `weekly-${todayCompact()}.md`);
  let md = `# SEOコンテンツ提案 週間サマリー\n`;
  md += `期間: ${weekAgoStr} 〜 ${today()}\n\n`;
  md += `## 集計\n`;
  md += `| 指標 | 数 |\n|------|----|\n`;
  md += `| 提案数 | ${weekProposals.length} |\n`;
  md += `| 作成指令 | ${commanded} |\n`;
  md += `| 作成中 | ${inProgress} |\n`;
  md += `| 完成 | ${created} |\n`;
  md += `| 待機中 | ${proposed} |\n\n`;
  md += `## 提案一覧\n`;
  md += `| # | スコア | タイトル | KW | ステータス |\n`;
  md += `|---|--------|---------|-----|----------|\n`;
  weekProposals.forEach(([_, p], i) => {
    md += `| ${i + 1} | ${p.score} | ${p.title} | ${p.kw} | ${p.status} |\n`;
  });

  fs.writeFileSync(reportPath, md, 'utf-8');
  console.log(`📝 レポート保存: ${reportPath}`);
}

// ============================================================
// コマンド: notify-complete（記事完成通知）
// ============================================================
async function cmdNotifyComplete() {
  const slug = getArg('slug');
  const title = getArg('title');
  const score = getArg('score');
  const previewUrl = getArg('preview-url');

  if (!slug || !title) {
    console.error('❌ 必須引数が不足:');
    console.error('   --slug SLUG --title TITLE [--score SCORE] [--preview-url URL]');
    process.exit(1);
  }

  const state = loadState();

  // 該当提案のステータスを更新
  const matchedEntry = Object.entries(state.proposals)
    .find(([_, p]) => p.articleSlug === slug || p.title === title);

  if (matchedEntry) {
    const [id] = matchedEntry;
    state.proposals[id].status = 'created';
    state.proposals[id].articleSlug = slug;
    state.totalCreated++;
    saveState(state);
  }

  // #misao-hp-feedback に通知
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '📝 新規コラム記事 — プレビュー確認依頼', emoji: true }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `*記事タイトル*: ${title}`,
          `*記事スラッグ*: \`/articles/${slug}/\``,
          score ? `*品質スコア*: ${score}点（CQG評価）` : '',
          previewUrl ? `*プレビュー*: ${previewUrl}` : '',
          ``,
          `✅ 内容をご確認いただき、問題なければスレッドで *「OK」* または *「公開して」* とご返信ください。`,
          `修正点があればスレッドにコメントをお願いします。`
        ].filter(Boolean).join('\n')
      }
    },
    {
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: `🤖 SCP → CST → WRT → BLD → CQG パイプラインで作成 | ${today()}`
      }]
    }
  ];

  const plainText = `📝 新規コラム記事プレビュー確認: ${title}`;

  if (DRY_RUN) {
    console.log('🔄 --dry-run モード:');
    console.log(plainText);
    return;
  }

  const result = await postMessage(FEEDBACK_CHANNEL_ID, plainText, blocks);
  if (result.ok) {
    console.log(`✅ プレビュー確認依頼を #misao-hp-feedback に投稿しました（ts: ${result.ts}）`);
  } else {
    console.error('❌ 投稿失敗:', result.error);
  }
}

// ============================================================
// コマンド: backlog（バックログ表示）
// ============================================================
function cmdBacklog() {
  const state = loadState();

  const backlogItems = Object.entries(state.proposals)
    .filter(([_, p]) => ['proposed', 'backlog'].includes(p.status))
    .sort((a, b) => b[1].score - a[1].score);

  if (backlogItems.length === 0) {
    console.log('ℹ️  バックログは空です。');
    return;
  }

  console.log(`📋 SEOコンテンツ提案バックログ（${backlogItems.length}件）\n`);
  console.log('  # | スコア | 提案日     | タイトル');
  console.log('  --|--------|------------|--------');

  backlogItems.forEach(([_, p], i) => {
    console.log(`  ${String(i + 1).padStart(2)} | ${String(p.score).padStart(5)} | ${p.date} | ${p.title}`);
  });
}

// ============================================================
// コマンド: status（全体ステータス）
// ============================================================
function cmdStatus() {
  const state = loadState();

  const total = Object.keys(state.proposals).length;
  const byStatus = {};
  Object.values(state.proposals).forEach(p => {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
  });

  console.log('📊 SEO Content Proposer ステータス\n');
  console.log(`  最終実行: ${state.lastRunDate || '未実行'}`);
  console.log(`  累計提案: ${state.totalProposed}`);
  console.log(`  累計作成: ${state.totalCreated}`);
  console.log('');

  if (total > 0) {
    console.log('  ステータス別:');
    const statusLabels = {
      proposed: '📋 提案済み',
      commanded: '🎯 作成指令',
      in_progress: '🔨 作成中',
      created: '✅ 完成',
      backlog: '📦 バックログ',
      rejected: '❌ 不採用'
    };
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`    ${statusLabels[status] || status}: ${count}件`);
    });
  }

  // 直近の提案ファイル確認
  console.log('\n  直近の提案レポート:');
  try {
    const files = fs.readdirSync(PROPOSALS_DIR)
      .filter(f => f.startsWith('daily-') && f.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, 5);

    if (files.length > 0) {
      files.forEach(f => console.log(`    ${f}`));
    } else {
      console.log('    （なし）');
    }
  } catch {
    console.log('    （ディレクトリ未作成）');
  }
}

// ============================================================
// メインルーター
// ============================================================
async function main() {
  switch (COMMAND) {
    case 'propose':
      await cmdPropose();
      break;
    case 'check-commands':
      await cmdCheckCommands();
      break;
    case 'weekly-summary':
      await cmdWeeklySummary();
      break;
    case 'notify-complete':
      await cmdNotifyComplete();
      break;
    case 'backlog':
      cmdBacklog();
      break;
    case 'status':
      cmdStatus();
      break;
    default:
      console.error(`❌ 不明なコマンド: ${COMMAND}`);
      console.log('');
      console.log('使い方:');
      console.log('  node scripts/slack-seo-proposer.js propose [--dry-run]');
      console.log('  node scripts/slack-seo-proposer.js check-commands');
      console.log('  node scripts/slack-seo-proposer.js weekly-summary');
      console.log('  node scripts/slack-seo-proposer.js notify-complete --slug SLUG --title TITLE');
      console.log('  node scripts/slack-seo-proposer.js backlog');
      console.log('  node scripts/slack-seo-proposer.js status');
      process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ エラー:', err);
  process.exit(1);
});
