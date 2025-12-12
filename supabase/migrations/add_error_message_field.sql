-- 添加 error_message 字段到 inbox 表
-- 用于存储处理失败时的错误信息

ALTER TABLE inbox
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- 添加索引以便快速查询错误记录
CREATE INDEX IF NOT EXISTS idx_inbox_status_error
ON inbox(status)
WHERE status = 'error';

-- 添加注释
COMMENT ON COLUMN inbox.error_message IS '处理失败时的错误信息';
