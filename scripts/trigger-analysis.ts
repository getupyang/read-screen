#!/usr/bin/env node
/**
 * 触发分析脚本：手动触发Supabase中待处理图片的AI分析
 * 用法：npx tsx scripts/trigger-analysis.ts [vercel-url]
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

// 从命令行参数获取Vercel URL，或使用默认值
const vercelUrl = process.argv[2] || 'https://read-screen.vercel.app';

async function triggerAnalysis() {
  console.log('🔍 正在查找待处理的图片...\n');

  // 1. 查找所有uploaded状态的记录
  const { data: uploadedItems, error } = await supabase
    .from('inbox')
    .select('id, image_url, created_at')
    .eq('status', 'uploaded')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ 查询失败:', error.message);
    return;
  }

  if (!uploadedItems || uploadedItems.length === 0) {
    console.log('✅ 没有待处理的图片\n');
    console.log('检查是否有ready状态的记录...');

    const { data: readyItems } = await supabase
      .from('inbox')
      .select('id, status, created_at')
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .limit(5);

    if (readyItems && readyItems.length > 0) {
      console.log(`\n✨ 找到 ${readyItems.length} 张已完成的卡片`);
      console.log('你可以直接在前端看到它们！');
      console.log(`\n🌐 访问: ${vercelUrl}`);
    }
    return;
  }

  console.log(`📬 找到 ${uploadedItems.length} 张待处理图片:\n`);

  uploadedItems.forEach((item, index) => {
    console.log(`[${index + 1}] ID: ${item.id}`);
    console.log(`    创建时间: ${item.created_at}`);
    console.log(`    图片URL: ${item.image_url.substring(0, 60)}...`);
  });

  console.log(`\n🚀 开始触发AI分析...\n`);

  // 2. 逐个触发分析
  let successCount = 0;
  let failCount = 0;

  for (const item of uploadedItems) {
    try {
      console.log(`⏳ 处理 ${item.id}...`);

      const response = await fetch(`${vercelUrl}/api/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          imageUrl: item.image_url
        })
      });

      if (response.ok) {
        console.log(`   ✅ 触发成功`);
        successCount++;
      } else {
        const errorText = await response.text();
        console.log(`   ❌ 触发失败: ${response.status} ${errorText}`);
        failCount++;
      }
    } catch (err: any) {
      console.log(`   ❌ 网络错误: ${err.message}`);
      failCount++;
    }

    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n📊 处理结果:`);
  console.log(`   成功: ${successCount}`);
  console.log(`   失败: ${failCount}`);

  if (successCount > 0) {
    console.log(`\n⏰ 请等待10-30秒，让AI完成分析...`);
    console.log(`然后访问: ${vercelUrl}`);
  }
}

triggerAnalysis().catch(console.error);
