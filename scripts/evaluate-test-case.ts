#!/usr/bin/env node
/**
 * 评估特定测试案例
 *
 * 功能：
 * 1. 从 test-data/cases/ 读取测试案例
 * 2. 检查是否已在Supabase中分析
 * 3. 使用LLM-as-a-Judge评估
 * 4. 保存结果到 test-data/results/
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
  version: string;
  created_at: string;
  image: {
    filename: string;
    supabase_url: string;
  };
  user_context: {
    scenario: string;
    user_state: string;
    pain_points: string[];
  };
  user_needs: {
    primary: string;
    explicitly_stated: string[];
    implicitly_inferred: string[];
  };
  user_expectations: any;
  tags: string[];
  [key: string]: any;
}

async function loadTestCase(caseId: string): Promise<TestCase | null> {
  const casesDir = path.join(process.cwd(), 'test-data/cases');
  const files = fs.readdirSync(casesDir);

  for (const file of files) {
    if (!file.endsWith('.jsonl')) continue;

    const content = fs.readFileSync(path.join(casesDir, file), 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    for (const line of lines) {
      const testCase = JSON.parse(line) as TestCase;
      if (testCase.id === caseId) {
        return testCase;
      }
    }
  }

  return null;
}

async function findInboxItem(imageUrl: string): Promise<any> {
  // 尝试通过 image_url 匹配
  const { data, error } = await supabase
    .from('inbox')
    .select('*')
    .eq('image_url', imageUrl)
    .maybeSingle();

  if (data) return data;

  // 尝试通过文件名匹配（模糊匹配）
  const filename = imageUrl.split('/').pop();
  const { data: allItems } = await supabase
    .from('inbox')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (!allItems) return null;

  return allItems.find(item => item.image_url.includes(filename || ''));
}

async function evaluateWithJudge(testCase: TestCase, aiOutput: any): Promise<any> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  const evaluationPrompt = `
${JUDGE_PROMPT}

---

## 测试案例背景

**用户场景**: ${testCase.user_context.scenario}
**用户状态**: ${testCase.user_context.user_state}
**用户痛点**: ${testCase.user_context.pain_points.join(', ')}

**用户明确需求**:
${testCase.user_needs.explicitly_stated.map(n => `- ${n}`).join('\n')}

**用户隐含需求**:
${testCase.user_needs.implicitly_inferred.map(n => `- ${n}`).join('\n')}

**用户期望**:
- ${testCase.user_expectations.incremental_value}
- ${testCase.user_expectations.presentation_style}

---

## AI生成的输出

\`\`\`json
${JSON.stringify(aiOutput, null, 2)}
\`\`\`

---

请基于上述用户需求和期望，评估AI输出的质量。
`;

  try {
    const result = await model.generateContent(evaluationPrompt);
    const response = result.response.text();

    let cleanJson = response.trim();
    if (cleanJson.includes('```json')) {
      cleanJson = cleanJson.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }

    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('评估失败:', error);
    return {
      scores: { need_prediction: 0, need_fulfillment: 0, presentation: 0, total: 0 },
      analysis: { strengths: [], weaknesses: ['评估失败'] },
      verdict: '不通过',
      suggestions: []
    };
  }
}

async function evaluateCase(caseId: string): Promise<void> {
  console.log('🧪 开始评估测试案例\n');
  console.log('='.repeat(80));

  // 1. 加载测试案例
  console.log(`\n📖 加载测试案例: ${caseId}`);
  const testCase = await loadTestCase(caseId);

  if (!testCase) {
    console.error(`❌ 找不到测试案例: ${caseId}`);
    process.exit(1);
  }

  console.log(`✅ 已加载: ${testCase.image.filename}`);
  console.log(`   场景: ${testCase.user_context.scenario}`);
  console.log(`   主要需求: ${testCase.user_needs.primary}`);

  // 2. 查找Supabase中的分析结果
  console.log(`\n🔍 查找分析结果...`);
  const inboxItem = await findInboxItem(testCase.image.supabase_url);

  if (!inboxItem) {
    console.error(`❌ 在Supabase中找不到该图片的记录`);
    console.log(`   图片URL: ${testCase.image.supabase_url}`);
    console.log(`\n💡 提示: 请先上传该图片并等待分析完成`);
    process.exit(1);
  }

  console.log(`✅ 找到记录: ${inboxItem.id}`);
  console.log(`   状态: ${inboxItem.status}`);

  if (!inboxItem.analysis_result) {
    console.error(`❌ 该图片还没有分析结果`);
    console.log(`\n💡 提示: 状态为 '${inboxItem.status}'，可能需要触发分析`);
    process.exit(1);
  }

  const aiOutput = inboxItem.analysis_result;
  console.log(`✅ AI输出: ${aiOutput.cards?.length || 0} 张卡片`);

  // 3. LLM-as-a-Judge 评估
  console.log(`\n⚖️  LLM评判中...`);
  const judgeEvaluation = await evaluateWithJudge(testCase, aiOutput);

  const passed = judgeEvaluation.scores?.total >= 70;

  console.log('\n' + '='.repeat(80));
  console.log('📊 评估结果');
  console.log('='.repeat(80));

  console.log(`\n总分: ${judgeEvaluation.scores?.total || 0}/100 - ${judgeEvaluation.verdict || '未知'}`);
  console.log(`\n各维度得分:`);
  console.log(`   需求预测 (过程指标): ${judgeEvaluation.scores?.need_prediction || 0}/20`);
  console.log(`   需求满足 (结果指标): ${judgeEvaluation.scores?.need_fulfillment || 0}/50`);
  console.log(`   表现力: ${judgeEvaluation.scores?.presentation || 0}/30`);

  if (judgeEvaluation.analysis?.strengths?.length > 0) {
    console.log(`\n✅ 优点:`);
    judgeEvaluation.analysis.strengths.forEach((s: string) => console.log(`   - ${s}`));
  }

  if (judgeEvaluation.analysis?.weaknesses?.length > 0) {
    console.log(`\n❌ 问题:`);
    judgeEvaluation.analysis.weaknesses.forEach((w: string) => console.log(`   - ${w}`));
  }

  if (judgeEvaluation.suggestions?.length > 0) {
    console.log(`\n💡 改进建议:`);
    judgeEvaluation.suggestions.forEach((s: string) => console.log(`   - ${s}`));
  }

  // 4. 保存结果
  const resultDir = path.join(process.cwd(), 'test-data/results/current');
  fs.mkdirSync(resultDir, { recursive: true });

  const result = {
    test_id: `test_${Date.now()}`,
    case_id: testCase.id,
    prompt_version: 'v1.0_simplified',
    model: 'gemini-2.5-flash',
    tested_at: new Date().toISOString(),
    ai_output: aiOutput,
    llm_judge_evaluation: judgeEvaluation,
    passed,
    verdict: judgeEvaluation.verdict,
    improvement_suggestions: judgeEvaluation.suggestions
  };

  const resultPath = path.join(resultDir, `${testCase.id}_result.json`);
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));

  console.log(`\n📄 结果已保存: ${resultPath}`);

  console.log('\n' + '='.repeat(80));
  if (passed) {
    console.log('🎉 评估通过！');
  } else {
    console.log('⚠️  评估未通过，需要改进');
  }
  console.log('='.repeat(80) + '\n');
}

// 获取命令行参数
const caseId = process.argv[2] || 'case_001';
evaluateCase(caseId).catch(console.error);
