import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ 未检测到 Supabase 环境变量。App 将运行在演示模式。');
  console.warn('请在 Vercel 设置中配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY');
}

// 导出 supabase 客户端
// 如果没有 key，给一个空值防止 crash，但在控制台会有警告
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);