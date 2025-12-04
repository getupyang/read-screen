/**
 * 链接验证工具
 * 用于检测 AI 生成的链接是否真实可访问
 */

/**
 * 验证单个 URL 是否可访问
 */
export async function verifyUrl(url: string): Promise<{ valid: boolean; status?: number; error?: string }> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow'
    });

    return {
      valid: response.ok,
      status: response.status
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message
    };
  }
}

/**
 * 从文本中提取所有 URL
 */
export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s\)\]]+/g;
  return text.match(urlRegex) || [];
}

/**
 * 从 markdown 链接中提取 URL
 */
export function extractMarkdownUrls(text: string): string[] {
  const markdownLinkRegex = /\[([^\]]+)\]\(([^\)]+)\)/g;
  const urls: string[] = [];
  let match;

  while ((match = markdownLinkRegex.exec(text)) !== null) {
    urls.push(match[2]);
  }

  return urls;
}

/**
 * 验证 AI 输出中的所有链接
 */
export async function verifyAIOutput(result: any): Promise<{
  allValid: boolean;
  validUrls: string[];
  invalidUrls: Array<{ url: string; status?: number; error?: string }>;
}> {
  const urls = new Set<string>();

  // 从所有卡片中提取 URL
  if (result.cards && Array.isArray(result.cards)) {
    for (const card of result.cards) {
      // 从 content 中提取
      if (card.content) {
        extractUrls(card.content).forEach(url => urls.add(url));
        extractMarkdownUrls(card.content).forEach(url => urls.add(url));
      }

      // 从 summary 中提取
      if (card.summary) {
        extractUrls(card.summary).forEach(url => urls.add(url));
        extractMarkdownUrls(card.summary).forEach(url => urls.add(url));
      }
    }
  }

  const validUrls: string[] = [];
  const invalidUrls: Array<{ url: string; status?: number; error?: string }> = [];

  // 验证所有 URL
  for (const url of urls) {
    const result = await verifyUrl(url);

    if (result.valid) {
      validUrls.push(url);
    } else {
      invalidUrls.push({
        url,
        status: result.status,
        error: result.error
      });
    }
  }

  return {
    allValid: invalidUrls.length === 0,
    validUrls,
    invalidUrls
  };
}
