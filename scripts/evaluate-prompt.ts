#!/usr/bin/env node
/**
 * LLM-as-a-Judge 评估脚本
 *
 * 功能：
 * 1. 测试当前Prompt的效果
 * 2. 使用LLM评判输出质量
 * 3. 生成详细报告
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
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
const genAI = new GoogleGenAI({ apiKey: geminiApiKey });

// LLM-as-a-Judge 评估Prompt
const JUDGE_PROMPT = `
你是一个AI输出质量评估专家。

评估标准（基于"增量价值原则"）：

## 维度1：需求预测准确性（20分）- 过程指标
评估AI是否准确理解了用户的真实需求。

- 0-5分：完全误判用户需求，答非所问
- 6-10分：理解了表面需求，但没有识别到深层需求
- 11-15分：准确识别了用户的明确需求
- 16-20分：不仅识别明确需求，还洞察到隐含需求

评估要点：
- 用户想要什么信息？（明确需求）
- 用户为什么截这张图？（隐含需求）
- AI的输出是否对准了这些需求？

## 维度2：需求满足质量（50分）- 结果指标
评估AI输出的内容是否真正满足用户需求，提供了增量价值。

- 0-10分：完全复述截图内容，零增量
- 11-25分：有少量背景补充，但不深入
- 26-40分：提供了具体案例、数据、引用等增量信息
- 41-50分：提供深度内容+具体细节+可验证信息+超出预期

评估要点：
- 是否只是复述截图中已有的信息？
- 是否提供了用户不知道的新信息？
- 是否有具体的时间、地点、人物、事件、数据？
- 是否有可验证的细节（引用、出处、链接）？
- 信息量是否充实、真实、可读？

## 维度3：表现力（30分）
评估内容呈现是否干净整洁，让用户有阅读欲望但不感到压力。

- 0-5分：混乱堆砌，无法阅读
- 6-15分：有结构但不够清晰，或过于碎片化/冗长
- 16-25分：结构清晰，干净整洁，易读
- 26-30分：完美呈现，一目了然，有阅读欲望，不过于碎片化

评估要点：
- 内容是否干净整洁？
- 是否让人有阅读的欲望？
- 是否让人感到压力或疲惫？
- 是否过于碎片化（信息太散）或过于冗长？
- 一张卡片是否能讲清楚一个完整的点？

## 输出格式

请按以下JSON格式输出评估结果：

\`\`\`json
{
  "scores": {
    "need_prediction": 分数 (0-20),
    "need_fulfillment": 分数 (0-50),
    "presentation": 分数 (0-30),
    "total": 总分 (0-100)
  },
  "analysis": {
    "strengths": ["优点1", "优点2"],
    "weaknesses": ["问题1", "问题2"],
    "need_prediction_check": "AI是否准确理解了用户需求（明确+隐含）",
    "incremental_value_check": "是否提供了截图中没有的增量信息（是/否）",
    "specific_details": ["具体案例1", "时间地点数据1"] 或 [],
    "presentation_check": "内容呈现是否干净整洁、有阅读欲望、不过于碎片化"
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
    console.log(`   需求预测: ${judgeEvaluation.scores?.need_prediction || 0}/20`);
    console.log(`   需求满足: ${judgeEvaluation.scores?.need_fulfillment || 0}/50`);
    console.log(`   表现力: ${judgeEvaluation.scores?.presentation || 0}/30`);

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
