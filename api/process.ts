import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI, Schema, Type } from "@google/genai";
import { getStrategy, DEFAULT_STRATEGY_ID } from "../config/strategies";

export const config = {
  runtime: 'edge',
  maxDuration: 30, // 给 AI 留足思考时间
};

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
// 使用用户指定的 GEMINI_API_KEY
const geminiApiKey = process.env.GEMINI_API_KEY;

// 定义 AI 输出的严格 JSON 格式
// 一张图 -> 多个知识点 (items)
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
  // 仅允许 POST
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { id, imageUrl } = await req.json();

    if (!id || !imageUrl) {
      console.error("Missing id or imageUrl");
      return new Response("Missing parameters", { status: 400 });
    }

    console.log(`[Process] Starting AI analysis for ID: ${id}`);

    if (!geminiApiKey) throw new Error("Missing GEMINI_API_KEY in environment variables");

    // 1. 初始化
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    // 2. 获取图片数据
    const imageResp = await fetch(imageUrl);
    if (!imageResp.ok) throw new Error(`Failed to fetch image: ${imageResp.statusText}`);
    
    const imageBlob = await imageResp.blob();
    const arrayBuffer = await imageBlob.arrayBuffer();
    const base64Image = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // 3. 获取策略配置并调用 AI
    const strategy = getStrategy(DEFAULT_STRATEGY_ID);
    console.log(`[Process] Using strategy: ${strategy.name}`);

    // 构建 API 请求配置
    const requestConfig: any = {
      model: strategy.model,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: strategy.prompt }
        ]
      },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    };

    // 如果策略需要 Google Search，使用正确的配置
    // 参考：https://ai.google.dev/gemini-api/docs/google-search
    if (strategy.useGoogleSearch) {
      requestConfig.config = {
        ...requestConfig.generationConfig,
        tools: [{ googleSearch: {} }]  // 正确的配置方式
      };
      delete requestConfig.generationConfig;  // 移到 config 中
      console.log('[Process] Google Search enabled (official API format)');
    }

    const response = await ai.models.generateContent(requestConfig);

    let resultJson = response.text || "{}";
    console.log("[Process] AI Raw Response:", resultJson);

    // 清洗 JSON
    if (resultJson.includes("```")) {
      resultJson = resultJson.replace(/```json/g, "").replace(/```/g, "");
    }

    // 4. 更新数据库
    const { error: updateError } = await supabase
      .from('inbox')
      .update({
        status: 'ready',
        analysis_result: JSON.parse(resultJson)
      })
      .eq('id', id);

    if (updateError) throw updateError;

    console.log(`[Success] Processed ID: ${id}`);
    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (error: any) {
    console.error("[Process Error]", error);
    
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      try {
         const { id } = await req.clone().json();
         if (id) {
           await supabase.from('inbox').update({ status: 'error' }).eq('id', id);
         }
      } catch (e) {}
    }

    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}