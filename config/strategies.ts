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

  // 未来版本（预留）
  // 'v2-with-search': {
  //   id: 'v2-with-search',
  //   name: 'v2.0 with Google Search',
  //   description: '增强版本：多步骤prompt + Google搜索',
  //   model: 'gemini-2.5-flash',
  //   useGoogleSearch: true,
  //   prompt: `详细的多步骤prompt...`
  // }
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
