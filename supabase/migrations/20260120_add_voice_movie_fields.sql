-- 添加语音输入和电影功能所需的字段
-- 日期: 2026-01-20

-- 1. 添加新字段
ALTER TABLE inbox
ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'screenshot'
  CHECK (content_type IN ('screenshot', 'voice')),
ADD COLUMN IF NOT EXISTS intent TEXT
  CHECK (intent IN ('knowledge_card', 'movie', 'article', 'todo')),
ADD COLUMN IF NOT EXISTS voice_input TEXT,
ADD COLUMN IF NOT EXISTS movie_data JSONB;

-- 2. 为现有数据打补丁
UPDATE inbox
SET content_type = 'screenshot',
    intent = 'knowledge_card'
WHERE content_type IS NULL;

-- 3. 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_inbox_content_type ON inbox(content_type);
CREATE INDEX IF NOT EXISTS idx_inbox_intent ON inbox(intent);
CREATE INDEX IF NOT EXISTS idx_inbox_status_intent ON inbox(status, intent);
CREATE INDEX IF NOT EXISTS idx_inbox_content_intent ON inbox(content_type, intent);

-- 4. 添加注释
COMMENT ON COLUMN inbox.content_type IS '输入方式: screenshot=截图, voice=语音';
COMMENT ON COLUMN inbox.intent IS '用户意图: knowledge_card=知识卡片, movie=电影, article=文章, todo=待办';
COMMENT ON COLUMN inbox.voice_input IS '语音转换的文本内容';
COMMENT ON COLUMN inbox.movie_data IS '电影详细信息(JSON格式): {title, year, poster, rating, summary, etc.}';
