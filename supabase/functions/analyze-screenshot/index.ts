import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. 处理 CORS 预检请求 (浏览器安全策略)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. 解析请求体
    const { image_url, image_base64 } = await req.json()

    // 暂时打印一下，证明我们收到了请求
    console.log("📸 收到分析请求")
    
    if (!image_url && !image_base64) {
      throw new Error("No image data provided")
    }

    // ---------------------------------------------------------
    // TODO: Phase 2 - 在这里调用 Google Gemini API
    // ---------------------------------------------------------
    
    // 模拟 AI 处理的延迟
    // await new Promise(resolve => setTimeout(resolve, 1000));

    const mockResponse = {
      message: "Snapshot analysis started successfully",
      status: "processing",
      timestamp: new Date().toISOString()
    }

    // 3. 返回成功响应
    return new Response(
      JSON.stringify(mockResponse),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error("❌ Error:", error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})