#!/usr/bin/env tsx

/**
 * 自动化回归测试脚本
 * 用于验证主入口和评测系统是否正常工作
 *
 * 使用方法：
 * tsx scripts/regression-test.ts <vercel-url>
 *
 * 示例：
 * tsx scripts/regression-test.ts https://read-screen-git-claude-screensh-6fcacd-getups-projects-3677776c.vercel.app
 */

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

function log(message: string, color: keyof typeof COLORS = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function logTest(name: string) {
  console.log();
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'blue');
  log(`🧪 测试: ${name}`, 'blue');
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'blue');
}

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];

async function testEvaluateAPI(baseUrl: string, imageUrl: string): Promise<void> {
  logTest('评测 API (/api/evaluate)');

  const startTime = Date.now();

  try {
    log('  → 发送请求...', 'gray');
    const response = await fetch(`${baseUrl}/api/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl,
        strategyId: 'v1-baseline'
      })
    });

    const duration = Date.now() - startTime;
    log(`  → 响应状态: ${response.status} (耗时: ${(duration / 1000).toFixed(2)}s)`, 'gray');

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 返回 ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // 验证响应结构
    if (!data.success) {
      throw new Error(`API 返回 success: false - ${data.error}`);
    }

    if (!data.strategy) {
      throw new Error('响应缺少 strategy 字段');
    }

    if (!data.result || !data.result.cards) {
      throw new Error('响应缺少 result.cards 字段');
    }

    log(`  ✓ 策略版本: ${data.strategy.name}`, 'green');
    log(`  ✓ 生成卡片数: ${data.result.cards.length}`, 'green');
    log(`  ✓ API 响应正常`, 'green');

    results.push({
      name: '评测 API',
      passed: true,
      duration
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    log(`  ✗ 测试失败: ${error.message}`, 'red');

    results.push({
      name: '评测 API',
      passed: false,
      duration,
      error: error.message
    });
  }
}

async function testEvaluatePageLoad(baseUrl: string): Promise<void> {
  logTest('评测页面加载 (/evaluate.html)');

  const startTime = Date.now();

  try {
    log('  → 访问页面...', 'gray');
    const response = await fetch(`${baseUrl}/evaluate.html`);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`页面返回 ${response.status}`);
    }

    const html = await response.text();

    // 验证关键内容
    if (!html.includes('策略评测系统')) {
      throw new Error('页面内容不正确');
    }

    if (!html.includes('/api/evaluate')) {
      throw new Error('页面缺少 API 调用');
    }

    log(`  ✓ 页面加载成功 (耗时: ${(duration / 1000).toFixed(2)}s)`, 'green');
    log(`  ✓ 页面内容正确`, 'green');

    results.push({
      name: '评测页面',
      passed: true,
      duration
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    log(`  ✗ 测试失败: ${error.message}`, 'red');

    results.push({
      name: '评测页面',
      passed: false,
      duration,
      error: error.message
    });
  }
}

async function testMainInboxAPI(baseUrl: string): Promise<void> {
  logTest('主入口 - Inbox API (/api/inbox-data)');

  const startTime = Date.now();

  try {
    log('  → 发送请求...', 'gray');
    const response = await fetch(`${baseUrl}/api/inbox-data`);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`API 返回 ${response.status}`);
    }

    const data = await response.json();

    if (!data.items || !Array.isArray(data.items)) {
      throw new Error('响应格式不正确');
    }

    log(`  ✓ API 响应正常 (耗时: ${(duration / 1000).toFixed(2)}s)`, 'green');
    log(`  ✓ 返回 ${data.items.length} 条记录`, 'green');

    results.push({
      name: '主入口 Inbox API',
      passed: true,
      duration
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    log(`  ✗ 测试失败: ${error.message}`, 'red');

    results.push({
      name: '主入口 Inbox API',
      passed: false,
      duration,
      error: error.message
    });
  }
}

function printSummary() {
  console.log();
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  log('📊 测试总结', 'blue');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  console.log();

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  results.forEach(result => {
    const icon = result.passed ? '✓' : '✗';
    const color = result.passed ? 'green' : 'red';
    const time = (result.duration / 1000).toFixed(2);

    log(`  ${icon} ${result.name} (${time}s)`, color);
    if (result.error) {
      log(`    └─ ${result.error}`, 'red');
    }
  });

  console.log();
  log(`总计: ${total} | 通过: ${passed} | 失败: ${failed}`, passed === total ? 'green' : 'red');
  console.log();

  if (passed === total) {
    log('🎉 所有测试通过！', 'green');
  } else {
    log('⚠️  部分测试失败', 'yellow');
  }

  console.log();
}

async function main() {
  const baseUrl = process.argv[2];

  if (!baseUrl) {
    log('错误: 请提供 Vercel URL', 'red');
    log('使用方法: tsx scripts/regression-test.ts <vercel-url>', 'yellow');
    log('示例: tsx scripts/regression-test.ts https://read-screen.vercel.app', 'gray');
    process.exit(1);
  }

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  log('🧪 Snapshot AI 回归测试', 'blue');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'blue');
  log(`目标环境: ${baseUrl}`, 'gray');

  // 测试图片（使用用户提供的图片）
  const testImageUrl = 'https://ecctoixndgjycpounyfd.supabase.co/storage/v1/object/public/screenshots/1764815020083-24wcg.jpg';

  // 执行所有测试
  await testEvaluatePageLoad(baseUrl);
  await testMainInboxAPI(baseUrl);
  await testEvaluateAPI(baseUrl, testImageUrl);

  // 打印总结
  printSummary();

  // 根据结果设置退出码
  const allPassed = results.every(r => r.passed);
  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  log(`致命错误: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
