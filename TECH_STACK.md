# 🛠️ 技术栈与架构设计

为了实现“无感采集，后台预处理，即时回顾”的极致体验，我们采用 **Serverless + Edge Computing** 架构。

## 1. 总体架构：Input -> Cloud Process -> Output

*   **Input (采集端)**: iOS Shortcuts (快捷指令)
*   **Cloud (云端大脑)**: **Supabase** (Storage + Edge Functions + PostgreSQL)
*   **Output (消费端)**: React PWA

## 2. 详细选型

### A. 采集端 (iOS Shortcut)
*   **功能**: 仅负责“搬运”。
    1.  接收分享的图片。
    2.  本地压缩 (Resize & WebP/JPEG)。
    3.  Base64 编码。
    4.  调用 Supabase REST API 上传图片。
*   **优势**: 极快，不涉及任何 AI 逻辑，保证用户手机不发烫、不等待。

### B. 云端大脑 (Supabase)
这是本项目的核心处理中心。

1.  **Storage (Bucket)**: 接收并存储截图。
2.  **Database (PostgreSQL)**:
    *   表 `inbox`: 存储图片元数据、分析状态、**以及 AI 生成的 JSON 结果**。
3.  **Edge Functions (TypeScript)**:
    *   **触发**: 通过 Database Webhook 或 Storage Event 触发。
    *   **逻辑**:
        *   监听 `INSERT` 事件（新图片到达）。
        *   读取图片 -> 调用 **Google Gemini API**。
        *   获取 JSON 响应 -> 更新数据库记录 (写入 `analysis_result` 字段，设置 `status = 'ready'`)。
    *   **优势**: 所有的等待时间都发生在云端（用户不知情）。

### C. 消费端 (React PWA)
*   **框架**: **React 18** + **Vite** + **Tailwind CSS**。
*   **逻辑**: 变成了一个纯粹的“展示器”。
    *   App 启动 -> 查询 Supabase `inbox` 表中 `status = 'ready'` 的记录。
    *   直接渲染 JSON 为卡片。**无需前端调用 AI，无需等待。**
    *   用户交互 (右滑/左滑) -> 更新数据库状态 (归档/删除)。

## 3. 数据流向图

```
[ 用户在小红书 ]
      ⬇️ (截图 & 分享)
[ iOS Shortcut ]
      ⬇️ (POST 图片)
[ Supabase Storage ] <--- ☁️ 图片落地
      ⬇️ (触发 Webhook)
[ Supabase Edge Function ] <--- 🧠 核心大脑 (后台静默运行)
      🔄 (调用 Gemini API)
      ⬇️ (写入 JSON 结果)
[ Supabase Database ] <--- 📦 结果已就绪 (Waiting for user)
      |
      | (晚上 10 点，用户打开 App)
      ⬇️
[ React PWA ] <--- 🚀 秒开
      ⬇️ (拉取已生成的 JSON)
[ 知识卡片 UI ]
```

## 4. 目录结构规划

```
/
├── supabase/
│   ├── functions/
│   │   └── analyze-screenshot/  # ☁️ 边缘函数：处理 AI 逻辑
│   │       ├── index.ts
│   │       └── ...
│   └── config.toml
├── src/ (前端代码)
│   ├── components/
│   │   ├── CardStack.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── supabase.ts
│   │   └── ... (前端不再包含 gemini.ts，逻辑移至后端)
│   ├── App.tsx
│   └── main.tsx
└── vite.config.ts
```

## 5. 关键配置说明
*   **API Key 管理**: Gemini API Key 现在存储在 **Supabase Secrets** (环境变量) 中，而不是暴露在前端代码里。这更安全。
*   **配额管理**: 利用 Supabase 的 Free Tier (每月 500k 次 Edge Function 调用)，完全覆盖个人使用场景。
