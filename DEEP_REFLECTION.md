# 深度反思：为什么两次优化后仍然幻觉严重

**时间**: 2025-12-04
**问题**: v2 策略经过两次优化，仍然出现严重幻觉
**真实链接**: https://www.anthropic.com/research/how-ai-is-transforming-work-at-anthropic

---

## 用户反馈

> "非常不合格，依然幻觉严重。真正的文章应该是这个：https://www.anthropic.com/research/how-ai-is-transforming-work-at-anthropic"

**问题表现**：
- ❌ 给出的链接不正确（编造或错误）
- ❌ 发布时间错误
- ❌ 可能根本没有使用搜索功能

---

## 调用流程分析

### 当前配置

**api/evaluate.ts** 和 **api/process.ts**:
```typescript
const requestConfig: any = {
  model: 'gemini-2.5-flash',
  contents: {
    parts: [
      { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
      { text: strategy.prompt }
    ]
  },
  config: {
    responseMimeType: "application/json",
    responseSchema: responseSchema,
  }
};

// 关键：这里添加 Google Search
if (strategy.useGoogleSearch) {
  requestConfig.tools = [{ googleSearch: {} }];
}

const response = await ai.models.generateContent(requestConfig);
```

### 问题1：搜索配置可能不正确

**怀疑**：`tools: [{ googleSearch: {} }]` 可能不是 Gemini 2.5 Flash 的正确配置方式

**根据 Gemini API 文档**，Google Search grounding 有多种配置方式：

#### 方式1：Dynamic Retrieval（动态检索）
```typescript
tools: [{
  googleSearch: {
    dynamicRetrievalConfig: {
      mode: 'MODE_DYNAMIC',
      dynamicThreshold: 0.3
    }
  }
}]
```

#### 方式2：简单配置（我们当前使用的）
```typescript
tools: [{ googleSearch: {} }]
```

#### 方式3：使用 grounding 配置
```typescript
// 可能需要在不同的位置配置
```

**验证方法**：
- 查看 API 响应中是否有 `groundingMetadata`
- 如果没有，说明搜索没有被触发

---

## 问题2：Prompt 可能没有有效触发搜索

**当前 Prompt**（简化后）：
```markdown
# 步骤2：搜索验证
**你必须搜索并验证以下信息**：
- 准确名称
- 真实发布时间
- 官方链接
- 核心内容

**搜索后，在你的输出中包含**：
- 你搜索的关键词是什么
- 你找到的信息来源是什么
```

**可能的问题**：
- AI 可能忽略了"必须搜索"的指令
- 即使配置了 `tools`，AI 也需要在 prompt 中被明确告知使用搜索
- 可能需要更直接的触发词，例如："现在搜索..."

---

## 问题3：响应格式限制

**当前配置**：
```typescript
config: {
  responseMimeType: "application/json",
  responseSchema: responseSchema,
}
```

**可能的问题**：
- JSON 格式限制可能阻止了 grounding metadata 的返回
- 强制 JSON schema 可能导致 AI 跳过搜索步骤
- 需要验证：在有 JSON schema 的情况下，grounding 是否能正常工作

---

## 问题4：没有中间步骤验证

**当前流程**：
```
截图 → Gemini API → JSON 结果
```

**缺少的验证**：
- ✗ 没有日志显示 AI 是否真的搜索了
- ✗ 没有显示搜索关键词
- ✗ 没有显示搜索结果
- ✗ 无法验证 grounding metadata

**应该有的流程**：
```
截图 → Gemini API →
  ↓
  检查 groundingMetadata
  ↓
  如果没有 → 警告：搜索未触发
  ↓
JSON 结果
```

---

## 根本原因分析

### 最可能的原因

1. **搜索功能可能根本没有被触发**
   - API 配置可能不正确
   - 或者 AI 选择不搜索（因为它觉得不需要）

2. **AI 编造信息而不是说"未找到"**
   - 即使 prompt 说了"不要编造"
   - AI 可能还是倾向于给出"看起来合理"的答案

3. **JSON schema 约束可能干扰了搜索行为**
   - 强制 JSON 输出可能让 AI 跳过搜索步骤
   - 直接编造符合 schema 的内容

---

## 解决方案

### 立即行动

1. **添加详细日志**（已完成）
   ```typescript
   // 检查 groundingMetadata
   if (response.groundingMetadata) {
     console.log('Grounding used:', response.groundingMetadata);
   } else {
     console.log('WARNING: No grounding - search not used');
   }
   ```

2. **查看 Vercel 日志**
   - 运行一次评测
   - 检查日志中是否有 grounding metadata
   - 确认搜索是否真的被调用

3. **测试不同配置**
   - 尝试 dynamicRetrievalConfig
   - 尝试移除 JSON schema 看是否影响搜索
   - 尝试更明确的搜索触发词

### 长期方案

1. **两步式生成**
   ```
   第一步：搜索并收集信息（不限制 JSON）
   第二步：基于搜索结果生成 JSON
   ```

2. **使用外部搜索 API**
   - 如果 Gemini 的搜索不可靠
   - 考虑使用 Brave Search API 或 Google Custom Search
   - 在代码中先搜索，再把结果传给 AI

3. **降级策略**
   - 如果搜索失败，明确告诉用户
   - 提供搜索关键词，让用户自己搜索
   - 不要编造信息

---

## 反思：为什么两次优化都失败了

### 优化1：详细的多步骤 prompt
**失败原因**：
- Prompt 太长（135行），AI 可能迷失在指令中
- 没有验证搜索是否真的被执行
- 假设搜索会自动工作

### 优化2：简化 prompt + 强调真实性
**失败原因**：
- 仍然没有验证搜索是否工作
- 只改 prompt，没有改配置
- 没有添加调试日志
- **核心问题**：在不知道搜索是否真的被调用的情况下，盲目优化 prompt

### 关键教训

**错误的做法**：
```
问题 → 改 prompt → 测试 → 还是失败 → 再改 prompt → ...
```

**正确的做法**：
```
问题 → 添加日志 → 确认根因 → 针对性修复 → 验证修复
```

---

## 下一步行动

1. **立即部署带日志的版本**
2. **运行测试，查看 Vercel 日志**
3. **确认 groundingMetadata 是否存在**
4. **根据日志结果决定下一步**

如果搜索确实没有工作：
- 尝试不同的 API 配置
- 考虑使用外部搜索 API
- 或者放弃搜索，改为提供搜索关键词

如果搜索工作了但结果不对：
- 改进搜索关键词提取
- 改进结果筛选逻辑
- 改进 prompt 引导 AI 使用搜索结果

---

## 用户体验影响

**当前状态**：
- 用户期望：准确的信息和链接
- 实际结果：编造的链接和错误的时间
- 体验：极差，完全不可用

**需要达到的状态**：
- 最低标准：说"未找到"比编造要好
- 期望标准：提供准确的链接和时间
- 理想标准：提供丰富的背景信息和引用

**当务之急**：
- 先做到"不编造"
- 再做到"准确"
- 最后做到"丰富"
