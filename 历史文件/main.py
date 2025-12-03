#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
截屏智能卡片生成器 - 主程序
单图输入 → AI 分析 → 生成知识卡片
"""

import os
import sys
import json
import base64
import webbrowser
import shutil
from datetime import datetime
from pathlib import Path
from openai import OpenAI
from jinja2 import Template

# 导入图片压缩模块
from compress_images import compress_image, format_size


def load_config():
    """加载配置文件"""
    config_path = Path(__file__).parent / 'config.json'
    with open(config_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def encode_image(image_path):
    """将图片转换为 base64 编码"""
    with open(image_path, 'rb') as f:
        return base64.b64encode(f.read()).decode('utf-8')


def load_few_shot_examples():
    """加载 Few-Shot 示例"""
    examples_path = Path(__file__).parent / 'prompt_examples.json'
    try:
        with open(examples_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"⚠️ 无法加载 Few-Shot 示例: {e}")
        return None


def get_prompt():
    """获取 AI 分析的 Prompt"""
    # 加载 Few-Shot 示例
    examples_data = load_few_shot_examples()

    # 构建额外的示例文本
    extra_examples = ""
    if examples_data:
        good_examples = examples_data.get('few_shot_examples', {}).get('good_examples', [])
        if good_examples:
            extra_examples = "\n\n## 📚 优质输出示例（学习这些！）\n\n"
            for i, ex in enumerate(good_examples[:3], 1):  # 只取前3个最重要的示例
                extra_examples += f"### 示例 {i}: {ex['category']}\n\n"
                extra_examples += f"**截图内容**: {ex['screenshot_content']}\n\n"
                extra_examples += f"**❌ 错误输出**: {ex['bad_output_example']}\n\n"
                extra_examples += "**✅ 正确输出**: \n```json\n" + json.dumps(ex['good_output_example'], ensure_ascii=False, indent=2) + "\n```\n\n"
                extra_examples += "**为什么好**:\n"
                for reason in ex['why_good']:
                    extra_examples += f"- {reason}\n"
                extra_examples += "\n---\n\n"

    return """你是一个"碎片知识提炼专家"。

用户在刷手机时截图了这个内容，说明他觉得有价值，但可能：
- 想稍后深入了解某个概念或理论
- 想记住某个人名、书名、工具名
- 想收藏某个推荐（书/课程/文章/工具）
- 想回顾某个有趣的观点或见解
- 想标记一个待查询的问题

请分析这张截图，并提炼成"一口吃掉的知识卡片"。

## 💡 增量价值原则（核心要求！）

⚠️ **你的任务不是复述截图内容，而是提供用户懒得查但需要的深度信息！**

### 用户心理模型：
- 用户截图 = 对话题感兴趣，但懒得深入研究
- 你的价值 = 帮用户"喂到嘴边"，提供他们不知道的增量内容

### 具体要求（按内容类型）：

**1. 推荐类（人物/工具/书籍/课程）**
   - ❌ 禁止：只列出名字和简介（这些截图里已经有了！）
   - ✅ 必须提供：
     * 具体案例：他们在哪个场合说了什么（播客、访谈、文章）
     * 产品哲学：具体的产品决策和背后原因
     * 可学习的方法论：用户能直接应用的思路
     * 技术细节：如果有公开的实现方法，提供出来

   示例对比：
   - ❌ Bad: "Kevin Weil 是 OpenAI 的 CPO"
   - ✅ Good: "Kevin 在 Lenny's Podcast (2024年11月) 讲了 Sora 的产品哲学：'我们砍掉了所有时间轴、剪辑工具，因为工具越多，用户想象力越受限。' 可偷师的点：如果你在做AI产品，问自己——用户需要调的每个参数，是不是都在暗示你的AI还不够智能？"

**2. 概念解释类**
   - ❌ 禁止：只解释概念本身
   - ✅ 必须提供：
     * 应用场景：在什么情况下用
     * 现代启示：对当下的意义
     * 反常识点：打破常规认知的地方
     * 可行动建议：看完后能做什么

**3. 观点/案例类**
   - ❌ 禁止：只陈述观点
   - ✅ 必须提供：
     * 论据支持：为什么这么说
     * 具体数据：如果有数字/时间/地点
     * 反例思考：什么情况下不成立
     * 如何应用：我能怎么用

