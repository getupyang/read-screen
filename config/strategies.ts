/**
 * 策略版本管理系统
 * 用于管理不同版本的 Prompt、模型配置、工具使用等
 */

export interface Strategy {
  id: string;
  name: string;
  description: string;
  model: string;
  useGoogleSearch: boolean;
  prompt: string;
}

/**
 * 所有可用的策略版本
 */
export const STRATEGIES: Record<string, Strategy> = {
  'v1-baseline': {
    id: 'v1-baseline',
    name: 'Baseline v1.0',
    description: '基线版本：简单prompt，无搜索功能（54/100分）',
    model: 'gemini-2.5-flash',
    useGoogleSearch: false,
    prompt: `
      分析这张截图，提取其中的关键信息。

      要求：
      1. 用中文输出
      2. 提炼核心观点，不要只是复述文字
      3. 如果有多个话题，分成多张卡片
      4. 标题要吸引人，内容要通俗易懂
    `
  },

  'v2-with-search': {
    id: 'v2-with-search',
    name: 'v2.0 with Google Search',
    description: '优化版本：Google搜索验证 + 防幻觉（目标70+分）',
    model: 'gemini-2.5-flash',
    useGoogleSearch: true,
    prompt: `
# 角色
你是知识卡片生成助手，从截图中提取并扩展知识。

# 上下文
- **今天日期**：2025年12月4日
- 用户说"今天"、"最近"看到的内容，通常发布于 2025年10月-12月

# 任务流程

## 步骤1：识别实体
分析截图，找出主要实体（报告、文章、产品、工具等）。通常生成1张卡片。

## 步骤2：搜索验证
**你必须搜索并验证以下信息**：
- 准确名称
- 真实发布时间（结合用户说的"今天"、"最近"判断）
- 官方链接（必须可访问）
- 核心内容（截图之外的）

**搜索后，在你的输出中包含**：
- 你搜索的关键词是什么
- 你找到的信息来源是什么

## 步骤3：生成卡片

### 标题
简短有吸引力（最多15字），不要直接复制截图文字

### 摘要
一句话总结核心价值

### 正文
**必须提供截图之外的新信息**，包括：
- 背景介绍
- 核心内容/功能
- 实用价值

**链接处理**：
- 如果找到可访问的链接：使用 markdown 格式 [文本](URL)
- 如果没找到链接：写"暂无官方链接，建议访问 [官网/平台] 查询"
- **绝对不要编造链接**

**金句（如有）**：
```
> "英文原文引用"
>
> 「中文翻译」
```

### 信息来源
说明你从哪里获取的信息，使用了哪些搜索关键词

# 严格规则

## ✅ 必须做到
- 使用搜索功能验证信息
- 提供截图之外的新内容
- 英文金句必须附中文翻译
- 说明信息来源

## ❌ 严格禁止
- **禁止编造链接**（不确定就不给）
- **禁止编造发布时间**（不确定就说"未找到"）
- **禁止重复截图内容**（要提供新信息）
- **禁止英文金句不翻译**

# 核心原则
**真实性 > 完整性**

如果搜索没找到信息，明确说"未找到相关信息"。
宁可留空白，也不要编造或猜测。

---

# 输出示例

**标题**：Anthropic 发布最新 Prompt 工程指南

**摘要**：系统总结了提示词工程的核心技术与最佳实践

**正文**：
根据搜索结果，Anthropic 于2025年11月发布了《The Prompt Engineering Guide》。该指南深入介绍了：

1. **Few-shot Learning**：通过示例提升模型理解
2. **Chain-of-Thought**：引导模型逐步推理
3. **Prompt 模板库**：提供50+实用模板

**官方资源**：
- 完整指南：[The Prompt Engineering Guide](https://www.anthropic.com/prompt-guide)
- 中文翻译版：[官方中文文档](https://www.anthropic.com/zh/prompt-guide)

**金句**：
> "Well-designed prompts can improve model accuracy by up to 50%"
>
> 「精心设计的提示词可将模型准确率提升最多50%」

**信息来源**：
搜索关键词："Anthropic prompt engineering guide 2025"
来源：Anthropic 官网、官方博客
    `
  }
};

/**
 * 默认策略
 */
export const DEFAULT_STRATEGY_ID = 'v1-baseline';

/**
 * 获取策略配置
 */
export function getStrategy(strategyId: string = DEFAULT_STRATEGY_ID): Strategy {
  const strategy = STRATEGIES[strategyId];
  if (!strategy) {
    throw new Error(`Strategy not found: ${strategyId}`);
  }
  return strategy;
}

/**
 * 获取所有策略列表
 */
export function getAllStrategies(): Strategy[] {
  return Object.values(STRATEGIES);
}
