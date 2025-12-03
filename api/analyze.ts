import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: 'edge', // ⚡️ 启用边缘运行时：0 冷启动，极速响应
};

// 环境变量
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req: Request) {
  // 1. CORS 设置 (允许捷径跨域访问)
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  // 2. 健康检查
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ 
      status: 'ok', 
      runtime: 'edge', 
      region: req.headers.get('x-vercel-id') || 'unknown' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 3. 处理 POST 上传
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    // Edge Runtime 能够更快地处理 JSON 解析
    const { image, source = 'shortcut' } = await req.json();

    if (!image) {
      return new Response(JSON.stringify({ error: 'No image provided' }), { status: 400 });
    }

    // 4. 高效的 Base64 解码 (Web Standard)
    // 在 Edge 环境下，我们使用 atob 和 Uint8Array，比 Node Buffer 更轻量
    const binaryString = atob(image);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // 5. 并行初始化 Supabase 客户端
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false, // Edge 环境不需要持久化 Session
      }
    });

    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

    // 6. 上传到 Storage
    // 直接上传二进制数据，无需再次转换
    const { error: uploadError } = await supabase.storage
      .from('screenshots')
      .upload(fileName, bytes, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/screenshots/${fileName}`;

    // 7. 写入数据库记录
    const { error: dbError } = await supabase
      .from('inbox')
      .insert([{
        image_url: publicUrl,
        status: 'uploaded',
        source: source,
        // 先写入一个占位符，证明链路通了
        analysis_result: { 
          card: { title: "Processing...", sections: [] } 
        }
      }]);

    if (dbError) throw dbError;

    // 8. 极速返回
    return new Response(JSON.stringify({ 
      success: true, 
      url: publicUrl 
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error: any) {
    console.error("Edge Function Error:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Internal Server Error" 
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}