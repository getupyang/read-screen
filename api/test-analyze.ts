/**
 * 测试分析API - 不保存到数据库，直接返回AI分析结果
 *
 * 用于快速测试Prompt效果
 */
import { GoogleGenAI, Schema, Type } from "@google/genai";

export const config = {
  runtime: 'edge',
  maxDuration: 30,
};

const geminiApiKey = process.env.GEMINI_API_KEY;

// 复用相同的 schema
const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    cards: {
      type: Type.ARRAY,
      description: "List of knowledge cards extracted from the image. If the image contains multiple distinct topics, create multiple cards.",
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            description: "Type of the content: 'CONCEPT' (theory/definition), 'INSIGHT' (deep thought), 'TUTORIAL' (how-to), 'QUOTE' (golden sentence), or 'FACT' (data/news).",
            enum: ["CONCEPT", "INSIGHT", "TUTORIAL", "QUOTE", "FACT"]
          },
          title: {
            type: Type.STRING,
            description: "A catchy, short title (max 15 chars). Do NOT simply use the OCR text. Rephrase it to be interesting."
          },
          summary: {
            type: Type.STRING,
            description: "A one-sentence TL;DR summary."
          },
          content: {
            type: Type.STRING,
            description: "The main body content. Use simple markdown (bold, lists). Provide INCREMENTAL INFORMATION: explain concepts, give context, or provide examples that are NOT in the image."
          },
          tags: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          color: {
            type: Type.STRING,
            description: "Suggested hex color code for the card background based on emotion (e.g., #FEF3C7 for warm/insight, #DBEAFE for tech/concept)."
          }
        },
        required: ["type", "title", "summary", "content", "tags", "color"]
      }
    }
  }
};

export default async function handler(req: Request) {
  // 支持 CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "Missing imageUrl parameter" }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Test] Analyzing image: ${imageUrl}`);

    if (!geminiApiKey) throw new Error("Missing GEMINI_API_KEY");

    // 1. 初始化
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    // 2. 获取图片数据
    const imageResp = await fetch(imageUrl);
    if (!imageResp.ok) throw new Error(`Failed to fetch image: ${imageResp.statusText}`);

    const imageBlob = await imageResp.blob();
    const arrayBuffer = await imageBlob.arrayBuffer();
    const base64Image = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // 3. 调用 Gemini (使用与 process.ts 相同的 prompt)
    const prompt = `
你是一个智能知识卡片生成助手。用户截图是为了保存感兴趣的信息，但不想自己去深入查找。

## 核心原则：提供增量价值

你的价值在于：
1. 帮用户找到截图中提到的具体内容（报告、文章、产品、工具等）
2. 提供截图中**没有的**关键信息
3. 节省用户自己搜索和阅读的时间

## 工作流程

### 第1步：识别实体

识别截图中提到的具体实体，例如：
- 研究报告、论文、文章
- 产品、工具、服务
- 概念、方法论
- 人物、公司、组织

**重要**：如果截图中有多个独立的实体或主题，为每个实体创建独立的卡片。
- 例如：视频介绍了2个工具 → 生成2张卡片
- 例如：文章提到3篇论文 → 生成3张卡片

### 第2步：搜索外部信息（关键！）

对于识别出的实体，**使用搜索功能**查找：
- ✅ 准确的名称（不要猜测）
- ✅ 发布时间/版本
- ✅ 官方链接或权威来源
- ✅ 核心内容（必须是截图中没有的）
- ✅ 如果是文章/报告，提供原文引用（1-2句金句）

### 第3步：生成内容

**结构建议**（使用markdown）：

对于报告/文章类：
\`\`\`
**报告名称**: [准确名称]（如果有链接：[名称](链接)）
**发布时间**: YYYY-MM 或 具体日期

**核心发现**:
- 发现1（来自搜索到的内容，非截图）
- 发现2
- 发现3

**原文金句**:
> "报告/文章中的原话..."

**为什么重要**: 简短说明
\`\`\`

对于产品/工具类：
\`\`\`
**产品名称**: [名称]
**官网**: [链接]

**核心功能**:
- 功能1
- 功能2

**适用场景**: ...
\`\`\`

### 第4步：自检

输出前确认：
- [ ] 是否使用了搜索功能查找信息？
- [ ] 是否提供了截图中没有的新信息？
- [ ] 是否避免了重复截图中的内容？（如果截图说"50%效率"，不要再重复）
- [ ] 如果有多个实体，是否分成了独立的卡片？
- [ ] 是否有可验证的来源（链接、时间）？

## ⚠️ 禁止行为

1. ❌ **不要重复截图中已有的信息**（数字、描述、已知事实等）
2. ❌ **不要编造数据或猜测**（如果搜索不到，说"未找到相关信息"）
3. ❌ **不要混合多个独立主题**到一张卡片
4. ❌ **不要提供无法验证的信息**

## 输出要求

- 用中文输出
- 标题简洁有力（不超过15字）
- 内容通俗易懂，使用markdown格式
- 必须包含来源信息（链接、时间等）

现在，请分析这张截图并生成知识卡片：
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        tools: [{
          googleSearch: {}
        }]
      }
    });

    let resultJson = response.text || "{}";

    // 清洗 JSON
    if (resultJson.includes("```")) {
      resultJson = resultJson.replace(/```json/g, "").replace(/```/g, "");
    }

    const analysis = JSON.parse(resultJson);

    console.log(`[Test] Analysis complete: ${analysis.cards?.length || 0} cards`);

    // 直接返回分析结果
    return new Response(
      JSON.stringify(analysis, null, 2),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );

  } catch (error: any) {
    console.error("[Test Error]", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.stack
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
}
