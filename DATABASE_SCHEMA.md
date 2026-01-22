# 数据库表结构文档

> 更新时间: 2026-01-20
> 版本: v0.2.0 (语音+电影功能)

---

## 📊 inbox 表

核心数据表，存储所有用户输入的内容（截图、语音等）及其AI处理结果。

### 表结构

```sql
CREATE TABLE inbox (
  -- 基础字段
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 输入方式和意图
  content_type TEXT DEFAULT 'screenshot'
    CHECK (content_type IN ('screenshot', 'voice')),
  intent TEXT
    CHECK (intent IN ('knowledge_card', 'movie', 'article', 'todo')),

  -- 来源标识
  source TEXT DEFAULT 'shortcut',  -- 'shortcut', 'web', 'api' 等

  -- 处理状态
  status TEXT DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'ready', 'error')),

  -- 截图相关字段
  image_url TEXT,  -- Supabase Storage 公开URL
  analysis_result JSONB,  -- AI分析结果（知识卡片数据）

  -- 语音相关字段
  voice_input TEXT,  -- 语音转文字的原始内容

  -- 电影相关字段
  movie_data JSONB,  -- 电影详细信息

  -- 错误信息
  error_message TEXT
);
```

### 字段说明

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| **id** | UUID | ✅ | 主键，自动生成 |
| **created_at** | TIMESTAMP | ✅ | 创建时间，自动设置 |
| **updated_at** | TIMESTAMP | ✅ | 更新时间，自动维护 |
| **content_type** | TEXT | ✅ | 输入方式：`screenshot`=截图，`voice`=语音 |
| **intent** | TEXT | ❌ | 用户意图：`knowledge_card`=知识卡片，`movie`=电影，`article`=文章，`todo`=待办 |
| **source** | TEXT | ✅ | 来源：`shortcut`=iOS快捷指令，`web`=网页，`api`=API |
| **status** | TEXT | ✅ | 处理状态：`uploaded`=已上传待处理，`ready`=处理完成，`error`=处理失败 |
| **image_url** | TEXT | ❌ | 截图的公开URL（screenshot类型时使用） |
| **analysis_result** | JSONB | ❌ | AI分析结果（knowledge_card意图时使用） |
| **voice_input** | TEXT | ❌ | 语音原文（voice类型时使用） |
| **movie_data** | JSONB | ❌ | 电影详情（movie意图时使用） |
| **error_message** | TEXT | ❌ | 错误信息（status=error时记录原因） |

---

## 🎬 movie_data JSON 结构

当 `intent='movie'` 且 `status='ready'` 时，`movie_data` 字段包含以下结构：

```json
{
  "tmdbId": 278,
  "title": "肖申克的救赎",
  "originalTitle": "The Shawshank Redemption",
  "year": "1994",
  "releaseDate": "1994-09-23",
  "poster": "https://image.tmdb.org/t/p/w500/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg",
  "backdrop": "https://image.tmdb.org/t/p/w1280/kXfqcdQKsToO0OUXHcrrNCHDBzO.jpg",
  "overview": "两个囚犯多年来建立友谊，寻找救赎和希望...",
  "genres": ["剧情", "犯罪"],
  "runtime": 142,
  "tmdbRating": 8.7,
  "doubanRating": 9.3,
  "voteCount": 23456
}
```

### movie_data 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| **tmdbId** | Number | TMDB电影ID |
| **title** | String | 中文标题 |
| **originalTitle** | String | 原始标题（英文） |
| **year** | String | 上映年份 |
| **releaseDate** | String | 完整上映日期 (YYYY-MM-DD) |
| **poster** | String | 海报图片URL (500px宽) |
| **backdrop** | String | 背景图URL (1280px宽) |
| **overview** | String | 电影简介（中文） |
| **genres** | Array | 类型标签数组 |
| **runtime** | Number | 片长（分钟） |
| **tmdbRating** | Number | TMDB评分 (0-10) |
| **doubanRating** | Number | 豆瓣评分 (0-10)，可能为null |
| **voteCount** | Number | 评分人数 |

---

## 📝 analysis_result JSON 结构

当 `intent='knowledge_card'` 且 `status='ready'` 时，`analysis_result` 字段包含以下结构：

```json
{
  "cards": [
    {
      "type": "CONCEPT",
      "title": "React Hooks原理",
      "summary": "一句话总结...",
      "content": "详细内容，支持Markdown...",
      "tags": ["React", "Hooks", "前端"],
      "color": "#DBEAFE"
    }
  ]
}
```

---

## 🔍 索引

为优化查询性能，已创建以下索引：

