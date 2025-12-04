#!/usr/bin/env node
/**
 * 快速测试脚本 - 直接测试现有图片
 *
 * 用法：
 * npm run test-prompt <image-url> <vercel-api-url>
 *
 * 示例：
 * npm run test-prompt \
 *   "https://xmrhqilrlfckqqtaxbgg.supabase.co/storage/v1/object/public/screenshots/1764815020083-24wcg.jpg" \
 *   "https://read-screen.vercel.app"
 */

import * as fs from 'fs';
import * as path from 'path';

const imageUrl = process.argv[2];
const vercelUrl = process.argv[3] || 'https://read-screen.vercel.app';

if (!imageUrl) {
  console.error('❌ 缺少图片URL参数');
  console.log('\n用法：');
  console.log('  npm run test-prompt <image-url> [vercel-url]');
  console.log('\n示例：');
  console.log('  npm run test-prompt "https://...supabase.co/.../screenshot.jpg"');
  process.exit(1);
}

async function testPrompt() {
  console.log('🧪 开始测试 Prompt');
  console.log('='.repeat(80));
  console.log(`\n📷 图片URL: ${imageUrl}`);
  console.log(`🌐 API地址: ${vercelUrl}/api/process`);

  try {
    // 1. 调用 process API
    console.log('\n⏳ 调用AI分析...');

    const response = await fetch(`${vercelUrl}/api/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: `test_${Date.now()}`,
        imageUrl: imageUrl
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API调用失败: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ AI分析完成\n');

    // 2. 解析并显示结果
    // 注意：process API 返回 {success: true}，实际结果在 Supabase
    // 我们需要直接调用AI，所以修改为直接获取分析结果

    console.log('⚠️  注意：process API 只返回成功状态。');
    console.log('真实结果已保存到 Supabase inbox 表。');
    console.log('\n请使用以下方式查看：');
    console.log('1. Supabase Table Editor → inbox → 最新记录 → analysis_result');
    console.log('2. 或使用: npm run check-inbox');

    return result;

  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  }
}

testPrompt().catch(console.error);
