import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: 'edge',
};

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req: Request) {
  // CORS处理
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    // 解析查询参数
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || 'ready';
    const limit = parseInt(url.searchParams.get('limit') || '50');

    console.log(`[Movies API] Fetching movies with status=${status}, limit=${limit}`);

    // 查询电影记录
    const { data, error } = await supabase
      .from('inbox')
      .select('*')
      .eq('content_type', 'voice')
      .eq('intent', 'movie')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Movies API] Query error:', error);
      throw error;
    }

    console.log(`[Movies API] Found ${data?.length || 0} movies`);

    return new Response(JSON.stringify({
      success: true,
      count: data?.length || 0,
      movies: data || []
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error: any) {
    console.error("[Movies API] Error:", error);
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
