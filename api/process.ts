import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI, Schema, Type } from "@google/genai";

export const config = {
  runtime: 'edge',
  maxDuration: 30, // 给 AI 留足思考时间
};

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const geminiApiKey = process.env.API_KEY; // 注意：Vercel 中通常用 API_KEY

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

    if (!geminiApiKey) throw new Error("Missing Gemini API Key");

    // 1. 初始化
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    // 2. 获取图片数据
    // 我们需要把图片转成 Base64 给 Gemini
    // 既然我们有 URL，可以 fetch 下来
    const imageResp = await fetch(imageUrl);
    const imageBlob = await imageResp.blob();
    const arrayBuffer = await imageBlob.arrayBuffer();
    const base64Image = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // 3. 调用 Gemini 2.5 Flash
    // Prompt 设计：不仅仅是 OCR，而是“增量知识提取”
    const prompt = `
      You are an expert Knowledge Curator. 
      Your goal is to extract structured knowledge from this screenshot.
      
      Rules:
      1. **Incremental Value**: Do not just transcribe the text. Explain the concepts, provide context, or give actionable advice.
      2. **Split Topics**: If the image discusses multiple distinct concepts, create separate cards for them.
      3. **Curiosity Driven**: Write for a curious user who wants to learn something new in 30 seconds.
      4. **Language**: Output strictly in CHINESE (Simplified).
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
      }
    });

    const resultJson = response.text;
    console.log("[Process] AI Response:", resultJson);

    // 4. 更新数据库
    const { error: updateError } = await supabase
      .from('inbox')
      .update({
        status: 'ready',
        analysis_result: JSON.parse(resultJson) // 直接存 JSON 对象
      })
      .eq('id', id);

    if (updateError) throw updateError;

    console.log(`[Success] Processed ID: ${id}`);
    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (error: any) {
    console.error("[Process Error]", error);
    
    // 即使失败，也更新状态以便排查
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      // 尝试从 req 解析 id，如果失败就算了
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