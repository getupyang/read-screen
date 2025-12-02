import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";

// 环境变量检查
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

// 使用 Vercel 标准 Node.js 签名
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. 健康检查 (GET 请求) - 用于浏览器直接访问测试
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'ok', 
      message: 'Snapshot AI API is running', 
      time: new Date().toISOString() 
    });
  }

  // 2. 仅允许 POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log("📨 [Start] Received POST request");

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ [Config Error] Missing Supabase Env Vars");
    return res.status(500).json({ error: 'Server configuration error: Missing vars' });
  }

  try {
    // 3. Vercel 会自动解析 JSON body 到 req.body
    const body = req.body;
    
    // 容错：有些客户端可能发送纯字符串
    const payload = typeof body === 'string' ? JSON.parse(body) : body;
    const { image, source = 'shortcut' } = payload;

    if (!image) {
      console.error("❌ [Data Error] No image provided in body");
      return res.status(400).json({ error: 'No image provided' });
    }

    console.log(`📦 [Data] Image received. Length: ${image.length} chars`);

    // 4. 初始化 Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 5. 上传逻辑
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    
    // 使用 node:buffer 进行解码，比 atob 更稳健
    const fileBuffer = Buffer.from(image, 'base64');
    
    console.log(`🚀 [Upload] Start uploading to 'screenshots/${fileName}'...`);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('screenshots')
      .upload(fileName, fileBuffer, { 
        contentType: 'image/jpeg',
        upsert: false
      });

    if (uploadError) {
      console.error('❌ [Upload Failed]:', uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }
    
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/screenshots/${fileName}`;
    console.log("✅ [Upload Success]:", publicUrl);

    // 6. 写入数据库
    console.log("💾 [DB] Saving metadata...");
    
    const mockAnalysis = {
      meta: { type: "TEST_UPLOAD", confidence: 100, source_hint: "Vercel Node Runtime" },
      card: {
        title: "上传成功 (API v2)",
        tag: "System",
        read_time: "0 min",
        sections: [{ type: "highlight", content: "图片已成功解码并存储，等待 AI 分析..." }]
      }
    };

    const { error: dbError } = await supabase
      .from('inbox')
      .insert([{
        image_url: publicUrl,
        status: 'uploaded',
        analysis_result: mockAnalysis,
        source: source
      }]);

    if (dbError) {
      console.error('❌ [DB Error]:', dbError);
      throw dbError;
    }

    console.log("✅ [DB Success] All done.");
    
    // 7. 返回成功
    return res.status(200).json({ 
      success: true, 
      message: "Image uploaded successfully", 
      url: publicUrl 
    });

  } catch (error: any) {
    console.error('❌ [Global Error]:', error);
    return res.status(500).json({ 
      error: error.message || "Unknown server error",
      details: error.toString() 
    });
  }
}