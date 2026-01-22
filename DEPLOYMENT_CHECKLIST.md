# 🚀 部署配置清单

## ✅ 第1步：Vercel环境变量配置（5分钟）

1. 访问 Vercel Dashboard：https://vercel.com
2. 进入你的项目 **read-screen**
3. 点击 **Settings** → **Environment Variables**
4. 添加以下变量（如果已存在则跳过）：

```bash
# 已有的变量（保持不变）
VITE_SUPABASE_URL = 你的Supabase URL
VITE_SUPABASE_ANON_KEY = 你的Supabase匿名密钥
GEMINI_API_KEY = 你的Gemini API密钥

# 新增变量 ⚡
TMDB_API_KEY = 37f44bfa04b52dad799f6fa09ecc326d
```

5. **重要**：每个变量都要勾选 **Production**, **Preview**, **Development** 三个环境
6. 点击 **Save**

---

## ✅ 第2步：Supabase数据库迁移（3分钟）

1. 访问 Supabase Dashboard
2. 进入你的项目
3. 左侧菜单 → **SQL Editor**
4. 点击 **New query**
5. 复制粘贴以下SQL并执行：

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

6. 点击 **Run**
7. 确认显示 "Success. No rows returned"

---

## ✅ 第3步：触发Vercel重新部署（1分钟）

因为添加了新的环境变量，需要重新部署：

**方法1：在Vercel Dashboard操作**
1. 进入 Vercel 项目页面
2. 点击 **Deployments** 标签
3. 找到最新的部署（分支：claude/voice-movie-feature-M1OlG）
4. 点击右侧的 **...** → **Redeploy**

**方法2：推送一个空提交（更简单）**
```bash
git commit --allow-empty -m "chore: trigger redeploy with TMDB_API_KEY"
git push
```

等待2-3分钟，部署完成后记下你的URL：
```
https://你的项目名.vercel.app
```

---

## ✅ 第4步：创建iOS快捷指令（15分钟）

### 步骤A：创建快捷指令

1. 打开iPhone **"快捷指令"** App
2. 点击右上角 **"+"**
3. 点击 **"添加操作"**

### 步骤B：添加"听写文本"

1. 搜索框输入 **"听写"**
2. 选择 **"听写文本"**
3. 点击卡片右侧的 **"显示更多"** (···)
4. **关闭** "显示提示文本" 开关 ⚠️ 重要！
5. "停止监听"：选择 **"点按完成时"**
6. "语言"：选择 **"中文（简体）"**

### 步骤C：添加URL

1. 点击底部搜索框，输入 **"URL"**
2. 选择 **"URL"** 动作
3. 在输入框填入你的API地址（替换为你的实际URL）：
   ```
   https://你的项目名.vercel.app/api/voice-submit
   ```

### 步骤D：添加"获取URL的内容"

1. 搜索 **"获取URL"**
2. 选择 **"获取 URL 的内容"**
3. 点击卡片上的 **"显示更多"** (···)
4. 配置参数：
   - **方法**：选择 **POST**
   - **请求体**：选择 **JSON**
5. 点击 **"添加新字段"**
6. 配置字段：
   - **键**：输入 `voiceText`
   - **值**：点击选择变量 **"听写的文本"**（蓝色气泡）

### 步骤E：添加通知

1. 搜索 **"通知"**
2. 选择 **"显示通知"**
3. 配置：
   - 标题：`✅ 已保存`
   - 内容：`稍后在App中查看`

### 步骤F：自定义外观

1. 点击右上角 **"完成"**
2. 长按刚创建的快捷指令
3. 选择 **"详细信息"**
4. 修改：
   - **名称**：`语音助手` 或 `Snapshot`
   - **图标**：点击图标区域 → 选择 🎤 或 🎬
   - **颜色**：红色或蓝色

---

## ✅ 第5步：添加到控制中心（2分钟）

