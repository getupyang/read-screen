-- Snapshot AI - Supabase数据库Schema
-- 在Supabase Dashboard → SQL Editor中运行此脚本

-- 1. 创建inbox表（收件箱）
CREATE TABLE IF NOT EXISTS public.inbox (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),

    -- 图片信息
    image_url TEXT NOT NULL,

    -- 状态: uploaded(已上传待处理) | ready(分析完成) | error(失败) | saved(已保存)
    status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'ready', 'error', 'saved')),

    -- 来源: shortcut(iOS快捷指令) | web(网页上传)
    source TEXT DEFAULT 'shortcut',

    -- AI分析结果（JSON格式）
    analysis_result JSONB,

    -- 错误信息（如果分析失败）
    error_message TEXT
);

-- 2. 添加索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_inbox_status ON public.inbox(status);
CREATE INDEX IF NOT EXISTS idx_inbox_created_at ON public.inbox(created_at DESC);

-- 3. 启用Row Level Security（RLS）- 保护数据安全
ALTER TABLE public.inbox ENABLE ROW LEVEL SECURITY;

-- 4. 创建RLS策略（允许匿名读写，实际生产环境应该更严格）
CREATE POLICY "Enable read access for all users"
    ON public.inbox FOR SELECT
    USING (true);

CREATE POLICY "Enable insert for all users"
    ON public.inbox FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Enable update for all users"
    ON public.inbox FOR UPDATE
    USING (true);

CREATE POLICY "Enable delete for all users"
    ON public.inbox FOR DELETE
    USING (true);

-- 5. 创建Storage Bucket（存储图片）
-- 这个需要在Supabase Dashboard → Storage中手动创建
-- Bucket名称: screenshots
-- 设置为Public（允许公开访问）

-- 6. 创建触发器：自动更新updated_at字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inbox_updated_at
    BEFORE UPDATE ON public.inbox
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7. （可选）创建knowledge表用于保存右滑的卡片
-- 这是未来功能，暂时不需要
/*
CREATE TABLE IF NOT EXISTS public.knowledge (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    inbox_id UUID REFERENCES public.inbox(id),
    card_data JSONB NOT NULL,
    tags TEXT[],
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_knowledge_tags ON public.knowledge USING GIN(tags);
*/

-- 完成！现在你可以测试数据库了
-- 测试查询：
-- SELECT * FROM public.inbox ORDER BY created_at DESC LIMIT 10;
