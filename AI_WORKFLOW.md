# 🤖 AI 工作流与 Prompt 策略

这是本项目的核心灵魂。我们将把 Python 代码中的 Prompt 逻辑升级为适应 Gemini API 的结构化配置。

## 1. 结构化输出 (JSON Schema)

Python 版本中需要手动清洗 Markdown 标记，Gemini 允许我们预定义 Schema。

```typescript
// types/card.ts

export enum CardType {
  RECOMMENDATION = 'RECOMMENDATION', // 推荐类
  CONCEPT = 'CONCEPT',               // 概念解释
  VIEWPOINT = 'VIEWPOINT',           // 观点
  TUTORIAL = 'TUTORIAL',             // 教程/方法
  UNKNOWN = 'UNKNOWN'
}

export interface Section {
  type: 'highlight' | 'explanation' | 'list' | 'quote' | 'insight' | 'example';
  title?: string;
  content: string | string[];
  emoji?: string;
}

export interface KnowledgeCard {
  meta: {
    type: CardType;
    confidence: number;
    sourceApp: string; // e.g., "小红书", "Twitter"
    originalIntent: string; // AI 推测的用户意图
  };
  display: {
    title: string;      // 吸引人的标题
    subtitle: string;   // 一句话摘要
    tags: string[];
    readTime: string;   // e.g., "2 min"
    colorTheme: string; // e.g., "blue", "orange" (根据内容情绪选择)
  };
  content: Section[];
  actionable: {
    searchQuery: string; // 推荐的搜索词
    nextStep: string;    // 建议的下一步行动
  };
}
```

## 2. System Instruction (系统提示词)

这将配置在 Gemini 的初始化中。

> **角色定义**：你是一个基于认知心理学的“知识内化助手”。你的目标不是翻译图片上的文字，而是通过“增量信息”和“结构化重组”，将碎片信息转化为用户大脑中的长期记忆。
>
> **核心任务**：
> 1.  **识别意图**：用户为什么要截这张图？（是想买？想学？还是单纯觉得好笑？）
> 2.  **提取实体**：识别图中的关键实体（人名、书名、理论、代码库）。
> 3.  **增量补充**（至关重要）：
>     *   如果是书/课：不要只给简介，要给“核心洞察”和“适合谁读”。
>     *   如果是概念：用通俗的类比解释，并给出应用场景。
>     *   如果是观点：补充反面观点或背景语境。
> 4.  **去噪**：忽略 UI 元素（状态栏、广告、无关评论）。
>
> **风格指南**：
> *   语气：像一个聪明、博学且懂你的朋友。
> *   格式：极度结构化，便于手机竖屏快速扫读。
> *   长度：控制在 300-500 字以内。

## 3. Few-Shot Examples (少样本提示)

我们将把 Python 代码中的 `prompt_examples.json` 转化为 Gemini 的 `examples` 参数，或者直接嵌入 System Prompt 中。

*   **输入**: [图片：关于“年味社会学”的讨论截图]
*   **输出**: (符合上述 JSON Schema 的数据，强调涂尔干理论和现代“集体欢腾”的缺失)

## 4. 多模态优势利用

*   **长图处理**: Gemini 2.5 Flash 支持高分辨率输入，可以直接处理长截图（滚动截屏），这是传统 OCR 容易失败的地方。
*   **UI 理解**: 如果用户截图了一个设置界面，AI 可以直接识别这是“iOS 设置”并给出操作步骤，而不需要 OCR 识别所有文字。