1. 打开 **"设置"** App
2. 滚动找到 **"控制中心"**
3. 点击 **"自定控制"**（或"包含的控制"下方的"更多控制"）
4. 找到 **"快捷指令"**
5. 如果还没添加，点击绿色 **"+"** 号
6. 返回桌面，**下拉控制中心**
7. **长按** 快捷指令图标
8. 选择刚才创建的 **"语音助手"**

---

## 🧪 第6步：端到端测试（5分钟）

### 测试流程：

1. **下拉控制中心**
2. **点击 🎤 按钮**（麦克风应该自动启动，没有任何提示）
3. **说话**："我想看肖申克的救赎"
4. **点击"完成"**
5. **看到通知**："✅ 已保存"
6. **等待5-10秒**（后台AI处理）
7. **打开PWA网页**（你的Vercel URL）
8. **切换到"电影" Tab**
9. **查看电影卡片**是否显示

### 预期结果：

应该看到类似这样的卡片：

```
┌──────────────────────────────┐
│ [海报]  肖申克的救赎          │
│         The Shawshank...     │
│         1994 • 剧情          │
│         ⭐ 8.7 TMDB          │
├──────────────────────────────┤
│ 🎤 "我想看肖申克的救赎"      │
│ 1月20日                      │
├──────────────────────────────┤
│ 两个囚犯多年来建立友谊...    │
└──────────────────────────────┘
```

---

## 🐛 故障排查

### 问题1：快捷指令没反应

**检查项：**
- [ ] URL是否正确（https://你的项目名.vercel.app/api/voice-submit）
- [ ] 网络连接是否正常
- [ ] Vercel部署是否成功

**调试方法：**
在快捷指令最后添加"显示结果"动作，查看API返回的内容。

---

### 问题2：电影没显示

**检查数据库：**
```sql
SELECT
  id,
  content_type,
  intent,
  status,
  voice_input,
  created_at
FROM inbox
WHERE content_type='voice'
ORDER BY created_at DESC
LIMIT 5;
```

**status含义：**
- `uploaded` → 还在处理中，再等等
- `ready` → 应该显示了（刷新页面）
- `error` → 处理失败，查看Vercel日志

**查看Vercel日志：**
1. Vercel Dashboard → 你的项目
2. 点击 **Deployments** → 最新部署
3. 点击 **Functions** → 找到 `api/process-voice.ts`
4. 查看错误日志

---

### 问题3：TMDB API错误

**测试TMDB API：**
```bash
curl "https://api.themoviedb.org/3/search/movie?api_key=37f44bfa04b52dad799f6fa09ecc326d&query=肖申克的救赎&language=zh-CN"
```

应该返回电影数据JSON。

---

## 📊 验收标准

全部通过才算成功：

- [ ] Vercel环境变量 TMDB_API_KEY 已配置
- [ ] Supabase数据库迁移SQL已执行
- [ ] Vercel部署成功（绿色✓）
- [ ] iOS快捷指令已创建
- [ ] 控制中心可以看到🎤按钮
- [ ] 点击按钮 → 麦克风自动启动（无提示）
- [ ] 说话 → 点完成 → 看到"✅ 已保存"通知
- [ ] 5-10秒后，PWA网页电影Tab能看到卡片
- [ ] 卡片显示：海报、标题、年份、评分、语音原文

---

## 🎉 成功后的下一步

测试通过后：

1. **告诉我结果**，我会帮你合并到 `main` 分支
2. **正式发布到生产环境**
3. **开始使用**！每次想记录电影，下拉控制中心说一句话就行了

---

## 💡 提示

- 首次使用快捷指令时，iOS会请求麦克风权限，点"允许"
- 建议在安静环境测试，语音识别更准确
- 电影名可以说中文或英文，AI都能识别
- 如果识别错误，可以说更完整的名字，如"肖申克的救赎电影"

---

需要帮助？随时告诉我遇到的问题！🚀