```sql
-- 内容类型索引
CREATE INDEX idx_inbox_content_type ON inbox(content_type);

-- 意图索引
CREATE INDEX idx_inbox_intent ON inbox(intent);

-- 状态+意图复合索引（常用查询）
CREATE INDEX idx_inbox_status_intent ON inbox(status, intent);

-- 内容类型+意图复合索引
CREATE INDEX idx_inbox_content_intent ON inbox(content_type, intent);

-- 创建时间索引（排序用）
CREATE INDEX idx_inbox_created_at ON inbox(created_at DESC);
```

---

## 📖 常用查询示例

### 1. 查询所有已处理的电影

```sql
SELECT
  id,
  voice_input,
  movie_data,
  created_at
FROM inbox
WHERE content_type = 'voice'
  AND intent = 'movie'
  AND status = 'ready'
ORDER BY created_at DESC;
```

### 2. 查询所有截图知识卡片

```sql
SELECT
  id,
  image_url,
  analysis_result,
  created_at
FROM inbox
WHERE content_type = 'screenshot'
  AND intent = 'knowledge_card'
  AND status = 'ready'
ORDER BY created_at DESC;
```

### 3. 查询处理失败的记录

```sql
SELECT
  id,
  content_type,
  intent,
  voice_input,
  error_message,
  created_at
FROM inbox
WHERE status = 'error'
ORDER BY created_at DESC;
```

### 4. 统计各意图的数量

```sql
SELECT
  intent,
  status,
  COUNT(*) as count
FROM inbox
GROUP BY intent, status
ORDER BY intent, status;
```

### 5. 获取某个电影的详细信息

```sql
SELECT
  voice_input,
  movie_data->>'title' as title,
  movie_data->>'year' as year,
  (movie_data->>'tmdbRating')::float as rating,
  created_at
FROM inbox
WHERE id = 'your-uuid-here';
```

---

## 🔄 状态流转

### 截图场景
```
用户上传截图
    ↓
[uploaded] - 已上传到Storage，待AI分析
    ↓
AI分析中...
    ↓
[ready] - 分析完成，analysis_result已填充
    or
[error] - 分析失败，error_message记录原因
```

### 语音电影场景
```
用户语音输入
    ↓
[uploaded] - 语音转文字完成，voice_input已保存
    ↓
AI识别意图 + 查询TMDB
    ↓
[ready] - 电影信息已获取，movie_data已填充
    or
[error] - 处理失败（识别失败/未找到电影/API错误）
```

---

## 🛠️ 数据迁移记录

### 2026-01-20 - 添加语音和电影功能

执行的SQL：
```sql
-- 添加新字段
ALTER TABLE inbox
ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'screenshot'
  CHECK (content_type IN ('screenshot', 'voice')),
ADD COLUMN IF NOT EXISTS intent TEXT
  CHECK (intent IN ('knowledge_card', 'movie', 'article', 'todo')),
ADD COLUMN IF NOT EXISTS voice_input TEXT,
ADD COLUMN IF NOT EXISTS movie_data JSONB;

-- 更新现有数据
UPDATE inbox
SET content_type = 'screenshot',
    intent = 'knowledge_card'
WHERE content_type IS NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_inbox_content_type ON inbox(content_type);
CREATE INDEX IF NOT EXISTS idx_inbox_intent ON inbox(intent);
CREATE INDEX IF NOT EXISTS idx_inbox_status_intent ON inbox(status, intent);
CREATE INDEX IF NOT EXISTS idx_inbox_content_intent ON inbox(content_type, intent);
```

文件位置：`supabase/migrations/20260120_add_voice_movie_fields.sql`

---

## 💡 最佳实践

### 1. 查询优化
- 总是在 WHERE 子句中包含 `content_type` 和 `intent`，充分利用索引
- 大量数据时使用 LIMIT 限制返回行数
- 使用 `created_at DESC` 排序获取最新记录

### 2. JSONB 查询
- 使用 `->` 获取JSON对象，`->>` 获取文本值
- 示例：`movie_data->>'title'` 返回电影标题文本
- 示例：`movie_data->'tmdbRating'` 返回JSON数值，需转换：`(movie_data->>'tmdbRating')::float`

### 3. 数据清理
- 定期删除 `status='error'` 且创建时间超过30天的记录
- 考虑归档 `created_at` 超过90天的旧数据

---

## 🔮 未来扩展

当前架构支持轻松扩展新的意图类型：

1. **article（文章）**：添加 `article_data JSONB` 字段
2. **todo（待办）**：添加 `todo_data JSONB` 字段
3. **podcast（播客）**：添加 `podcast_data JSONB` 字段

只需：
1. 更新 `intent` 的 CHECK 约束
2. 添加对应的 `_data` 字段
3. 在 `api/process-voice.ts` 中添加处理逻辑

---

**维护者：** AI Assistant + getupyang
**联系方式：** 通过GitHub Issues反馈问题
