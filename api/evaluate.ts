/**
 * 评测专用 API
 * 特点：
 * 1. 不存储到 Supabase
 * 2. 支持策略版本选择
 * 3. 直接返回分析结果
 * 4. 用于 prompt 迭代和评测
 */

import { GoogleGenAI, Schema, Type } from "@google/genai";
import { getStrategy, DEFAULT_STRATEGY_ID } from "../config/strategies";

export const config = {
  runtime: 'edge',
  maxDuration: 30,
};

const geminiApiKey = process.env.GEMINI_API_KEY;

// 定义 AI 输出的严格 JSON 格式
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
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { imageUrl, strategyId = DEFAULT_STRATEGY_ID } = await req.json();

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "Missing imageUrl" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Evaluate] Strategy: ${strategyId}, Image: ${imageUrl}`);

    if (!geminiApiKey) {
      throw new Error("Missing GEMINI_API_KEY");
    }

    // 获取策略配置
    const strategy = getStrategy(strategyId);
    console.log(`[Evaluate] Using strategy: ${strategy.name}`);

    // 初始化 AI
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    // 获取图片
    const imageResp = await fetch(imageUrl);
    if (!imageResp.ok) {
      throw new Error(`Failed to fetch image: ${imageResp.statusText}`);
    }

    const imageBlob = await imageResp.blob();
    const arrayBuffer = await imageBlob.arrayBuffer();
    const base64Image = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // 构建 API 调用配置
    const requestConfig: any = {
      model: strategy.model,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: strategy.prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    };

    // 如果策略需要 Google Search，添加 tools
    if (strategy.useGoogleSearch) {
      requestConfig.tools = [{ googleSearch: {} }];
      console.log('[Evaluate] Google Search enabled');
    }

    console.log(`[Evaluate] Calling Gemini API with config:`, JSON.stringify({
      model: strategy.model,
      useGoogleSearch: strategy.useGoogleSearch,
      promptLength: strategy.prompt.length
    }));

    const startTime = Date.now();
    const response = await ai.models.generateContent(requestConfig);
    const duration = Date.now() - startTime;

    console.log(`[Evaluate] Raw response:`, JSON.stringify({
      hasText: !!response.text,
      textLength: response.text?.length,
      hasGroundingMetadata: !!(response as any).groundingMetadata,
      duration
    }));

    // 检查是否有 grounding metadata
    if ((response as any).groundingMetadata) {
      console.log('[Evaluate] Grounding metadata:', JSON.stringify((response as any).groundingMetadata));
    } else {
      console.log('[Evaluate] WARNING: No grounding metadata found - search may not have been used');
    }

    let resultJson = response.text || "{}";
    console.log("[Evaluate] AI Response received");

    // 清洗 JSON
    if (resultJson.includes("```")) {
      resultJson = resultJson.replace(/```json/g, "").replace(/```/g, "");
    }

    const result = JSON.parse(resultJson);

    // 返回结果，包含策略信息
    return new Response(JSON.stringify({
      success: true,
      strategy: {
        id: strategy.id,
        name: strategy.name,
        description: strategy.description,
        model: strategy.model,
        useGoogleSearch: strategy.useGoogleSearch
      },
      result: result,
      metadata: {
        duration,
        timestamp: new Date().toISOString()
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("[Evaluate Error]", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
