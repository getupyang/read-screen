
# 🗺️ Snapshot AI - 开发路线图 (Roadmap)

这份文档指导我们将 Snapshot AI 从概念转化为手机上可用的产品。

## 1. 架构全景图 (The Big Picture)

我们采用 **"Serverless + Edge"** 架构，实现无感采集与异步处理。

```mermaid
graph TD
    User[用户 (iOS)] -->|1. 截图 & 分享| Shortcut[⚡️ iOS 快捷指令]
    Shortcut -->|2. HTTP POST (Wi-Fi/5G)| Supabase[☁️ Supabase Cloud]
    
    subgraph "云端大脑 (后台静默处理)"
        Supabase -->|3. 存储图片| Storage[Bucket]
        Storage -->|4. 触发事件| EdgeFunc[🧠 Edge Function]
        EdgeFunc -->|5. 调用 API| Gemini[✨ Google Gemini]
        Gemini -->|6. 返回分析结果| DB[(PostgreSQL 数据库)]
    end
    
    User -->|7. 晚间打开 PWA| PWA[📱 React 网页应用]
    PWA -->|8. 拉取已生成结果| DB
```

### 关键说明：数据流与隐私
*   **不占用 iCloud**：所有数据传输直接通过 HTTPS 网络请求发送至 Supabase。**不使用** iCloud Drive 或 iCloud 同步功能。
*   **存储位置**：图片和分析结果存储在 Supabase 的云端服务器（提供 500MB+ 的免费数据库空间），不占用本地存储。
*   **权限要求**：iOS 快捷指令仅需一次性“网络连接授权”。

## 2. 阶段性开发计划

### Phase 1: 基础设施 (Infrastructure)
**目标**：打通 "iOS -> Cloud" 的上传链路。
- [ ] **Supabase 初始化**
    - 创建 Project。
    - 配置 Storage Bucket (命名为 `screenshots`)。
    - 配置 Database Table (命名为 `inbox`)。
- [ ] **Hello World 边缘函数**
    - 编写一个简单的 Edge Function，确保能接收外部请求。
- [ ] **iOS 快捷指令原型**
    - 编写 Shortcut：接收图片 -> 压缩 -> 上传到 Supabase。
    - **验证**：手机截图，能在 Supabase 后台看到图片。

### Phase 2: 云端大脑 (The Brain)
**目标**：让云端学会自动分析图片。
- [ ] **集成 Gemini API**
    - 在 Supabase Secrets 中配置 `GEMINI_API_KEY`。
- [ ] **编写分析逻辑 (TypeScript)**
    - 完善 Edge Function：
    - 读取图片流。
    - 构造 Prompt (迁移 Python 中的逻辑)。
    - 调用 Gemini 2.5 Flash。
    - 解析 JSON 并写入 Database。
- [ ] **验证**：上传图片 10 秒后，数据库里自动出现 JSON 结果。

### Phase 3: 前端交互 (The Experience)
**目标**：打造“Tinder for Knowledge”的刷卡体验。
- [ ] **PWA 框架搭建**
    - Vite + React + Tailwind + Framer Motion (用于丝滑动画)。
- [ ] **卡片 UI 开发**
    - 实现 `CardStack` 组件 (左滑删除/右滑保存)。
    - 实现精美的排版样式 (模仿 Notion/小红书风格)。
- [ ] **数据联调**
    - 连接 Supabase，拉取 `status=ready` 的数据。

### Phase 4: 部署与上线 (Deployment)
**目标**：装进手机。
- [ ] **前端部署**
    - Push 代码到 GitHub。
    - 连接 Vercel 自动部署 (获得 `https://snapshot-ai.vercel.app` 链接)。
- [ ] **PWA 安装**
    - 在 Safari 打开链接 -> "添加到主屏幕"。
- [ ] **快捷指令分发**
    - 将配置好的 Shortcut 生成 iCloud 分享链接（方便安装）。

## 3. 可行性风控 (Risk Management)

| 风险点 | 解决方案 |
| :--- | :--- |
| **网络波动** | 快捷指令增加“重试”机制；Supabase 边缘节点全球覆盖，速度通常很快。 |
| **Gemini 幻觉** | 在 Prompt 中强制要求 JSON 格式，若解析失败，云端标记为 `failed`，前端提示用户手动重试。 |
| **图片过大** | 快捷指令内置“调整大小”步骤，强制压到 1500px 宽，体积控制在 500KB 以内。 |
| **免费额度** | Supabase Free Tier 支持 500MB 数据库 + 1GB 文件存储。足够存几千条卡片。即使超了，只删旧图即可。 |

## 4. 下一步行动
准备开始 **Phase 1**。
你需要：
1. 一个 GitHub 账号。
2. 一个 Supabase 账号 (可以直接用 GitHub 登录)。
3. Google Gemini API Key。
