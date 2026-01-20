import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI, Schema, Type } from "@google/genai";

export const config = {
  runtime: 'edge',
  maxDuration: 30,
};

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;
const tmdbApiKey = process.env.TMDB_API_KEY;

// Gemini输出格式：识别意图和提取电影名
const intentResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      description: "用户意图类型",
      enum: ["movie", "todo", "article", "unknown"]
    },
    movieName: {
      type: Type.STRING,
      description: "如果是电影意图，提取的电影名称（中文或英文）"
    },
    confidence: {
      type: Type.NUMBER,
      description: "识别置信度 0-1"
    }
  }
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { id, voiceText } = await req.json();

    if (!id || !voiceText) {
      console.error("[Process Voice] Missing id or voiceText");
      return new Response("Missing parameters", { status: 400 });
    }

    console.log(`[Process Voice] Starting processing for ID: ${id}, text: "${voiceText}"`);

    if (!geminiApiKey) {
      throw new Error("Missing GEMINI_API_KEY");
    }

    const supabase = createClient(supabaseUrl!, supabaseKey!);

    // 步骤1: 用Gemini识别意图和提取电影名
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const intentPrompt = `
你是一个智能助手，负责理解用户的语音输入意图。

用户说："${voiceText}"

请分析用户的意图：
- 如果用户提到想看某个电影、电影名称、演员等，意图是"movie"
- 如果用户提到要做某事、待办事项，意图是"todo"
- 如果用户提到文章、阅读、保存链接，意图是"article"
- 否则是"unknown"

如果是电影意图，请提取电影名称（保持原语言，中文或英文）。

返回JSON格式。
    `.trim();

    const intentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ text: intentPrompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: intentResponseSchema,
      }
    });

    let intentJson = intentResponse.text || "{}";
    if (intentJson.includes("```")) {
      intentJson = intentJson.replace(/```json/g, "").replace(/```/g, "");
    }

    const intentData = JSON.parse(intentJson);
    console.log(`[Process Voice] Intent detected:`, intentData);

    // 步骤2: 本期MVP只处理电影意图
    if (intentData.intent !== 'movie' || !intentData.movieName) {
      // 非电影意图，暂时标记为error（未来可以扩展）
      await supabase
        .from('inbox')
        .update({
          status: 'error',
          intent: intentData.intent || 'unknown'
        })
        .eq('id', id);

      console.log(`[Process Voice] Non-movie intent: ${intentData.intent}`);
      return new Response(JSON.stringify({
        success: false,
        message: `Intent "${intentData.intent}" not supported yet`
      }), { status: 200 });
    }

    // 步骤3: 调用TMDB API搜索电影
    const movieName = intentData.movieName;
    console.log(`[Process Voice] Searching movie: ${movieName}`);

    if (!tmdbApiKey) {
      throw new Error("Missing TMDB_API_KEY");
    }

    const tmdbSearchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(movieName)}&language=zh-CN`;
    const tmdbResponse = await fetch(tmdbSearchUrl);

    if (!tmdbResponse.ok) {
      throw new Error(`TMDB API failed: ${tmdbResponse.statusText}`);
    }

    const tmdbData = await tmdbResponse.json();
    console.log(`[Process Voice] TMDB results:`, tmdbData.results?.length || 0, 'movies found');

    if (!tmdbData.results || tmdbData.results.length === 0) {
      // 没找到电影
      await supabase
        .from('inbox')
        .update({
          status: 'error',
          intent: 'movie'
        })
        .eq('id', id);

      console.log(`[Process Voice] No movie found for: ${movieName}`);
      return new Response(JSON.stringify({
        success: false,
        message: 'Movie not found'
      }), { status: 200 });
    }

    // 取第一个结果
    const movie = tmdbData.results[0];

    // 步骤4: 获取电影详情（包含更多信息）
    const movieId = movie.id;
    const detailUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${tmdbApiKey}&language=zh-CN`;
    const detailResponse = await fetch(detailUrl);
    const movieDetail = await detailResponse.json();

    // 步骤5: （可选）尝试获取豆瓣评分
    let doubanRating = null;
    try {
      // 使用非官方豆瓣API（可能不稳定）
      const doubanSearchUrl = `https://douban.uieee.com/v2/movie/search?q=${encodeURIComponent(movieName)}`;
      const doubanResponse = await fetch(doubanSearchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });

      if (doubanResponse.ok) {
        const doubanData = await doubanResponse.json();
        if (doubanData.subjects && doubanData.subjects.length > 0) {
          doubanRating = doubanData.subjects[0].rating?.average || null;
          console.log(`[Process Voice] Douban rating: ${doubanRating}`);
        }
      }
    } catch (err) {
      console.log(`[Process Voice] Douban API failed (non-critical):`, err);
    }

    // 步骤6: 构建movie_data
    const movieData = {
      tmdbId: movieDetail.id,
      title: movieDetail.title || movie.title,
      originalTitle: movieDetail.original_title,
      year: movieDetail.release_date ? movieDetail.release_date.split('-')[0] : 'N/A',
      releaseDate: movieDetail.release_date,
      poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
      backdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
      overview: movieDetail.overview || movie.overview,
      genres: movieDetail.genres?.map((g: any) => g.name) || [],
      runtime: movieDetail.runtime || null,
      tmdbRating: movie.vote_average || null,
      doubanRating: doubanRating,
      voteCount: movie.vote_count || 0,
    };

    console.log(`[Process Voice] Movie data prepared:`, movieData.title);

    // 步骤7: 更新数据库
    const { error: updateError } = await supabase
      .from('inbox')
      .update({
        status: 'ready',
        intent: 'movie',
        movie_data: movieData
      })
      .eq('id', id);

    if (updateError) throw updateError;

    console.log(`[Process Voice] ✅ Success! Record ${id} ready`);
    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (error: any) {
    console.error("[Process Voice] Error:", error);

    // 尝试更新状态为error
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      try {
        const { id } = await req.clone().json();
        if (id) {
          await supabase.from('inbox').update({ status: 'error' }).eq('id', id);
        }
      } catch (e) {
        console.error("[Process Voice] Failed to update error status:", e);
      }
    }

    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
