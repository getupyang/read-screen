import { createClient } from "@supabase/supabase-js";
import { Buffer } from "buffer";

// Force update: v0.1.8 - Fix Node.js Base64 decoding
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req: Request) {
  // 1. 基础检查
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  console.log("📨 [Start] Received POST request");

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ [Config Error] Missing Supabase Env Vars");
    return new Response(JSON.stringify({ error: 'Server configuration error: Missing vars' }), { status: 500 });
  }

  try {
    // 2. 解析请求
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error("❌ [Parse Error] Invalid JSON body");
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
    }
    
    const { image, source = 'shortcut' } = body;

    if (!image) {
      console.error("❌ [Data Error] No image provided");
      return new Response(JSON.stringify({ error: 'No image provided' }), { status: 400 });
    }

    console.log(`📦 [Data] Image received. Length: ${image.length} chars`);

    // 3. 上传图片 (使用 Node.js Buffer，更稳定)
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    
    // 关键修改：使用 Buffer.from 替代 atob
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
    console.log("✅ [Upload Success]:", fileName);

    // 构造 URL
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/screenshots/${fileName}`;

    // 4. 存入数据库
    console.log("💾 [DB] Saving metadata...");
    
    const mockAnalysis = {
      meta: { type: "TEST_UPLOAD", confidence: 100, source_hint: "NodeJS Buffer Fix" },
      card: {
        title: "上传成功 (v0.1.8)",
        tag: "System",
        read_time: "0 min",
        sections: [{ type: "highlight", content: "图片已成功解码并存储" }]
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
    console.log("✅ [DB Success]");

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
    console.error('❌ [Global Error]:', error);
    return new Response(JSON.stringify({ 
      error: error.message || "Unknown server error", 
      stack: error.stack 
    }), { status: 500 });
  }
}