import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

// Force deployment update: v0.1.4
// 初始化 Supabase 客户端 (服务端使用)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const geminiKey = process.env.GEMINI_API_KEY;

export const config = {
  runtime: 'edge', // 使用 Edge Runtime 以获得更快的启动速度
};

export default async function handler(req: Request) {
  // 1. 基础检查
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  if (!supabaseUrl || !supabaseKey || !geminiKey) {
    return new Response(JSON.stringify({ error: 'Server misconfiguration: Missing environment variables' }), { status: 500 });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    // 2. 解析请求体 (预期接收 { image: "base64 string...", source: "shortcut" })
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
    }
    
    const { image, source = 'shortcut' } = body;

    if (!image) {
      return new Response(JSON.stringify({ error: 'No image provided' }), { status: 400 });
    }

    // 3. 上传原始图片到 Supabase Storage (归档用)
    // 生成一个随机文件名
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    // 将 base64 转为 buffer (Edge Runtime 处理方式)
    const binaryStr = atob(image);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    
    const { error: uploadError } = await supabase.storage
      .from('screenshots')
      .upload(fileName, bytes, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload Error:', uploadError);
      // 上传失败不阻断流程，继续分析，但记录错误
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/screenshots/${fileName}`;

    // 4. 调用 Gemini 进行分析
    const prompt = `
你是一个"碎片知识提炼专家"。用户截图了这个内容，想稍后消化。
请分析这张图片，提取核心价值，并输出为严格的 JSON 格式。

要求：
1. **识别意图**：是推荐资源、概念解释、还是观点？
2. **增量信息**：不要只做 OCR，要补充背景知识、作者介绍或相关评分。
3. **去噪**：忽略 UI 元素。

请直接返回以下 JSON 结构，不要 Markdown 标记：
{
  "meta": { "type": "推荐/概念/观点", "confidence": 90 },
  "card": {
    "title": "吸引人的标题(15字内)",
    "tag": "关键词",
    "read_time": "1分钟",
    "sections": [
      { "type": "highlight", "content": "核心的一句话结论" },
      { "type": "explanation", "title": "小标题", "content": "详细解释" }
    ],
    "supplement": { "background": "补充背景知识" }
  }
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'image/jpeg', data: image } }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const analysisResult = JSON.parse(response.text || '{}');

    // 5. 将结果存入 Supabase Database
    const { data: insertData, error: dbError } = await supabase
      .from('inbox')
      .insert([
        {
          image_url: publicUrl,
          status: 'ready',
          analysis_result: analysisResult,
          source: source
        }
      ])
      .select();

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    // 6. 返回成功
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Analysis complete',
      data: insertData 
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Processing Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Unknown error' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}