### 信息深度优先级：

1. **具体案例** > 抽象描述
2. **可验证细节**（时间、地点、出处、数据）> 泛泛而谈
3. **可行动建议** > 纯理论
4. **反常识洞察** > 常识复述
5. **技术实现细节** > 只说"很厉害"

### 检查清单（输出前自问）：

- [ ] 我提供的内容，用户能从截图直接看到吗？如果能，删掉！
- [ ] 我有没有给出具体案例（时间、地点、人物、事件）？
- [ ] 我有没有提供可行动建议（用户看完能做什么）？
- [ ] 我有没有补充背景知识（理论出处、历史背景）？
- [ ] 我有没有提供"如何获取/使用"的路径？

## 分析步骤

### 1. 识别内容类型
- 推荐类：书籍/工具/课程/文章推荐
- 概念解释：理论/名词/术语解释
- 观点分享：评论/见解/思考
- 案例故事：实际案例/故事
- 问题记录：待查询的问题或困惑
- 其他

### 2. 提取核心信息
**标题**：10字以内，直击要点，吸引眼球
**标签**：1-2个关键词（如：AI工具、社会学、产品设计、编程）
**阅读时长**：根据内容量估算（15秒/1分钟/2分钟）

**核心内容**（按内容类型结构化）：

如果是**推荐类**：
- 是什么：简要介绍
- 为什么值得关注：核心价值
- 如何获取：链接、搜索关键词或获取方式

如果是**概念解释**：
- 是什么：概念定义
- 为什么重要：应用场景和价值
- 举个例子：具体例子帮助理解

如果是**观点分享**：
- 核心论点：主要观点是什么
- 支持论据：有哪些依据
- 可行动建议：我可以做什么

如果是**问题记录**：
- 问题是什么：清晰描述问题
- 为什么想了解：背景和动机
- 可能的方向：初步思考方向

### 3. 增值补充（可选）
- 背景知识：帮助理解的上下文
- 延伸阅读：相关资源、书籍、文章
- 行动建议：用户可以采取的具体行动

## 输出格式要求

请严格按照以下 JSON 格式输出（不要有任何其他文字）：

### 示例1：推荐类（提供深度案例）

```json
{
  "meta": {
    "content_type": "推荐类",
    "confidence": 90,
    "source_hint": "小红书"
  },
  "card": {
    "tag": "产品设计",
    "title": "硅谷Builder的产品秘诀",
    "read_time": "2分钟",
    "sections": [
      {
        "type": "highlight",
        "content": "这些builder不喊口号，而是分享具体产品决策"
      },
      {
        "type": "example",
        "title": "Kevin Weil：速度是新护城河",
        "content": "在Lenny's Podcast(2024年11月)讲了Sora的产品哲学：'我们砍掉了所有时间轴、剪辑工具，因为工具越多，用户想象力越受限。'可偷师的点：用户需要调的每个参数，是不是都在暗示你的AI还不够智能？"
      },
      {
        "type": "example",
        "title": "Granola：增强式AI而非替代式AI",
        "content": "2024年10月发布会议笔记App。核心不是'AI自动生成笔记'，而是'你的手写+AI补充'融合。产品哲学：'We don't want to replace note-taking. We want to make your notes better.' 用户更愿为'让我更强'付费，不是'替我做'。已上线granola.so可试用。"
      }
    ],
    "supplement": {
      "background": "这6人代表2024-2025 AI产品三个方向：速度为王、无感集成、性格设计",
      "action": "如果你在做AI产品，问自己：我的每个功能是在'增强用户'还是'替代用户'？"
    }
  }
}
```

### 示例2：概念解释类

```json
{
  "meta": {
    "content_type": "概念解释",
    "confidence": 95,
    "source_hint": "小红书"
  },
  "card": {
    "tag": "社会学",
    "title": "为什么年味越来越淡？",
    "read_time": "1分钟",
    "sections": [
      {
        "type": "highlight",
        "content": "年味的本质是'集体欢腾'（Collective Effervescence）"
      },
      {
        "type": "list",
        "title": "需要三个条件",
        "items": ["肉身聚集", "动作同步", "时间共享"]
      },
      {
        "type": "insight",
        "content": "现代生活把这三个条件全毁了：身体在客厅，眼睛在手机。"
      }
    ],
    "supplement": {
      "background": "涂尔干《宗教生活的基本形式》1912年",
      "action": "观察下次聚会时，有多少人在看手机"
    }
  }
}
```

