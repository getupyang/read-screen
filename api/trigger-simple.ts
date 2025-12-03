import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: 'edge',
};

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

// 自动获取当前部署的 URL
const appUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

export default async function handler(req: Request) {
  // 允许 GET 和 POST
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    console.log('[Trigger Simple] Checking for uploaded images...');

    // 1. 查找所有待处理的图片
    const { data: uploadedItems, error: queryError } = await supabase
      .from('inbox')
      .select('id, image_url')
      .eq('status', 'uploaded')
      .order('created_at', { ascending: false })
      .limit(10); // 限制最多处理10张，避免超时

    if (queryError) {
      console.error('[Trigger Simple] Query error:', queryError);
      throw queryError;
    }

    if (!uploadedItems || uploadedItems.length === 0) {
      console.log('[Trigger Simple] No uploaded images found');
      return new Response(JSON.stringify({
        success: true,
        message: 'No images to process',
        processed: 0
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    console.log(`[Trigger Simple] Found ${uploadedItems.length} images to process`);

    // 2. 触发每张图片的分析（Fire and Forget）
    const processUrl = `${appUrl}/api/process`;
    let triggered = 0;

    for (const item of uploadedItems) {
      try {
        fetch(processUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: item.id,
            imageUrl: item.image_url
          })
        }).catch(err => {
          console.error(`[Trigger Simple] Failed to trigger ${item.id}:`, err);
        });

        triggered++;
        console.log(`[Trigger Simple] Triggered analysis for ${item.id}`);
      } catch (err) {
        console.error(`[Trigger Simple] Error triggering ${item.id}:`, err);
      }
    }

    // 3. 立即返回（不等待分析完成）
    return new Response(JSON.stringify({
      success: true,
      message: `Triggered analysis for ${triggered} images`,
      processed: triggered,
      note: 'Processing in background. Check back in 30 seconds.'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error: any) {
    console.error("[Trigger Simple Error]:", error);
    return new Response(JSON.stringify({
      error: error.message || "Internal Server Error",
      success: false
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
