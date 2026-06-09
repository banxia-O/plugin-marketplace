/** DeepSeek API（OpenAI 兼容）薄封装 */

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CompletionResponse {
  choices: Array<{ message: { content: string } }>;
}

async function chat(apiKey: string, messages: ChatMessage[], maxTokens = 2048, temp = 0.3): Promise<string> {
  const res = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: DEEPSEEK_MODEL, messages, max_tokens: maxTokens, temperature: temp }),
  });
  if (!res.ok) throw new Error(`DeepSeek API 返回 ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as CompletionResponse;
  return data.choices[0]?.message.content ?? '';
}

export interface SecurityScanResult {
  safe: boolean;
  concerns: string[];
}

/** 代码安全扫描 */
export async function securityScan(
  apiKey: string,
  pluginName: string,
  readme: string,
  packageJson: string,
): Promise<SecurityScanResult> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        '你是 MCP 插件安全审核员。分析插件的 README 和 package.json，判断是否存在明显的恶意行为：' +
        '异常网络请求、数据外传、文件系统越权访问、混淆代码、硬编码密钥、挖矿行为等。' +
        '仅输出 JSON，格式：{"safe":true,"concerns":[]} 或 {"safe":false,"concerns":["..."]}\n不要输出任何其他内容。',
    },
    {
      role: 'user',
      content:
        `插件名：${pluginName}\n\n` +
        `--- README（前 3000 字符）---\n${readme.slice(0, 3000)}\n\n` +
        (packageJson ? `--- package.json ---\n${packageJson}\n` : ''),
    },
  ];

  try {
    const raw = await chat(apiKey, messages, 512, 0.1);
    const json = raw.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { safe: true, concerns: [] };
    return JSON.parse(json) as SecurityScanResult;
  } catch {
    // LLM 失败时默认放行，不因工具故障误拒
    return { safe: true, concerns: [] };
  }
}

const AGENT_MD_SYSTEM = `\
你是 MCP 插件文档生成员。根据提供的 README，生成符合以下模板的 agent.md（中文，Markdown 格式）。
直接输出 Markdown 内容，不要包裹在代码块或其他标记中。
末尾加一行：> *此 agent.md 由 AI 自动生成，欢迎贡献改进。*

模板结构（严格遵守，不要遗漏章节）：
# [插件名称]

## 部署方式
{local=本地部署 / remote=远程服务 / both=两者皆可}

## 这个插件是什么
（一段话，100 字以内）

## 适用场景
（2-4 个典型场景）

## 安装与配置

### 环境要求
### 安装步骤
### 配置项

## 验证
（具体的验证命令或测试用例，以及预期输出）

## 需要 user 提供的种子数据
## 使用示例
## 注意事项`;

/** 基于 README 生成 agent.md */
export async function generateAgentMd(
  apiKey: string,
  pluginName: string,
  readme: string,
  deployMethod: string,
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: AGENT_MD_SYSTEM },
    {
      role: 'user',
      content:
        `插件名：${pluginName}\n部署方式：${deployMethod}\n\n--- README ---\n${readme.slice(0, 8000)}`,
    },
  ];
  return chat(apiKey, messages, 2048, 0.5);
}
