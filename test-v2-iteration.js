/**
 * 迭代测试脚本 - 自动测试 v2-with-search 策略
 */

const TEST_IMAGE = "https://ecctoixndgjycpounyfd.supabase.co/storage/v1/object/public/screenshots/1764815020083-24wcg.jpg";
const API_URL = "https://read-screen.vercel.app/api/evaluate";
const STRATEGY_ID = "v2-with-search";

// 真实信息（用于对比）
const GROUND_TRUTH = {
  correctUrl: "https://www.anthropic.com/research/how-ai-is-transforming-work-at-anthropic",
  correctDate: "2025年8月",
  correctTitle: "How AI Is Transforming Work at Anthropic"
};

async function testStrategy() {
  console.log("=".repeat(80));
  console.log("🧪 策略迭代测试 - v2-with-search");
  console.log("=".repeat(80));
  console.log();

  console.log("📸 测试图片:", TEST_IMAGE);
  console.log("🎯 策略ID:", STRATEGY_ID);
  console.log();

  console.log("⏳ 调用 API...");
  const startTime = Date.now();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: TEST_IMAGE,
        strategyId: STRATEGY_ID
      })
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ API 响应 (${duration}s)\n`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ API 错误:", response.status, errorText);
      return;
    }

    const data = await response.json();

    // 打印结果
    console.log("📊 策略信息:");
    console.log("  - 名称:", data.strategy.name);
    console.log("  - 模型:", data.strategy.model);
    console.log("  - 搜索:", data.strategy.useGoogleSearch ? "✅ 启用" : "❌ 禁用");
    console.log();

    console.log("🃏 生成卡片数:", data.result.cards?.length || 0);
    console.log();

    if (data.result.cards && data.result.cards.length > 0) {
      data.result.cards.forEach((card, index) => {
        console.log(`卡片 ${index + 1}:`);
        console.log(`  类型: ${card.type}`);
        console.log(`  标题: ${card.title}`);
        console.log(`  摘要: ${card.summary}`);
        console.log(`  正文:\n${card.content.split('\n').map(line => '    ' + line).join('\n')}`);
        console.log(`  标签: ${card.tags.join(', ')}`);
        console.log();
      });
    }

    // URL 验证
    console.log("🔗 URL 验证:");
    if (data.urlVerification) {
      const total = data.urlVerification.validUrls.length + data.urlVerification.invalidUrls.length;
      console.log(`  总计: ${total} 个链接`);
      console.log(`  有效: ${data.urlVerification.validUrls.length} 个 ✅`);
      console.log(`  无效: ${data.urlVerification.invalidUrls.length} 个 ❌`);

      if (data.urlVerification.validUrls.length > 0) {
        console.log("\n  有效链接:");
        data.urlVerification.validUrls.forEach(url => {
          console.log(`    ✅ ${url}`);
        });
      }

      if (data.urlVerification.invalidUrls.length > 0) {
        console.log("\n  ⚠️ 幻觉链接:");
        data.urlVerification.invalidUrls.forEach(invalid => {
          console.log(`    ❌ ${invalid.url}`);
          console.log(`       状态: ${invalid.status || invalid.error}`);
        });
      }
    }
    console.log();

    // 评分
    console.log("=".repeat(80));
    console.log("📈 自动评分");
    console.log("=".repeat(80));

    let score = 0;
    const feedback = [];

    // 1. 是否生成了卡片？(10分)
    if (data.result.cards && data.result.cards.length > 0) {
      score += 10;
      feedback.push("✅ [+10分] 成功生成卡片");
    } else {
      feedback.push("❌ [0分] 未生成卡片");
    }

    // 2. 是否包含正确的 URL？(30分)
    const contentText = JSON.stringify(data.result);
    if (contentText.includes(GROUND_TRUTH.correctUrl)) {
      score += 30;
      feedback.push("✅ [+30分] 包含正确链接");
    } else {
      feedback.push("❌ [0分] 未包含正确链接 " + GROUND_TRUTH.correctUrl);
    }

    // 3. URL 验证 - 没有幻觉链接？(20分)
    if (data.urlVerification?.allValid) {
      score += 20;
      feedback.push("✅ [+20分] 所有链接均有效");
    } else if (data.urlVerification?.invalidUrls.length > 0) {
      feedback.push(`❌ [0分] 存在 ${data.urlVerification.invalidUrls.length} 个幻觉链接`);
    }

    // 4. 是否包含正确的时间信息？(15分)
    if (contentText.includes("2025") && contentText.includes("8月")) {
      score += 15;
      feedback.push("✅ [+15分] 时间信息正确（2025年8月）");
    } else if (contentText.includes("2023")) {
      feedback.push("❌ [0分] 时间错误（AI编造了2023年而非2025年）");
    } else {
      feedback.push("⚠️ [0分] 未提及时间");
    }

    // 5. 标题质量（10分）
    if (data.result.cards?.[0]?.title) {
      const title = data.result.cards[0].title;
      if (title.length <= 15 && title.length > 0) {
        score += 10;
        feedback.push(`✅ [+10分] 标题长度合适 (${title.length}字)`);
      } else {
        feedback.push(`⚠️ [0分] 标题过长 (${title.length}字 > 15)`);
      }
    }

    // 6. 内容增量价值（15分）
    if (data.result.cards?.[0]?.content) {
      const content = data.result.cards[0].content;
      if (content.length > 100) {
        score += 15;
        feedback.push(`✅ [+15分] 内容详细 (${content.length}字)`);
      } else {
        feedback.push(`⚠️ [0分] 内容过短 (${content.length}字)`);
      }
    }

    console.log();
    feedback.forEach(f => console.log(f));
    console.log();
    console.log("=".repeat(80));
    console.log(`🎯 最终得分: ${score}/100`);
    console.log("=".repeat(80));

    // 反思
    console.log();
    console.log("💭 策略反思:");
    if (score >= 70) {
      console.log("  ✅ 达到目标分数！策略有效。");
    } else {
      console.log("  ❌ 未达到 70 分目标。需要改进：");
      if (!contentText.includes(GROUND_TRUTH.correctUrl)) {
        console.log("     - Google Search grounding 可能未生效");
        console.log("     - 需要检查 Vercel 日志确认是否有 grounding metadata");
      }
      if (data.urlVerification?.invalidUrls.length > 0) {
        console.log("     - 仍然存在幻觉链接，搜索结果未被正确使用");
      }
      if (contentText.includes("2023")) {
        console.log("     - AI 编造了错误时间，未使用真实搜索结果");
      }
    }

    console.log();
    console.log("📋 完整响应已保存到 test-v2-result.json");

    // 保存完整结果用于分析
    const fs = require('fs');
    fs.writeFileSync('test-v2-result.json', JSON.stringify(data, null, 2));

  } catch (error) {
    console.error("❌ 测试失败:", error.message);
    console.error(error);
  }
}

testStrategy();
