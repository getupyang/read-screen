import { createClient } from "@supabase/supabase-js";

// Force update: v0.1.7 - Infrastructure Test (Upload Only)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

// 移除 runtime: 'edge'，使用默认的 Node.js Serverless，超时时间更长，兼容性更好
// export const config = {
//   runtime: 'edge',
// };

export default async function handler(req: Request) {
  // 1. 基础检查
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  // 打印日志方便调试
  console.log("📨 Received POST request");

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase Env Vars");
    return new Response(JSON.stringify({ error: 'Server configuration error: Missing vars' }), { status: 500 });
  }

  try {
    // 2. 解析请求
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error("❌ JSON Parse Failed");
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
    }
    
    const { image, source = 'shortcut' } = body;

    if (!image) {
      console.error("❌ No image data in body");
      return new Response(JSON.stringify({ error: 'No image provided' }), { status: 400 });
    }

    console.log("📦 Image data received (length):", image.length);

    // 3. 上传图片到 Supabase Storage
    // 使用时间戳+随机数生成文件名
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    
    // Base64 处理: Node.js 环境下建议使用 Buffer，但也兼容标准 Web API
    // 这里我们尝试将 Base64 转为 ArrayBuffer
    const binaryStr = atob(image);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    
    console.log("🚀 Uploading to Supabase Storage...");
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('screenshots')
      .upload(fileName, bytes, { 
        contentType: 'image/jpeg',
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Storage Upload Error:', uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }
    console.log("✅ Upload success:", fileName);

    // 构造可访问的图片 URL
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/screenshots/${fileName}`;

    // ---------------------------------------------------------
    // 暂时跳过 Gemini AI 分析，先验证上传链路
    // ---------------------------------------------------------
    /*
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log("🧠 Calling Gemini...");
    const response = await ai.models.generateContent({...});
    */
    
    // 模拟一个简单的结果，证明流程通了
    const mockAnalysis = {
      meta: { type: "TEST_UPLOAD", confidence: 100, source_hint: "Test" },
      card: {
        title: "上传测试成功",
        tag: "System",
        read_time: "0 min",
        sections: [{ type: "highlight", content: "图片已安全存入 Supabase Storage" }]
      }
    };

    // 4. 存入数据库 (状态标记为 uploaded)
    console.log("💾 Saving to Database...");
    const { error: dbError } = await supabase
      .from('inbox')
      .insert([{
        image_url: publicUrl,
        status: 'uploaded', // 区别于 ready，表示还没分析
        analysis_result: mockAnalysis,
        source: source
      }]);

    if (dbError) {
      console.error('❌ DB Insert Error:', dbError);
      throw dbError;
    }
    console.log("✅ DB Insert success");

    // 5. 返回成功
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Image uploaded successfully", 
      url: publicUrl 
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Handler Global Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || "Unknown server error", 
      stack: error.stack 
    }), { status: 500 });
  }
}