#!/usr/bin/env node
/**
 * 管理脚本：检查 Supabase inbox 中的数据状态
 * 用法：npx tsx scripts/check-inbox.ts
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

async function checkInbox() {
  console.log('🔍 正在检查 inbox 数据...\n');

  const { data, error } = await supabase
    .from('inbox')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ 查询失败:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('📭 Inbox 是空的');
    return;
  }

  console.log(`📬 找到 ${data.length} 条记录:\n`);

  data.forEach((item, index) => {
    console.log(`[${index + 1}] ID: ${item.id}`);
    console.log(`    状态: ${item.status}`);
    console.log(`    来源: ${item.source || 'unknown'}`);
    console.log(`    创建时间: ${item.created_at}`);
    console.log(`    图片URL: ${item.image_url}`);
    console.log(`    有分析结果: ${item.analysis_result ? '✅' : '❌'}`);
    console.log('');
  });

  // 统计
  const stats = {
    uploaded: data.filter(d => d.status === 'uploaded').length,
    ready: data.filter(d => d.status === 'ready').length,
    error: data.filter(d => d.status === 'error').length,
  };

  console.log('📊 状态统计:');
  console.log(`   - uploaded (待处理): ${stats.uploaded}`);
  console.log(`   - ready (已完成): ${stats.ready}`);
  console.log(`   - error (失败): ${stats.error}`);
}

checkInbox().catch(console.error);
