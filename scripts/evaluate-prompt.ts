#!/usr/bin/env node
/**
 * LLM-as-a-Judge 评估脚本
 *
 * 功能：
 * 1. 测试当前Prompt的效果
 * 2. 使用LLM评判输出质量
 * 3. 生成详细报告
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const geminiApiKey = process.env.GEMINI_API_KEY || '';

if (!supabaseUrl || !supabaseKey || !geminiApiKey) {
  console.error('❌ 缺少环境变量');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenerativeAI(geminiApiKey);

// LLM-as-a-Judge 评估Prompt
const JUDGE_PROMPT = `
你是一个AI输出质量评估专家。

评估标准（基于"增量价值原则"）：

## 维度1：增量价值（50分）
- 0-10分：完全复述截图内容，零增量
- 11-25分：有少量背景补充，但不深入
- 26-40分：提供了具体案例或方法论
- 41-50分：提供深度内容+可行动建议+具体案例

评估要点：
- 是否只是复述截图中已有的信息？
- 是否提供了用户不知道的新信息？
- 是否有具体的时间、地点、人物、事件？
- 是否有可验证的细节？

## 维度2：可行动性（30分）
- 0-5分：没有任何行动建议
- 6-15分：有建议但太泛泛（"可以学习一下"）
- 16-25分：有具体可执行的建议（"问自己XXX问题"）
- 26-30分：有多层次的行动路径

## 维度3：结构清晰度（20分）
- 0-5分：混乱，无法快速理解
- 6-10分：有结构但不够清晰
- 11-15分：结构清晰，易读
- 16-20分：结构完美，一目了然

## 输出格式

请按以下JSON格式输出评估结果：

\`\`\`json
{
  "scores": {
    "incremental_value": 分数 (0-50),
    "actionability": 分数 (0-30),
    "clarity": 分数 (0-20),
    "total": 总分 (0-100)
  },
  "analysis": {
    "strengths": ["优点1", "优点2"],
    "weaknesses": ["问题1", "问题2"],
    "incremental_check": "是否提供了增量价值（是/否）",
    "specific_examples": ["具体案例1", "具体案例2"] 或 [],
    "actionable_advice": ["可行动建议1"] 或 []
  },
  "verdict": "通过/不通过（及格线70分）",
  "suggestions": ["改进建议1", "改进建议2"]
}
\`\`\`
`;

interface TestCase {
  id: string;
  description: string;
  imageUrl: string;
  expectedTags?: string[];
}

interface EvaluationResult {
  testCase: TestCase;
  aiOutput: any;
  judgeEvaluation: any;
  passed: boolean;
}

async function evaluateWithJudge(testCase: TestCase, aiOutput: any): Promise<any> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  const evaluationPrompt = `
${JUDGE_PROMPT}

---

## 待评估的案例

**测试图片描述**：${testCase.description}

**AI生成的输出**：
\`\`\`json
${JSON.stringify(aiOutput, null, 2)}
\`\`\`

请按照上述标准评估这个输出的质量。
`;

  try {
    const result = await model.generateContent(evaluationPrompt);
    const response = result.response.text();

    // 清理markdown代码块
    let cleanJson = response.trim();
    if (cleanJson.includes('```json')) {
      cleanJson = cleanJson.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }

    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('评估失败:', error);
    return {
      scores: { total: 0 },
      analysis: { strengths: [], weaknesses: ['评估失败'] },
      verdict: '不通过',
      suggestions: []
    };
  }
}

async function getTestCases(): Promise<TestCase[]> {
  // 从Supabase获取最近上传的图片作为测试案例
  const { data, error } = await supabase
    .from('inbox')
    .select('id, image_url, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error || !data) {
    console.log('⚠️  从Supabase获取测试案例失败，使用示例数据');
    return [];
  }

  return data.map((item, index) => ({
    id: item.id,
    description: `测试案例 ${index + 1} (${item.created_at})`,
    imageUrl: item.image_url
  }));
}

async function runEvaluation(): Promise<void> {
  console.log('🧪 开始自动化测试与评估\n');
  console.log('=' .repeat(80));

  const testCases = await getTestCases();

  if (testCases.length === 0) {
    console.log('❌ 没有找到测试案例');
    return;
  }

  console.log(`\n找到 ${testCases.length} 个测试案例\n`);

  const results: EvaluationResult[] = [];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n[${ i + 1}/${testCases.length}] 测试: ${testCase.description}`);
    console.log('-'.repeat(80));

    // 1. 获取AI输出
    console.log('⏳ 获取AI分析结果...');

    const { data: inboxItem } = await supabase
      .from('inbox')
      .select('analysis_result')
      .eq('id', testCase.id)
      .single();

    if (!inboxItem?.analysis_result) {
      console.log('❌ 该图片还没有分析结果，跳过');
      continue;
    }

    const aiOutput = inboxItem.analysis_result;
    console.log(`✅ AI输出: ${aiOutput.cards?.length || 0} 张卡片`);

    // 2. LLM评判
    console.log('⏳ LLM评判中...');
    const judgeEvaluation = await evaluateWithJudge(testCase, aiOutput);

    const passed = judgeEvaluation.scores?.total >= 70;
    console.log(`\n📊 评分: ${judgeEvaluation.scores?.total || 0}/100 - ${judgeEvaluation.verdict || '未知'}`);
    console.log(`   增量价值: ${judgeEvaluation.scores?.incremental_value || 0}/50`);
    console.log(`   可行动性: ${judgeEvaluation.scores?.actionability || 0}/30`);
    console.log(`   结构清晰: ${judgeEvaluation.scores?.clarity || 0}/20`);

    if (judgeEvaluation.analysis?.strengths?.length > 0) {
      console.log(`\n✅ 优点:`);
      judgeEvaluation.analysis.strengths.forEach((s: string) => console.log(`   - ${s}`));
    }

    if (judgeEvaluation.analysis?.weaknesses?.length > 0) {
      console.log(`\n❌ 问题:`);
      judgeEvaluation.analysis.weaknesses.forEach((w: string) => console.log(`   - ${w}`));
    }

    results.push({
      testCase,
      aiOutput,
      judgeEvaluation,
      passed
    });

    // 避免API限流
    if (i < testCases.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // 3. 生成总结报告
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 测试总结报告');
  console.log('='.repeat(80));

  const passedCount = results.filter(r => r.passed).length;
  const avgScore = results.reduce((sum, r) => sum + (r.judgeEvaluation.scores?.total || 0), 0) / results.length;

  console.log(`\n总测试数: ${results.length}`);
  console.log(`通过数: ${passedCount} (${(passedCount / results.length * 100).toFixed(1)}%)`);
  console.log(`平均分: ${avgScore.toFixed(1)}/100`);

  // 收集所有建议
  const allSuggestions = new Set<string>();
  results.forEach(r => {
    r.judgeEvaluation.suggestions?.forEach((s: string) => allSuggestions.add(s));
  });

  if (allSuggestions.size > 0) {
    console.log(`\n💡 改进建议:`);
    Array.from(allSuggestions).forEach(s => console.log(`   - ${s}`));
  }

  // 保存详细报告
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed: passedCount,
      passRate: passedCount / results.length,
      avgScore: avgScore
    },
    results: results.map(r => ({
      testCase: r.testCase.description,
      score: r.judgeEvaluation.scores?.total || 0,
      verdict: r.judgeEvaluation.verdict,
      analysis: r.judgeEvaluation.analysis,
      suggestions: r.judgeEvaluation.suggestions
    }))
  };

  const reportPath = path.join(process.cwd(), 'evaluation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 详细报告已保存: ${reportPath}`);
}

runEvaluation().catch(console.error);
