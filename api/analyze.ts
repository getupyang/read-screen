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

// 添加重试逻辑的辅助函数
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status === 400) { // 400 说明参数问题，不需要重试
        return response;
      }
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error as Error;
      console.error(`[Retry ${i}/${maxRetries}] Fetch failed:`, error);
    }

    // 指数退避：2^i * 1000ms (1s, 2s, 4s)
    if (i < maxRetries) {
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Fetch failed after retries');
}

export default async function handler(req: Request, context?: { waitUntil?: (promise: Promise<any>) => void }) {
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

    // 4. 关键改进：使用 waitUntil 保证异步任务执行
    // 如果环境支持 waitUntil (Vercel Edge Runtime)，使用它来确保任务完成
    // 否则回退到fire-and-forget (但会有日志警告)
    const processUrl = `${appUrl}/api/process`;
    console.log(`[Trigger] Starting background process for ${processUrl}...`);

    const processTask = fetchWithRetry(processUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: inboxId,
        imageUrl: publicUrl
      })
    }, 2) // 最多重试2次
      .then(response => {
        console.log(`[Process] Background task completed with status ${response.status}`);
        return response;
      })
      .catch(async (err) => {
        console.error(`[Process Error] Failed to trigger processing for ${inboxId}:`, err);
        // 失败时标记数据库状态，方便后续恢复
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false }
          });
          await supabase
            .from('inbox')
            .update({ status: 'error', error_message: `Process trigger failed: ${err.message}` })
            .eq('id', inboxId);
        }
        throw err; // 继续抛出错误以便记录
      });

    // 使用 waitUntil 确保任务在后台执行完成
    if (context?.waitUntil) {
      context.waitUntil(processTask);
      console.log(`[Success] Task queued with waitUntil for ${inboxId}`);
    } else {
      // 降级方案：不等待（可能不可靠）
      console.warn(`[Warning] waitUntil not available, using fire-and-forget for ${inboxId}`);
      processTask.catch(() => {}); // 静默处理错误
    }

    // 5. 立即返回成功给用户
    return new Response(JSON.stringify({
      success: true,
      url: publicUrl,
      id: inboxId,
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