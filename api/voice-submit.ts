import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: 'edge',
};

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const appUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

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

  // 健康检查
  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      status: 'ok',
      runtime: 'edge',
      endpoint: 'voice-submit'
    }), { status: 200 });
  }

  try {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const { voiceText, source = 'shortcut' } = await req.json();

    if (!voiceText || voiceText.trim() === '') {
      return new Response(JSON.stringify({ error: 'No voice text provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    console.log(`[Voice Submit] Received text: "${voiceText}"`);

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    // 插入数据库：content_type='voice', status='uploaded'
    // intent暂时不设置，由后端AI识别
    const { data: insertedData, error: dbError } = await supabase
      .from('inbox')
      .insert([{
        content_type: 'voice',
        voice_input: voiceText,
        status: 'uploaded',
        source: source,
      }])
      .select()
      .single();

    if (dbError) {
      console.error('[Voice Submit] DB Error:', dbError);
      throw dbError;
    }

    const inboxId = insertedData.id;
    console.log(`[Voice Submit] Created record ID: ${inboxId}`);

    // Fire-and-forget触发AI处理
    const processUrl = `${appUrl}/api/process-voice`;
    console.log(`[Voice Submit] Triggering async processing at ${processUrl}`);

    fetch(processUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: inboxId,
        voiceText: voiceText
      })
    }).catch(err => console.error("[Voice Submit] Async trigger failed:", err));

    // 立即返回成功
    return new Response(JSON.stringify({
      success: true,
      id: inboxId,
      message: "Voice saved. Processing in background."
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error: any) {
    console.error("[Voice Submit] Error:", error);
    return new Response(JSON.stringify({
      error: error.message || "Internal Server Error"
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
