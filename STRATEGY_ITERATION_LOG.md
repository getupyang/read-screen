# 策略迭代日志

## 迭代1：v2-with-search（失败）

**时间**：2025-12-04  
**得分**：22/100  
**状态**：❌ 失败

### AI 输出
- 链接：https://www.anthropic.com/news/ai-impact-on-knowledge-work ❌ 幻觉
- 时间：2023年10月 ❌ 错误
- 无金句

### 真实信息（WebSearch 验证）
- 链接：https://www.anthropic.com/research/how-ai-is-transforming-work-at-anthropic ✅
- 时间：2025年8月 ✅
- 内容：132名工程师调查，20万条对话分析

### 失败原因
1. Google Search grounding 完全不工作
2. AI 编造信息而非搜索
3. Prompt 约束无效

### 修改方案
**v2.1**：修复 Google Search grounding API 配置

---

## 迭代2：v2-with-search（配置修复）

**时间**：2025-12-06
**状态**：🔧 待验证

### 根因分析
通过分析 @google/genai SDK 源码发现：
1. 错误配置：使用了 `googleSearchRetrieval` + `dynamicRetrievalConfig`
2. SDK 支持两种搜索工具：
   - `googleSearchRetrieval` - "Specialized retrieval tool"（适用于 Vertex AI）
   - `googleSearch` - "Tool to support Google Search in Model"（适用于 Gemini API）
3. 用户在 Google AI Studio 测试成功，证明功能本身可用

### 配置修复（Commit: 68eeef1）

**之前的错误配置**：
```typescript
requestConfig.tools = [{
  googleSearchRetrieval: {
    dynamicRetrievalConfig: {
      mode: "MODE_DYNAMIC",
      dynamicThreshold: 0.3
    }
  }
}];
```

**修复后的正确配置**：
```typescript
requestConfig.config = {
  ...requestConfig.generationConfig,  // responseMimeType, responseSchema
  tools: [{ googleSearch: {} }]       // 官方 Gemini API 格式
};
```

**参考**：
- SDK 类型定义：`/node_modules/@google/genai/dist/genai.d.ts:7555`
- `Tool` 接口包含：`googleSearch?: GoogleSearch;`
- `GenerateContentConfig` 接口包含：`tools?: ToolListUnion;`
- 官方文档：https://ai.google.dev/gemini-api/docs/google-search

### 影响文件
- ✅ `api/evaluate.ts:110-116` - 评测 API 已修复
- ✅ `api/process.ts:107-116` - 生产 API 已修复

### 验证清单
待用户或 Claude 自己通过 evaluate.html 测试：

- [ ] API 调用成功（非 500 错误）
- [ ] 日志中出现 `[Evaluate] Google Search enabled (official API format)`
- [ ] 响应中包含 grounding metadata
- [ ] 输出包含正确链接：https://www.anthropic.com/research/how-ai-is-transforming-work-at-anthropic
- [ ] 输出包含正确时间：2025年8月
- [ ] URL 验证：所有链接有效（allValid: true）
- [ ] 包含来源引用（如 [1][2][3]）

### 预期得分
如果 grounding 正常工作：**70-85/100**
- ✅ [+10] 生成卡片
- ✅ [+30] 正确链接
- ✅ [+20] 无幻觉链接
- ✅ [+15] 正确时间
- ✅ [+10] 标题质量
- ✅ [+15] 内容详细

### 下一步
1. **立即测试**：访问 https://read-screen.vercel.app/evaluate.html
2. **检查日志**：Vercel Dashboard → Functions → 查看 evaluate 函数日志
3. **如果失败**：分析 grounding metadata 是否存在，考虑两步法（v3）

---

