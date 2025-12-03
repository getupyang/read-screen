# 🚀 Snapshot AI 部署指南

## 当前进度

✅ **完成的功能：**
- 前端完整体验流程（卡片展示、左滑右滑）
- Supabase数据集成
- AI分析API（Gemini 2.5 Flash）
- 图片上传和异步处理

⏳ **待部署：**
- Vercel环境变量配置
- Supabase数据库Schema设置

---

## 第一步：检查你的Supabase数据

你提到手机已经上传了两张图片。让我们先检查它们的状态：

### 1. 查看Supabase数据库

登录 [Supabase Dashboard](https://supabase.com/dashboard)：

1. 进入你的项目
2. 点击左侧 `Table Editor`
3. 选择 `inbox` 表
4. 查看数据状态

**关键字段：**
- `status`: 应该是 `uploaded` (待处理) 或 `ready` (已完成)
- `image_url`: 图片的公开URL
- `analysis_result`: AI分析的JSON结果

---

## 第二步：触发AI分析

如果你的两张图片状态还是 `uploaded`，需要手动触发分析。

### 方式1：通过前端UI（推荐）

部署后，打开PWA应用，点击 **"🔍 检查待处理图片"** 按钮。

### 方式2：直接调用API

```bash
curl -X POST https://你的域名.vercel.app/api/process \
  -H "Content-Type: application/json" \
  -d '{
    "id": "你的inbox记录ID",
    "imageUrl": "图片URL"
  }'
```

---

## 第三步：部署到Vercel

### 3.1 连接GitHub仓库

1. 登录 [Vercel](https://vercel.com)
2. 点击 "Add New Project"
3. 导入 `getupyang/read-screen` 仓库
4. 选择分支：`claude/screenshot-info-tool-0111iRPi8v8wLXZsSEFeGSBi`

### 3.2 配置环境变量

在Vercel项目设置中添加以下环境变量：

```bash
# Supabase配置
VITE_SUPABASE_URL=https://你的项目ID.supabase.co
VITE_SUPABASE_ANON_KEY=你的anon公钥

# Gemini API
GEMINI_API_KEY=你的Gemini API密钥
```

**获取方式：**
- Supabase URL/Key: Supabase Dashboard → Settings → API
- Gemini API Key: [Google AI Studio](https://aistudio.google.com/app/apikey)

### 3.3 部署

点击 "Deploy"，等待构建完成（约1-2分钟）。

---

## 第四步：测试完整流程

### 4.1 打开PWA应用

访问你的Vercel URL（例如 `https://snapshot-ai.vercel.app`）

### 4.2 预期看到的界面

**如果有已分析的卡片：**
- 显示 "今日收获 X 张卡片"
- 可以左滑删除、右滑保存
- 卡片会有漂亮的动画效果

**如果没有卡片：**
- 显示 "收件箱是空的"
- 点击 "🔍 检查待处理图片" 按钮
- 等待3-5秒后刷新页面

---

## 第五步：安装到手机主屏幕

### iOS Safari：
1. 打开Vercel URL
2. 点击底部分享按钮
3. 选择 "添加到主屏幕"
4. 确认

### Android Chrome：
1. 打开Vercel URL
2. 点击右上角菜单
3. 选择 "添加到主屏幕"

---

## 📱 配置iOS快捷指令

### 5.1 创建快捷指令

1. 打开快捷指令App
2. 点击 "+" 创建新快捷指令
3. 添加以下操作：

```
获取 [截图/文件] → 共享表单输入
调整图像大小 → 1500px宽度
Base64编码 → 图像
URL → https://你的域名.vercel.app/api/analyze
获取URL内容 → 方法：POST
  body: {"image": "[Base64编码结果]"}
显示通知 → "已保存到Snapshot AI"
```

### 5.2 分享快捷指令

在快捷指令详情页，打开 "在共享表单中显示"。

### 5.3 使用

1. 刷手机时截图
2. 点击分享按钮
3. 选择 "Snapshot AI"
4. 看到 "已保存" 通知
5. 晚上打开PWA查看分析结果

---

## 🐛 常见问题

### 问题1：前端显示 "连接失败"

**原因：** Supabase环境变量未配置

**解决：**
1. 检查Vercel环境变量是否正确
2. 确保变量名是 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`
3. 重新部署项目

### 问题2：图片一直是 `uploaded` 状态

**原因：** AI分析API未触发

**解决：**
```bash
# 手动触发
curl -X POST https://你的域名.vercel.app/api/process \
  -H "Content-Type: application/json" \
  -d '{"id": "记录ID", "imageUrl": "图片URL"}'
```

### 问题3：AI分析失败

**原因：** Gemini API Key无效或超额

**解决：**
1. 检查 [Google AI Studio](https://aistudio.google.com) 配额
2. 确认API Key是否正确
3. 查看Vercel函数日志（Functions → Logs）

---

## 📊 查看系统状态

### 本地检查inbox数据

```bash
# 需要先配置环境变量
export VITE_SUPABASE_URL="你的URL"
export VITE_SUPABASE_ANON_KEY="你的Key"

# 运行检查脚本
npm run check-inbox
```

---

## 🎉 下一步

一旦基础流程跑通，我们就可以开始：

1. **优化AI Prompt** - 提升卡片质量
2. **添加Few-Shot示例** - 让AI输出更符合"增量价值"原则
3. **本地知识库** - 保存右滑的卡片
4. **音频播放（TTS）** - 实现"Daily Podcast"功能

---

**需要帮助？** 让我知道你在哪一步遇到了问题！
