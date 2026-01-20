# 语音电影功能 - 配置和使用指南

> 版本: v0.2.0
> 功能: 语音输入 → AI识别电影 → TMDB获取详情 → 前端展示

---

## 📋 功能概述

用户通过iPhone控制中心快捷按钮，**直接语音说出电影名称**，系统自动：
1. 识别用户意图（本期MVP：电影）
2. 提取电影名称
3. 调用TMDB API获取电影详情
4. 可选补充豆瓣评分
5. 前端展示电影卡片

---

## 🛠️ 后端配置步骤

### 1. 数据库迁移

在Supabase SQL Editor中执行：

```sql
-- 运行文件: supabase/migrations/20260120_add_voice_movie_fields.sql

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
```

### 2. 注册TMDB API

1. 访问：https://www.themoviedb.org/signup
2. 注册账号（免费）
3. 登录后访问：https://www.themoviedb.org/settings/api
4. 点击 "Create" → 选择 "Developer"
5. 填写表单（随便填）
6. 获取 **API Key (v3 auth)**

### 3. 配置环境变量

在Vercel项目设置中添加：

```bash
# 现有变量（保持不变）
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key

# 新增变量
TMDB_API_KEY=your_tmdb_api_key
```

---

## 📱 iOS快捷指令配置

### 快捷指令结构

创建名为 **"语音助手"** 的快捷指令：

```
1. [听写文本]
   - 显示提示：关闭
   - 停止监听：点按完成时
   - 语言：中文（简体）

2. [URL]
   - https://your-app.vercel.app/api/voice-submit

3. [获取URL的内容]
   - 方法：POST
   - 请求体：JSON
   - 字段：
     voiceText: [听写的文本]

4. [显示通知]
   - 标题："✅ 已保存"
   - 内容："稍后在App中查看"
```

### 详细配置步骤

#### 步骤1：创建快捷指令
1. 打开"快捷指令" App
2. 点击右上角 "+"
3. 点击"添加操作"

#### 步骤2：添加"听写文本"
1. 搜索 "听写"，选择 "听写文本"
2. 点击"显示更多" (···)
3. **关闭** "显示提示文本"（重要！）
4. 停止监听：选择 "点按完成时"
5. 语言：选择 "中文（简体）"

#### 步骤3：添加URL和请求
1. 搜索 "URL"，添加 "URL" 动作
2. 输入你的API地址：
   ```
   https://your-app.vercel.app/api/voice-submit
   ```

3. 搜索 "获取URL"，添加 "获取URL的内容"
4. 点击"显示更多"，配置：
   - 方法：**POST**
   - 请求体：**JSON**
5. 点击"添加新字段"：
   - 键：`voiceText`
   - 值：点击选择 **[听写的文本]**（变量）

#### 步骤4：添加通知
1. 搜索 "通知"，添加 "显示通知"
2. 标题：`✅ 已保存`
3. 内容：`稍后在App中查看`

#### 步骤5：自定义外观
1. 点击"完成"
2. 长按快捷指令 → "详细信息"
3. 修改名称：`语音助手` 或 `Snapshot`
4. 修改图标：选择 🎤 或 🎬，颜色选红色/蓝色

#### 步骤6：添加到控制中心
1. 打开"设置" App
2. 滚动到 "控制中心"
3. 点击"自定控制"（或"更多控制"）
4. 找到"快捷指令"，点击绿色 "+"
5. 返回控制中心，长按快捷指令图标
6. 选择刚创建的 "语音助手"

---

## 🔌 API接口说明

### 1. POST `/api/voice-submit`

**功能：** 接收语音转文字结果，创建记录

**请求：**
```json
{
  "voiceText": "我想看肖申克的救赎",
  "source": "shortcut"
}
```

**响应：**
```json
{
  "success": true,
  "id": 123,
  "message": "Voice saved. Processing in background."
}
```

### 2. POST `/api/process-voice`

**功能：** 后台异步处理，识别意图+获取电影信息

**流程：**
1. Gemini AI识别意图（movie/todo/article）
2. 提取电影名称
3. 调用TMDB API
4. 可选调用豆瓣API
5. 更新数据库 status='ready'

### 3. GET `/api/movies?status=ready&limit=50`

**功能：** 前端查询电影列表

**响应：**
```json
{
  "success": true,
  "count": 5,
  "movies": [
    {
      "id": "123",
      "voice_input": "我想看肖申克的救赎",
      "movie_data": {
        "title": "肖申克的救赎",
        "year": "1994",
        "poster": "https://...",
        "tmdbRating": 8.7,
        "doubanRating": 9.3
      },
      "created_at": "2026-01-20T10:30:00Z"
    }
  ]
}
```

---

## 🧪 测试流程

### 1. 本地测试API

```bash
# 测试语音提交接口
curl -X POST https://your-app.vercel.app/api/voice-submit \
  -H "Content-Type: application/json" \
  -d '{"voiceText": "我想看肖申克的救赎"}'

# 测试电影查询接口
curl https://your-app.vercel.app/api/movies?status=ready
```

### 2. 端到端测试

1. 下拉iPhone控制中心
2. 点击 🎤 语音助手按钮
3. 说话："我想看肖申克的救赎"
4. 点击"完成"
5. 看到通知："✅ 已保存"
6. 等待3-5秒（后台处理）
7. 打开PWA网页，切换到"电影" Tab
8. 查看电影卡片是否显示

### 3. 排查问题

**如果电影没有显示：**

1. 检查Vercel日志：
   ```bash
   vercel logs --follow
   ```

2. 检查数据库：
   ```sql
   SELECT * FROM inbox
   WHERE content_type='voice'
   ORDER BY created_at DESC LIMIT 5;
   ```

3. 检查status：
   - `uploaded`: 还在处理中，等待
   - `ready`: 处理完成，应该显示
   - `error`: 处理失败，查看日志

---

## 🎯 未来扩展

当前MVP只支持电影意图。未来可以扩展：

- `intent: 'todo'` - 语音创建待办事项
- `intent: 'article'` - 语音保存文章链接
- `intent: 'podcast'` - 播客推荐

只需在 `api/process-voice.ts` 中添加对应的处理逻辑即可。

---

## 📊 数据模型

```typescript
inbox 表:
├─ content_type: 'screenshot' | 'voice'  // 输入方式
├─ intent: 'knowledge_card' | 'movie' | 'article' | 'todo'  // 用户意图
├─ voice_input: string  // 语音原文
├─ movie_data: {
│    tmdbId: number
│    title: string
│    year: string
│    poster: string
│    tmdbRating: number
│    doubanRating: number
│  }
└─ status: 'uploaded' | 'ready' | 'error'
```

---

## 🚀 部署检查清单

- [ ] 数据库迁移已执行
- [ ] TMDB API Key已配置到Vercel
- [ ] GEMINI API Key已配置
- [ ] 代码已推送到分支
- [ ] Vercel自动部署成功
- [ ] iOS快捷指令已创建
- [ ] 快捷指令已添加到控制中心
- [ ] 端到端测试通过

---

## 💡 提示

- 语音识别准确率取决于iOS系统
- 建议在安静环境下使用
- 说话清晰，速度适中
- 电影名可以说中文或英文
- TMDB中文数据库较全，大部分电影都能找到
