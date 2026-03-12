#!/usr/bin/env node
/**
 * セットアップウィザード
 *
 * 初期設定を対話式で行い、config.yaml と .env を生成する。
 *
 * 使い方:
 *   node scripts/setup-wizard.js [--skip-validation] [--config-only] [--env-only]
 *
 * やること:
 * 1. config.yaml から既存値を読み込む
 * 2. 対話式で質問に答えてもらう（スキップ可能）
 * 3. config.yaml にテンプレート値を埋め込む
 * 4. .env ファイルを作成（Slack トークン等）
 * 5. .claude/knowledge 内の {{placeholder}} を置換
 * 6. バリデーション実行
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const PROJECT_ROOT = path.join(__dirname, '..');
const CONFIG_FILE = path.join(PROJECT_ROOT, 'config.yaml');
const ENV_FILE = path.join(PROJECT_ROOT, '.env');
const KNOWLEDGE_DIR = path.join(PROJECT_ROOT, '.claude', 'knowledge');

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const SKIP_VALIDATION = hasFlag('skip-validation');
const CONFIG_ONLY = hasFlag('config-only');
const ENV_ONLY = hasFlag('env-only');

// 色付き出力
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

// Readline インタフェース
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt, defaultValue = null) {
  return new Promise((resolve) => {
    const displayPrompt = defaultValue
      ? `${prompt} [${defaultValue}]: `
      : `${prompt}: `;
    rl.question(displayPrompt, (answer) => {
      const trimmed = answer.trim();
      resolve(trimmed || defaultValue || '');
    });
  });
}

async function main() {
  log('\n========================================', 'blue');
  log('  セットアップウィザード', 'bright');
  log('========================================\n', 'blue');

  // 既存 config.yaml を読み込む
  let config = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      config = yaml.load(fs.readFileSync(CONFIG_FILE, 'utf-8')) || {};
      log(`✅ config.yaml を読み込みました`, 'green');
    } catch (e) {
      log(`⚠️  config.yaml の解析に失敗: ${e.message}`, 'yellow');
      config = {};
    }
  } else {
    log(`📝 新規 config.yaml を作成します`, 'blue');
  }

  // ========================================
  // CONFIG セクション
  // ========================================
  if (!CONFIG_ONLY || !ENV_ONLY) {
    log('\n--- クライアント情報 ---\n', 'bright');

    const clientName = await question(
      '✏️  クライアント名（例: 操レディスホスピタル）',
      config.client?.name || ''
    );
    const clientShort = await question(
      '✏️  略称（例: 操レディス）',
      config.client?.name_short || ''
    );
    const domain = await question(
      '✏️  ドメイン（例: misao-ladies.jp）',
      config.client?.domain || ''
    );
    const industry = await question(
      '✏️  業種（medical/dental/beauty/legal/realestate/restaurant/general）',
      config.client?.industry || 'medical'
    );
    const specialty = await question(
      '✏️  専門分野（例: obstetrics）',
      config.client?.specialty || ''
    );
    const primaryCity = await question(
      '✏️  主商圏の市区町村',
      config.client?.area?.primary_city || ''
    );
    const prefecture = await question(
      '✏️  都道府県',
      config.client?.area?.prefecture || ''
    );
    const description = await question(
      '✏️  事業説明（1-2文）',
      config.client?.description || ''
    );

    log('\n--- ブランド情報 ---\n', 'bright');

    const ownerName = await question(
      '✏️  代表者名',
      config.brand?.owner_name || ''
    );
    const ownerTitle = await question(
      '✏️  肩書き（例: 院長）',
      config.brand?.owner_title || ''
    );
    const philosophy = await question(
      '✏️  理念・想い（1文）',
      config.brand?.philosophy || ''
    );
    const foundingYear = await question(
      '✏️  創業年',
      config.brand?.founding_year?.toString() || new Date().getFullYear().toString()
    );

    log('\n--- WordPress設定 ---\n', 'bright');

    const wpUrl = await question(
      '✏️  WordPress URL（例: https://example.com）',
      config.wordpress?.url || `https://${domain}`
    );
    const wpApiBase = await question(
      '✏️  REST API ベース（例: https://example.com/wp-json/wp/v2）',
      config.wordpress?.api_base || `${wpUrl}/wp-json/wp/v2`
    );
    const wpTheme = await question(
      '✏️  テーマ名',
      config.wordpress?.theme || 'custom'
    );
    const previewToken = await question(
      '✏️  プレビュートークン',
      config.wordpress?.preview_token || 'preview-2026'
    );

    // config.yaml を更新
    config = {
      ...config,
      client: {
        ...(config.client || {}),
        name: clientName,
        name_short: clientShort,
        domain,
        industry,
        specialty,
        area: {
          primary_city: primaryCity,
          prefecture,
          neighboring: config.client?.area?.neighboring || [],
        },
        description,
      },
      brand: {
        ...(config.brand || {}),
        owner_name: ownerName,
        owner_title: ownerTitle,
        founding_year: parseInt(foundingYear, 10),
        philosophy,
      },
      wordpress: {
        ...(config.wordpress || {}),
        url: wpUrl,
        api_base: wpApiBase,
        theme: wpTheme,
        preview_token: previewToken,
      },
    };
  }

  // ========================================
  // ENV セクション
  // ========================================
  if (!CONFIG_ONLY || !ENV_ONLY) {
    log('\n--- Slack設定 ---\n', 'bright');

    let existingEnv = {};
    if (fs.existsSync(ENV_FILE)) {
      const envLines = fs
        .readFileSync(ENV_FILE, 'utf-8')
        .split('\n')
        .filter((l) => l.trim() && !l.startsWith('#'));
      envLines.forEach((line) => {
        const [key, value] = line.split('=');
        if (key) {
          existingEnv[key.trim()] = value?.trim() || '';
        }
      });
    }

    const slackBotToken = await question(
      '🔐 Slack Bot Token（xoxb-...）',
      existingEnv.SLACK_BOT_TOKEN || ''
    );
    const slackFeedbackChannel = await question(
      '💬 Slack Feedback チャンネルID（C0...）',
      config.slack?.channels?.feedback || existingEnv.SLACK_CHANNEL_ID || ''
    );
    const slackDeployChannel = await question(
      '🚀 Slack Deploy チャンネルID（C0...）',
      config.slack?.channels?.deploy || existingEnv.SLACK_DEPLOY_CHANNEL_ID || ''
    );
    const slackSeoChannel = await question(
      '📊 Slack SEO Content チャンネルID（C0...）',
      config.slack?.channels?.seo_content || ''
    );
    const slackDataChannel = await question(
      '📥 Slack Data Ingest チャンネルID（C0...）',
      config.slack?.channels?.data_ingest || ''
    );

    // config.yaml に Slack 情報を更新
    config.slack = {
      ...(config.slack || {}),
      enabled: true,
      channels: {
        feedback: slackFeedbackChannel,
        deploy: slackDeployChannel,
        seo_content: slackSeoChannel,
        data_ingest: slackDataChannel,
      },
    };

    // .env を生成
    const wpUsername = await question(
      '👤 WordPress REST API ユーザー名（オプション）',
      existingEnv.WP_USERNAME || ''
    );
    const wpAppPassword = await question(
      '🔐 WordPress REST API パスワード（オプション）',
      existingEnv.WP_APP_PASSWORD || ''
    );

    const envContent = [
      '# ========================================',
      '# 環境変数設定ファイル',
      '# .gitignore に追加してください',
      '# ========================================',
      '',
      `# Slack連携`,
      `SLACK_BOT_TOKEN=${slackBotToken}`,
      `SLACK_CHANNEL_ID=${slackFeedbackChannel}`,
      `SLACK_DEPLOY_CHANNEL_ID=${slackDeployChannel}`,
      `SLACK_SEO_CHANNEL_ID=${slackSeoChannel}`,
      `SLACK_DATA_CHANNEL_ID=${slackDataChannel}`,
      '',
      `# WordPress REST API`,
      wpUsername ? `WP_USERNAME=${wpUsername}` : '# WP_USERNAME=',
      wpAppPassword ? `WP_APP_PASSWORD=${wpAppPassword}` : '# WP_APP_PASSWORD=',
      '',
      `# その他`,
      `PROJECT_ENV=development`,
    ]
      .filter((l) => l !== '')
      .join('\n');

    fs.writeFileSync(ENV_FILE, envContent + '\n', 'utf-8');
    log(`\n✅ .env を生成しました: ${ENV_FILE}`, 'green');
  }

  // ========================================
  // config.yaml を保存
  // ========================================
  fs.writeFileSync(CONFIG_FILE, yaml.dump(config, { lineWidth: -1 }), 'utf-8');
  log(`✅ config.yaml を保存しました: ${CONFIG_FILE}`, 'green');

  // ========================================
  // テンプレート置換
  // ========================================
  log('\n--- テンプレート置換 ---\n', 'bright');

  const replacements = {
    '{{CLIENT_NAME}}': config.client?.name || '',
    '{{CLIENT_SHORT}}': config.client?.name_short || '',
    '{{DOMAIN}}': config.client?.domain || '',
    '{{WP_URL}}': config.wordpress?.url || '',
    '{{WP_API_BASE}}': config.wordpress?.api_base || '',
    '{{PREVIEW_TOKEN}}': config.wordpress?.preview_token || 'preview-2026',
    '{{OWNER_NAME}}': config.brand?.owner_name || '',
    '{{PHILOSOPHY}}': config.brand?.philosophy || '',
    '{{PRIMARY_CITY}}': config.client?.area?.primary_city || '',
    '{{PREFECTURE}}': config.client?.area?.prefecture || '',
  };

  // .claude/knowledge 内のすべてのファイルを処理
  if (fs.existsSync(KNOWLEDGE_DIR)) {
    const files = fs.readdirSync(KNOWLEDGE_DIR);
    let replacedCount = 0;

    for (const file of files) {
      if (!file.endsWith('.md') && !file.endsWith('.yaml')) continue;

      const filePath = path.join(KNOWLEDGE_DIR, file);
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) continue;

      let content = fs.readFileSync(filePath, 'utf-8');
      let modified = false;

      for (const [key, value] of Object.entries(replacements)) {
        if (content.includes(key)) {
          content = content.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(filePath, content, 'utf-8');
        replacedCount++;
      }
    }

    log(`✅ ${replacedCount} 個のファイルでテンプレートを置換しました`, 'green');
  }

  // ========================================
  // バリデーション
  // ========================================
  if (!SKIP_VALIDATION) {
    log('\n--- バリデーション ---\n', 'bright');

    const validations = [
      {
        name: 'クライアント名',
        check: () => config.client?.name,
      },
      {
        name: 'ドメイン',
        check: () => config.client?.domain && /^[a-z0-9][a-z0-9-]*\.([a-z]{2,})+$/i.test(config.client.domain),
      },
      {
        name: 'WordPress URL',
        check: () => config.wordpress?.url && /^https?:\/\/.+/.test(config.wordpress.url),
      },
      {
        name: 'REST API ベース',
        check: () => config.wordpress?.api_base && /^https?:\/\/.+/.test(config.wordpress.api_base),
      },
      {
        name: 'Slack Bot Token',
        check: () => process.env.SLACK_BOT_TOKEN || config.slack?.channels?.feedback,
      },
    ];

    let validationsPassed = 0;
    for (const validation of validations) {
      if (validation.check()) {
        log(`✅ ${validation.name}`, 'green');
        validationsPassed++;
      } else {
        log(`❌ ${validation.name} — 確認してください`, 'red');
      }
    }

    log(
      `\n${validationsPassed}/${validations.length} のバリデーションに合格しました\n`,
      validationsPassed === validations.length ? 'green' : 'yellow'
    );
  }

  log('========================================', 'blue');
  log('  セットアップ完了 ✅', 'green');
  log('========================================\n', 'blue');

  log('次のステップ:', 'bright');
  log('1. config.yaml を確認してください');
  log('2. .env をセキュアに管理してください（.gitignore に追加）');
  log('3. スクリプトを実行: node scripts/slack-feedback.js status\n');

  rl.close();
}

main().catch((err) => {
  log(`\n❌ エラー: ${err.message}`, 'red');
  rl.close();
  process.exit(1);
});
