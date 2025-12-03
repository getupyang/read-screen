import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: 'edge',
};

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
// 自动获取当前部署的 URL，如果在本地则是 localhost
const appUrl = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'http://localhost:3000';

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok', runtime: 'edge' }), { status: 200 });
  }

  try {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const { image, source = 'shortcut' } = await req.json();

    if (!image) {
      return new Response(JSON.stringify({ error: 'No image provided' }), { status: 400 });
    }

    // 1. 处理图片
    const cleanImage = image.replace(/\s/g, ''); 
    const binaryString = atob(cleanImage);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

    // 2. 上传 Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('screenshots')
      .upload(fileName, bytes, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/screenshots/${fileName}`;

    // 3. 写入数据库 (状态: uploaded)
    const { data: insertedData, error: dbError } = await supabase
      .from('inbox')
      .insert([{
        image_url: publicUrl,
        status: 'uploaded', // 还没开始分析
        source: source,
      }])
      .select()
      .single();

    if (dbError) throw dbError;

    const inboxId = insertedData.id;

    console.log(`[Success] Image uploaded: ${fileName}. Inbox ID: ${inboxId}`);

    // 4. 关键步骤：Fire-and-Forget (异步触发分析)
    // 我们不等待这个 fetch 返回，直接给 iOS 返回成功。
    // 注意：在某些 Serverless 环境中，如果主请求结束，后台任务可能被杀。
    // 但 Vercel Edge 允许一定程度的后台执行，或者我们依赖 Gemini 的极速响应。
    // 为了保险，我们使用 fetch 但不 await 结果。
    const processUrl = `${appUrl}/api/process`;
    console.log(`[Trigger] Firing async process request to ${processUrl}...`);
    
    fetch(processUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        id: inboxId, 
        imageUrl: publicUrl 
      })
    }).catch(err => console.error("Async trigger failed:", err));

    // 5. 立即返回成功给用户
    return new Response(JSON.stringify({ 
      success: true, 
      url: publicUrl,
      message: "Saved to inbox. Processing in background."
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error: any) {
    console.error("Upload Error:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Internal Server Error" 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}