### Section Types（内容块类型）说明：

- **highlight**: 核心洞察、关键结论（用于最重要的一句话）
- **explanation**: 概念解释、普通段落
- **list**: 要点列表（带标题和多个条目）
- **quote**: 引用原文
- **insight**: 现代启示、深度思考
- **example**: 具体案例
- **question**: 问题或困惑

## 重要提示

1. 标题要吸引人，让用户一眼就想看
2. 内容要精炼，去掉冗余信息
3. 结构要清晰，方便快速浏览
4. 如果截图内容不完整或无法识别，在 confidence 中反映
5. 严格按照 JSON 格式输出，不要有任何额外文字""" + extra_examples


def analyze_screenshot(image_path, config):
    """使用 AI Vision API 分析截图"""
    print(f"\n🔍 正在分析截图: {os.path.basename(image_path)}")

    # 读取图片文件
    with open(image_path, 'rb') as f:
        image_data = base64.standard_b64encode(f.read()).decode('utf-8')

    # 创建 OpenAI 兼容客户端（DeepSeek）
    client = OpenAI(
        api_key=config['api']['api_key'],
        base_url=config['api']['base_url']
    )

    try:
        # 调用 DeepSeek API
        print(f"📡 调用 {config['api']['provider'].upper()} API...")
        print(f"   Base URL: {config['api']['base_url']}")
        print(f"   Model: {config['api']['model']}")

        response = client.chat.completions.create(
            model=config['api']['model'],
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_data}"
                            }
                        },
                        {
                            "type": "text",
                            "text": get_prompt()
                        }
                    ]
                }
            ],
            max_tokens=config['api']['max_tokens'],
            temperature=config['api']['temperature']
        )

        # 提取返回的 JSON 内容
        content = response.choices[0].message.content

        # 清理可能的 markdown 代码块标记
        content = content.strip()
        if content.startswith('```json'):
            content = content[7:]
        if content.startswith('```'):
            content = content[3:]
        if content.endswith('```'):
            content = content[:-3]
        content = content.strip()

        # 解析 JSON
        analysis = json.loads(content)

        print(f"✅ 分析完成")
        print(f"   内容类型: {analysis['meta']['content_type']}")
        print(f"   置信度: {analysis['meta']['confidence']}%")
        print(f"   标题: {analysis['card']['title']}")
        print(f"   标签: {analysis['card']['tag']}")

        return analysis

    except Exception as e:
        print(f"❌ API 调用失败: {str(e)}")
        raise


def generate_card_html(analysis, image_path, config):
    """生成卡片 HTML"""
    print("\n📝 生成卡片 HTML...")

    # 读取模板
    template_path = Path(__file__).parent / 'templates' / 'card_template.html'

    # 如果模板不存在，使用简单的默认模板
    if not template_path.exists():
        print("⚠️  模板文件不存在，使用默认模板")
        template_content = create_default_template()
    else:
        with open(template_path, 'r', encoding='utf-8') as f:
            template_content = f.read()

    # 渲染模板
    template = Template(template_content)
    html = template.render(
        analysis=analysis,
        timestamp=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        image_name=os.path.basename(image_path)
    )

    # 生成带时间戳和原始文件名的输出文件名
    original_filename = Path(image_path).stem  # 获取不带扩展名的文件名
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')  # 格式: 20241124_153045
    output_filename = f"{original_filename}_{timestamp}.html"

    # 保存 HTML
    output_path = Path(__file__).parent / 'output' / output_filename
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"✅ 卡片已生成: {output_path}")

    return output_path


def create_default_template():
    """创建默认的 HTML 模板"""
    return """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ analysis.card.title }}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }

        .card-container {
            max-width: 420px;
            width: 100%;
        }

        .card {
            background: white;
            border-radius: 24px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
            animation: slideIn 0.4s ease-out;
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .card-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 24px 24px;
        }

        .card-tag {
            display: inline-block;
            background: rgba(255,255,255,0.2);
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
            margin-bottom: 12px;
            backdrop-filter: blur(10px);
        }

        .card-title {
            font-size: 24px;
            font-weight: 700;
            line-height: 1.3;
            margin-bottom: 8px;
        }

        .read-time {
            font-size: 13px;
            opacity: 0.9;
        }

        .card-body {
            padding: 28px 24px 24px;
        }

        .section {
            margin-bottom: 24px;
        }

        .section:last-child {
            margin-bottom: 0;
        }

        .section-title {
            font-size: 15px;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 8px;
        }

        .highlight-box {
            background: linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%);
            border-left: 4px solid #fdcb6e;
            padding: 16px;
            border-radius: 8px;
            margin: 12px 0;
        }

        .highlight-box p {
            margin: 0;
            font-size: 15px;
            font-weight: 600;
            color: #2d3436;
            line-height: 1.6;
        }

        .insight-box {
            background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
            padding: 16px;
            border-radius: 12px;
            margin: 12px 0;
        }

        .insight-box p {
            margin: 0;
            font-size: 15px;
            font-weight: 600;
            color: #2d3436;
            line-height: 1.7;
        }

        .quote-box {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 16px;
            margin: 12px 0;
            border-radius: 8px;
            font-style: italic;
            color: #2d3436;
            line-height: 1.8;
        }

        .list-box {
            background: #f8f9fa;
            padding: 16px;
            border-radius: 8px;
            margin: 12px 0;
        }

        .list-box ol, .list-box ul {
            padding-left: 20px;
            margin: 8px 0 0 0;
        }

        .list-box li {
            margin-bottom: 6px;
            line-height: 1.6;
        }

        p {
            font-size: 15px;
            line-height: 1.8;
            color: #2d3436;
            margin-bottom: 12px;
        }

        .supplement {
            background: #f8f9fa;
            padding: 16px;
            border-radius: 8px;
            margin-top: 20px;
            font-size: 14px;
        }

        .supplement-title {
            font-weight: 700;
            color: #667eea;
            margin-bottom: 6px;
        }

        .card-footer {
            padding: 16px 24px;
            border-top: 1px solid #e9ecef;
            font-size: 12px;
            color: #999;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="card-container">
        <div class="card">
            <div class="card-header">
                <div class="card-tag">{{ analysis.card.tag }}</div>
                <h1 class="card-title">{{ analysis.card.title }}</h1>
                <div class="read-time">🕐 {{ analysis.card.read_time }}</div>
            </div>

            <div class="card-body">
                {% for section in analysis.card.sections %}
                    <div class="section">
                        {% if section.type == 'highlight' %}
                            <div class="highlight-box">
                                <p>{{ section.content }}</p>
                            </div>

                        {% elif section.type == 'insight' %}
                            <div class="insight-box">
                                <p>{{ section.content }}</p>
                            </div>

                        {% elif section.type == 'quote' %}
                            <div class="quote-box">
                                {{ section.content }}
                            </div>

                        {% elif section.type == 'list' %}
                            <div class="list-box">
                                {% if section.title %}
                                    <div class="section-title">{{ section.title }}</div>
                                {% endif %}
                                <ol>
                                    {% for item in section.items %}
                                        <li>{{ item }}</li>
                                    {% endfor %}
                                </ol>
                            </div>

                        {% elif section.type == 'explanation' or section.type == 'example' or section.type == 'question' %}
                            {% if section.title %}
                                <div class="section-title">{{ section.title }}</div>
                            {% endif %}
                            <p>{{ section.content }}</p>

                        {% else %}
                            <p>{{ section.content }}</p>
                        {% endif %}
                    </div>
                {% endfor %}

                {% if analysis.card.supplement %}
                    <div class="supplement">
                        {% if analysis.card.supplement.background %}
                            <div class="supplement-title">📚 背景知识</div>
                            <p>{{ analysis.card.supplement.background }}</p>
                        {% endif %}

                        {% if analysis.card.supplement.action %}
                            <div class="supplement-title" style="margin-top: 12px;">💡 行动建议</div>
                            <p>{{ analysis.card.supplement.action }}</p>
                        {% endif %}
                    </div>
                {% endif %}
            </div>

            <div class="card-footer">
                来源: {{ analysis.meta.source_hint }} | 生成时间: {{ timestamp }}
            </div>
        </div>
    </div>
</body>
</html>"""


def process_screenshot(image_path, config):
    """
    主处理流程：单图 → 卡片

    Args:
        image_path: 截图路径
        config: 配置对象

    Returns:
        card_html_path: 生成的卡片 HTML 路径
    """
    print("\n" + "="*60)
    print("📸 截屏智能卡片生成器")
    print("="*60)

    # 1. 检查文件是否存在
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"图片不存在: {image_path}")

    print(f"\n📂 输入文件: {os.path.basename(image_path)}")
    original_size = os.path.getsize(image_path)
    print(f"   文件大小: {format_size(original_size)}")

    # 2. 图片预处理（智能压缩）
    print("\n[1/3] 图片预处理...")
    temp_path = Path(__file__).parent / 'output' / 'temp_compressed.jpg'

    # 智能判断：如果图片已经很小，跳过压缩
    size_threshold_mb = config['processing'].get('skip_compress_threshold_mb', 0.5)  # 默认500KB
    size_threshold_bytes = size_threshold_mb * 1024 * 1024

    if original_size <= size_threshold_bytes:
        print(f"   图片已足够小 (<{size_threshold_mb}MB)，跳过压缩")
        # 直接复制原图
        shutil.copy2(image_path, temp_path)
        processing_path = temp_path
    else:
        # 需要压缩
        print(f"   图片较大 (>{size_threshold_mb}MB)，开始压缩...")
        orig_size, compressed_size = compress_image(
            image_path,
            str(temp_path),
            quality=config['processing']['compress_quality'],
            max_width=config['processing']['target_width'],
            max_height=config['processing']['target_height']
        )

        if orig_size and compressed_size:
            ratio = (1 - compressed_size / orig_size) * 100
            print(f"   压缩完成: {format_size(orig_size)} → {format_size(compressed_size)} (减少 {ratio:.1f}%)")
        processing_path = temp_path

    # 3. AI 分析
    print("\n[2/3] AI 分析中...")
    analysis = analyze_screenshot(str(temp_path), config)

    # 保存分析结果
    if config['output']['save_analysis_json']:
        # 生成带时间戳和原始文件名的 JSON 文件名
        original_filename = Path(image_path).stem
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        analysis_filename = f"{original_filename}_{timestamp}_analysis.json"
        analysis_path = Path(__file__).parent / 'output' / analysis_filename
        with open(analysis_path, 'w', encoding='utf-8') as f:
            json.dump(analysis, f, ensure_ascii=False, indent=2)
        print(f"   分析结果已保存: {analysis_path}")

    # 4. 生成卡片
    print("\n[3/3] 生成卡片...")
    card_html_path = generate_card_html(analysis, image_path, config)

    # 清理临时文件
    if temp_path.exists():
        os.remove(temp_path)

    print("\n" + "="*60)
    print("✅ 处理完成！")
    print("="*60)
    print(f"\n📂 卡片位置: {card_html_path}")

    # 自动打开浏览器
    if config['output']['auto_open_browser']:
        print("\n🌐 正在浏览器中打开...")
        webbrowser.open(f'file://{os.path.abspath(card_html_path)}')

    return card_html_path


def main():
    """命令行入口"""
    # 加载配置
    config = load_config()

    # 获取输入图片路径
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
    else:
        # 默认从 input 目录读取
        input_dir = Path(__file__).parent / 'input'
        images = list(input_dir.glob('*.jpg')) + list(input_dir.glob('*.png')) + list(input_dir.glob('*.jpeg'))

        if not images:
            print("❌ 错误: 未找到输入图片")
            print("\n使用方法:")
            print("  python main.py <图片路径>")
            print("  或将图片放入 input/ 文件夹")
            sys.exit(1)

        image_path = str(images[0])
        print(f"📌 自动选择: {os.path.basename(image_path)}")

    try:
        # 处理截图
        process_screenshot(image_path, config)

    except KeyboardInterrupt:
        print("\n\n⚠️  用户中断")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ 错误: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
