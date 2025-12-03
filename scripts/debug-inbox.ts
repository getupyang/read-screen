#!/usr/bin/env node
/**
 * 调试工具：详细显示inbox中所有记录的状态
 * 用法：npx tsx scripts/debug-inbox.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少 Supabase 环境变量');
  console.error('请设置: VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugInbox() {
  console.log('🔍 正在检查 inbox 所有记录...\n');

  const { data, error } = await supabase
    .from('inbox')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ 查询失败:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('📭 Inbox 是空的');
    return;
  }

  console.log(`📬 找到 ${data.length} 条记录:\n`);
  console.log('='.repeat(80));

  data.forEach((item, index) => {
    console.log(`\n[记录 ${index + 1}]`);
    console.log(`ID: ${item.id}`);
    console.log(`创建时间: ${item.created_at}`);
    console.log(`来源: ${item.source || 'unknown'}`);
    console.log(`状态: ${item.status}`);
    console.log(`图片URL: ${item.image_url.substring(0, 60)}...`);

    // 检查分析结果
    if (item.analysis_result) {
      const cards = item.analysis_result.cards || [];
      console.log(`✅ 有分析结果: ${cards.length} 张卡片`);

      if (cards.length > 0) {
        cards.forEach((card: any, i: number) => {
          console.log(`   卡片${i + 1}: [${card.type}] ${card.title}`);
        });
      } else {
        console.log('   ⚠️  警告: analysis_result存在但cards数组为空');
      }
    } else {
      console.log(`❌ 无分析结果`);
    }

    // 检查错误信息
    if (item.error_message) {
      console.log(`❌ 错误信息: ${item.error_message}`);
    }

    // 前端是否会显示
    const willShow = item.status === 'ready' &&
                     item.analysis_result?.cards &&
                     item.analysis_result.cards.length > 0;
    console.log(`前端显示: ${willShow ? '✅ 会显示' : '❌ 不会显示'}`);

    if (!willShow && item.status === 'ready') {
      console.log(`⚠️  问题: status是ready但没有有效的cards数据`);
    }

    console.log('='.repeat(80));
  });

  // 统计
  const stats = {
    total: data.length,
    uploaded: data.filter(d => d.status === 'uploaded').length,
    ready: data.filter(d => d.status === 'ready').length,
    error: data.filter(d => d.status === 'error').length,
    willShow: data.filter(d =>
      d.status === 'ready' &&
      d.analysis_result?.cards &&
      d.analysis_result.cards.length > 0
    ).length,
  };

  console.log('\n📊 总体统计:');
  console.log(`   总记录数: ${stats.total}`);
  console.log(`   - uploaded (待处理): ${stats.uploaded}`);
  console.log(`   - ready (已完成): ${stats.ready}`);
  console.log(`   - error (失败): ${stats.error}`);
  console.log(`   前端会显示的卡片数: ${stats.willShow}`);

  if (stats.ready > stats.willShow) {
    console.log('\n⚠️  发现问题: 有些记录status是ready但前端不会显示它们');
    console.log('    可能原因: analysis_result格式不对或cards为空');
  }
}

debugInbox().catch(console.error);
