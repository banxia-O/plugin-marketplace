import type { Category, PluginCategoryRef, PluginDetail, Subcategory } from './index.js';

// ── 分类（与 worker/migrations 的 slug 保持一致） ──

interface CategoryDef {
  name: string;
  slug: string;
  icon: string;
  subs: Array<[name: string, slug: string]>;
}

const CATEGORY_DEFS: CategoryDef[] = [
  {
    name: '信息检索', slug: 'search', icon: 'Search',
    subs: [['搜索引擎', 'search-engine'], ['网页抓取', 'web-scraping'], ['新闻资讯', 'news'], ['知识百科', 'knowledge']],
  },
  {
    name: '文件与文档', slug: 'files', icon: 'FileText',
    subs: [['文件系统', 'filesystem'], ['文档处理', 'document'], ['云存储', 'cloud-storage']],
  },
  {
    name: '数据与数据库', slug: 'data', icon: 'Database',
    subs: [['SQL 数据库', 'sql'], ['NoSQL 数据库', 'nosql'], ['数据可视化', 'viz'], ['数据处理', 'processing']],
  },
  {
    name: '社交与通讯', slug: 'social', icon: 'MessageCircle',
    subs: [['即时通讯', 'im'], ['社交媒体', 'social-media'], ['邮件', 'email']],
  },
  {
    name: '办公与协作', slug: 'office', icon: 'Briefcase',
    subs: [['日历日程', 'calendar'], ['项目管理', 'project'], ['笔记写作', 'notes'], ['演示文稿', 'slides']],
  },
  {
    name: '开发工具', slug: 'dev', icon: 'Code',
    subs: [['代码仓库', 'repo'], ['CI/CD', 'cicd'], ['终端命令行', 'terminal'], ['API 与调试', 'api'], ['容器与云服务', 'cloud']],
  },
  {
    name: '生活服务', slug: 'life', icon: 'Home',
    subs: [['天气', 'weather'], ['地图导航', 'map'], ['出行旅行', 'travel'], ['购物比价', 'shopping'], ['时间工具', 'time']],
  },
  {
    name: '创意与设计', slug: 'creative', icon: 'Palette',
    subs: [['图片生成', 'image-gen'], ['图片处理', 'image-edit'], ['音频音乐', 'audio'], ['视频', 'video'], ['UI/设计', 'design']],
  },
  {
    name: '科研学术', slug: 'research', icon: 'FlaskConical',
    subs: [['文献检索', 'literature'], ['医学', 'medical'], ['法律', 'legal'], ['金融', 'finance'], ['数学计算', 'math'], ['生物信息', 'bioinfo'], ['化学材料', 'chem']],
  },
  {
    name: 'AI 与模型', slug: 'ai', icon: 'Bot',
    subs: [['记忆与知识', 'memory'], ['Prompt 工具', 'prompt'], ['模型管理', 'model'], ['Agent 框架', 'agent']],
  },
  {
    name: '安全与运维', slug: 'security', icon: 'Shield',
    subs: [['安全扫描', 'scan'], ['监控告警', 'monitor'], ['网络工具', 'network']],
  },
  { name: '其他', slug: 'other', icon: 'Package', subs: [] },
];

function buildCategories(): Category[] {
  let catId = 0;
  let subId = 0;
  return CATEGORY_DEFS.map((def, i) => {
    catId += 1;
    const categoryId = catId;
    const subcategories: Subcategory[] = def.subs.map(([name, slug], j) => {
      subId += 1;
      return { id: subId, categoryId, name, slug, sortOrder: j + 1 };
    });
    return { id: categoryId, name: def.name, slug: def.slug, icon: def.icon, sortOrder: i + 1, subcategories };
  });
}

export const categories: Category[] = buildCategories();

const SUB_INDEX = new Map<string, { catSlug: string; catName: string; subSlug: string; subName: string }>();
for (const c of categories) {
  for (const s of c.subcategories) {
    SUB_INDEX.set(`${c.slug}/${s.slug}`, { catSlug: c.slug, catName: c.name, subSlug: s.slug, subName: s.name });
  }
}

/** 按 "大类slug/子类slug" 构造分类引用 */
function ref(...keys: string[]): PluginCategoryRef[] {
  return keys.map((k) => {
    const hit = SUB_INDEX.get(k);
    if (!hit) throw new Error(`fixtures: 未知分类引用 ${k}`);
    return {
      categorySlug: hit.catSlug,
      categoryName: hit.catName,
      subcategorySlug: hit.subSlug,
      subcategoryName: hit.subName,
    };
  });
}

// ── agent.md 生成（仅用于种子展示，结构对齐 PRD 模板） ──

interface AgentMdInput {
  name: string;
  deploy: string;
  what: string;
  scenarios: string[];
  env: string;
  install: string;
  config: string;
  verify: string;
  seedData: string[];
  notes: string;
}

function buildAgentMd(i: AgentMdInput): string {
  return `# ${i.name}

## 部署方式
${i.deploy}

## 这个插件是什么
${i.what}

## 适用场景
${i.scenarios.map((s) => `- ${s}`).join('\n')}

## 安装与配置

### 环境要求
${i.env}

### 安装步骤
${i.install}

### 配置项
\`\`\`json
${i.config}
\`\`\`

## 验证
${i.verify}

## 需要 user 提供的种子数据
${i.seedData.map((s) => `- ${s}`).join('\n')}

## 注意事项
${i.notes}
`;
}

// ── 插件种子 ──

interface PluginSeed {
  slug: string;
  name: string;
  oneLiner: string;
  deployMethod: PluginDetail['deployMethod'];
  reviewStatus: PluginDetail['reviewStatus'];
  agentMdStatus: PluginDetail['agentMdStatus'];
  stars: number;
  downloadCount: number;
  likeCount: number;
  originalAuthor: string;
  repoUrl: string;
  license: string;
  supportedPlatforms: string[];
  categories: PluginCategoryRef[];
  descriptionMd: string;
  agentMd: string | null;
  lastRepoUpdate: string;
  createdAt: string;
}

const SEEDS: PluginSeed[] = [
  {
    slug: 'brave-search', name: 'Brave Search MCP', oneLiner: '用 Brave 搜索引擎给 AI 联网检索能力，隐私友好、无需信用卡。',
    deployMethod: 'both', reviewStatus: 'verified', agentMdStatus: 'ok',
    stars: 1820, downloadCount: 642, likeCount: 88, originalAuthor: 'modelcontextprotocol',
    repoUrl: 'https://github.com/modelcontextprotocol/servers', license: 'MIT',
    supportedPlatforms: ['Claude Code', 'OpenClaw', 'Cursor', 'Kimi', '通义千问'],
    categories: ref('search/search-engine'),
    descriptionMd: '基于 Brave Search API 的 MCP server，让 Agent 能发起网页搜索并拿到结构化结果。免费额度足够个人使用，隐私友好不追踪。',
    lastRepoUpdate: '2026-04-28', createdAt: '2026-05-20',
    agentMd: buildAgentMd({
      name: 'Brave Search MCP', deploy: '两者皆可（本地运行或接入远程服务）',
      what: '让 Agent 通过 Brave Search API 进行网页搜索，返回标题、摘要、链接的结构化结果，适合需要实时联网信息的场景。',
      scenarios: ['让 AI 查最新资讯、产品比价', '写报告时检索资料来源', '回答需要实时信息的问题'],
      env: 'Node.js ≥ 18，或直接使用远程服务 URL（无需本地环境）。',
      install: '1. `npx -y @modelcontextprotocol/server-brave-search`\n2. 配置环境变量 `BRAVE_API_KEY`\n3. 在 Agent 的 MCP 配置中加入该 server',
      config: '{\n  "mcpServers": {\n    "brave-search": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-brave-search"],\n      "env": { "BRAVE_API_KEY": "你的-API-Key" }\n    }\n  }\n}',
      verify: '让 Agent 执行一次搜索（如「搜索今天的天气」），应返回若干条带链接的结果。若报 401，检查 API Key。',
      seedData: ['Brave Search API Key — 在 https://brave.com/search/api 免费申请'],
      notes: '免费额度每月有限，超出需付费。搜索结果来自公开网页，请自行甄别。',
    }),
  },
  {
    slug: 'firecrawl', name: 'Firecrawl MCP', oneLiner: '把任意网页/整站抓成干净的 Markdown，喂给 AI 不再有杂乱 HTML。',
    deployMethod: 'both', reviewStatus: 'verified', agentMdStatus: 'ok',
    stars: 9400, downloadCount: 511, likeCount: 73, originalAuthor: 'mendableai',
    repoUrl: 'https://github.com/mendableai/firecrawl', license: 'MIT',
    supportedPlatforms: ['Claude Code', 'OpenClaw', 'Cursor', '讯飞星辰'],
    categories: ref('search/web-scraping'),
    descriptionMd: 'Firecrawl 能抓取单页或整站并转成结构化 Markdown，自动处理 JS 渲染、分页、反爬，适合给 AI 投喂网页内容。',
    lastRepoUpdate: '2026-05-10', createdAt: '2026-05-21',
    agentMd: buildAgentMd({
      name: 'Firecrawl MCP', deploy: '两者皆可',
      what: '抓取网页或整站并清洗为 Markdown，供 Agent 阅读分析，省去手动复制粘贴。',
      scenarios: ['把一篇长文档/博客抓下来总结', '抓取产品文档供 AI 问答', '采集竞品页面信息'],
      env: 'Node.js ≥ 18，或使用 Firecrawl 云端服务。',
      install: '1. 注册 Firecrawl 获取 API Key\n2. 在 MCP 配置中加入 firecrawl server\n3. 重启 Agent',
      config: '{\n  "mcpServers": {\n    "firecrawl": {\n      "command": "npx",\n      "args": ["-y", "firecrawl-mcp"],\n      "env": { "FIRECRAWL_API_KEY": "fc-你的Key" }\n    }\n  }\n}',
      verify: '让 Agent 抓取一个公开网页 URL，应返回该页的 Markdown 正文。',
      seedData: ['Firecrawl API Key — 在 firecrawl.dev 申请', '要抓取的目标网址'],
      notes: '抓取请遵守目标网站的 robots 与版权要求；大站整站抓取会消耗较多额度。',
    }),
  },
  {
    slug: 'wikipedia', name: 'Wikipedia MCP', oneLiner: '让 AI 直接查维基百科，回答带权威出处。',
    deployMethod: 'remote', reviewStatus: 'basic', agentMdStatus: 'ok',
    stars: 320, downloadCount: 198, likeCount: 31, originalAuthor: 'rudra-ravi',
    repoUrl: 'https://github.com/rudra-ravi/wikipedia-mcp', license: 'MIT',
    supportedPlatforms: ['Kimi', '通义千问', 'Claude.ai', 'ChatGPT'],
    categories: ref('search/knowledge'),
    descriptionMd: '提供维基百科条目检索与正文抓取，Agent 可据此给出有出处的事实性回答。',
    lastRepoUpdate: '2026-03-15', createdAt: '2026-05-19',
    agentMd: buildAgentMd({
      name: 'Wikipedia MCP', deploy: '远程服务',
      what: '检索并读取维基百科条目，为事实性问题提供权威来源。',
      scenarios: ['查人物/事件/概念的百科解释', '为回答补充权威出处'],
      env: '无需本地环境，接入远程 MCP URL 即可。',
      install: '在 Agent 的 MCP 连接器中填入远程服务 URL 即可，无需安装。',
      config: '{\n  "mcpServers": {\n    "wikipedia": { "url": "https://wikipedia-mcp.example.com/sse" }\n  }\n}',
      verify: '让 Agent 查询「人工智能」条目，应返回摘要与链接。',
      seedData: ['无（公开数据，无需密钥）'],
      notes: '维基内容由社区编辑，重要结论请交叉验证。',
    }),
  },
  {
    slug: 'filesystem', name: 'Filesystem MCP', oneLiner: '给 AI 读写本地文件和目录的能力，整理资料、批量改名都行。',
    deployMethod: 'local', reviewStatus: 'verified', agentMdStatus: 'ok',
    stars: 2150, downloadCount: 880, likeCount: 120, originalAuthor: 'modelcontextprotocol',
    repoUrl: 'https://github.com/modelcontextprotocol/servers', license: 'MIT',
    supportedPlatforms: ['Claude Code', 'OpenClaw', 'Cursor', 'Windsurf'],
    categories: ref('files/filesystem'),
    descriptionMd: '官方 Filesystem server，在你授权的目录范围内读写文件、列目录、移动改名，是本地自动化的基础件。',
    lastRepoUpdate: '2026-05-01', createdAt: '2026-05-18',
    agentMd: buildAgentMd({
      name: 'Filesystem MCP', deploy: '本地部署',
      what: '让 Agent 在指定目录内读写文件、列目录、批量操作，是本地文件自动化的地基。',
      scenarios: ['批量整理/重命名文件', '让 AI 读本地资料再总结', '生成文件并保存到本地'],
      env: 'Node.js ≥ 18，仅支持本地运行（需访问本机文件）。',
      install: '1. `npx -y @modelcontextprotocol/server-filesystem /你的/工作目录`\n2. 在 MCP 配置中加入并指定允许访问的目录',
      config: '{\n  "mcpServers": {\n    "filesystem": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/you/work"]\n    }\n  }\n}',
      verify: '让 Agent 列出工作目录下的文件，应返回真实文件列表。',
      seedData: ['允许 Agent 访问的工作目录路径'],
      notes: '⚠️ 务必限定可访问目录，不要把整个磁盘根目录交给 Agent。',
    }),
  },
  {
    slug: 'pandoc', name: 'Pandoc MCP', oneLiner: 'Markdown / Word / PDF 互转，文档格式一键搞定。',
    deployMethod: 'local', reviewStatus: 'basic', agentMdStatus: 'ok',
    stars: 410, downloadCount: 153, likeCount: 19, originalAuthor: 'vivekVells',
    repoUrl: 'https://github.com/vivekVells/mcp-pandoc', license: 'MIT',
    supportedPlatforms: ['Claude Code', 'OpenClaw'],
    categories: ref('files/document'),
    descriptionMd: '封装 Pandoc，让 Agent 在 Markdown、Word、PDF、HTML 等格式间转换文档。',
    lastRepoUpdate: '2026-04-02', createdAt: '2026-05-17',
    agentMd: buildAgentMd({
      name: 'Pandoc MCP', deploy: '本地部署',
      what: '让 Agent 调用 Pandoc 完成文档格式转换。',
      scenarios: ['把 Markdown 笔记导出成 Word 交付', '把报告转成 PDF'],
      env: '需本机安装 Pandoc；PDF 输出需 LaTeX。',
      install: '1. 安装 Pandoc（`brew install pandoc` 等）\n2. `npx -y mcp-pandoc`\n3. 加入 MCP 配置',
      config: '{\n  "mcpServers": {\n    "pandoc": { "command": "npx", "args": ["-y", "mcp-pandoc"] }\n  }\n}',
      verify: '让 Agent 把一段 Markdown 转成 docx，检查生成的文件能正常打开。',
      seedData: ['待转换的源文件路径与目标格式'],
      notes: 'PDF 输出依赖 LaTeX 环境，首次配置稍繁琐。',
    }),
  },
  {
    slug: 'postgres', name: 'PostgreSQL MCP', oneLiner: '让 AI 用自然语言查 Postgres 数据库，只读安全。',
    deployMethod: 'local', reviewStatus: 'verified', agentMdStatus: 'ok',
    stars: 1670, downloadCount: 430, likeCount: 64, originalAuthor: 'modelcontextprotocol',
    repoUrl: 'https://github.com/modelcontextprotocol/servers', license: 'MIT',
    supportedPlatforms: ['Claude Code', 'Cursor', 'OpenClaw'],
    categories: ref('data/sql'),
    descriptionMd: '连接 PostgreSQL，让 Agent 探查表结构并执行只读查询，把「写 SQL」变成「说人话」。',
    lastRepoUpdate: '2026-04-20', createdAt: '2026-05-16',
    agentMd: buildAgentMd({
      name: 'PostgreSQL MCP', deploy: '本地部署',
      what: '连接 Postgres，让 Agent 读表结构、执行只读查询，用自然语言完成数据分析。',
      scenarios: ['让 AI 查业务数据出报表', '探索陌生数据库的表结构'],
      env: 'Node.js ≥ 18，可访问目标数据库的网络。',
      install: '1. `npx -y @modelcontextprotocol/server-postgres "连接串"`\n2. 加入 MCP 配置',
      config: '{\n  "mcpServers": {\n    "postgres": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://user:pass@host/db"]\n    }\n  }\n}',
      verify: '让 Agent 列出数据库中的表，应返回真实表名。',
      seedData: ['数据库连接串（host、库名、只读账号密码）'],
      notes: '强烈建议使用只读账号，避免 Agent 误改数据。',
    }),
  },
  {
    slug: 'qdrant', name: 'Qdrant MCP', oneLiner: '给 AI 一个向量记忆库，存取语义相似的内容。',
    deployMethod: 'both', reviewStatus: 'basic', agentMdStatus: 'ok',
    stars: 980, downloadCount: 167, likeCount: 22, originalAuthor: 'qdrant',
    repoUrl: 'https://github.com/qdrant/mcp-server-qdrant', license: 'Apache-2.0',
    supportedPlatforms: ['Claude Code', 'OpenClaw', 'Dify'],
    categories: ref('data/nosql', 'ai/memory'),
    descriptionMd: '基于 Qdrant 向量数据库的语义存取，Agent 可把信息存入并按语义检索，构建长期记忆。',
    lastRepoUpdate: '2026-04-25', createdAt: '2026-05-15',
    agentMd: buildAgentMd({
      name: 'Qdrant MCP', deploy: '两者皆可',
      what: '把文本以向量形式存入 Qdrant 并按语义检索，给 Agent 做长期记忆/知识库。',
      scenarios: ['为 Agent 建可检索的长期记忆', '语义搜索历史笔记'],
      env: 'Python ≥ 3.10 或 Docker；可用本地或云端 Qdrant。',
      install: '1. 启动 Qdrant（Docker 或云端）\n2. `uvx mcp-server-qdrant`\n3. 配置连接地址',
      config: '{\n  "mcpServers": {\n    "qdrant": {\n      "command": "uvx",\n      "args": ["mcp-server-qdrant"],\n      "env": { "QDRANT_URL": "http://localhost:6333" }\n    }\n  }\n}',
      verify: '存入一条文本再语义检索，应能召回该条。',
      seedData: ['Qdrant 服务地址（本地或云端 URL + API Key）'],
      notes: '云端 Qdrant 有免费额度；向量维度需与所用嵌入模型匹配。',
    }),
  },
  {
    slug: 'slack', name: 'Slack MCP', oneLiner: '让 AI 收发 Slack 消息、读频道，团队协作自动化。',
    deployMethod: 'remote', reviewStatus: 'basic', agentMdStatus: 'ok',
    stars: 760, downloadCount: 142, likeCount: 18, originalAuthor: 'modelcontextprotocol',
    repoUrl: 'https://github.com/modelcontextprotocol/servers', license: 'MIT',
    supportedPlatforms: ['Kimi', '通义千问', 'Claude.ai'],
    categories: ref('social/im'),
    descriptionMd: '让 Agent 读取频道消息、发送通知、检索历史，把团队沟通接入 AI 流程。',
    lastRepoUpdate: '2026-03-30', createdAt: '2026-05-14',
    agentMd: buildAgentMd({
      name: 'Slack MCP', deploy: '远程服务',
      what: '让 Agent 读写 Slack 频道消息，做通知与协作自动化。',
      scenarios: ['把任务结果推送到团队频道', '让 AI 汇总频道讨论'],
      env: '需要一个 Slack App 的 Bot Token。',
      install: '在 Slack 创建 App、获取 Bot Token，填入远程 MCP 服务配置。',
      config: '{\n  "mcpServers": {\n    "slack": { "url": "https://slack-mcp.example.com/sse", "env": { "SLACK_BOT_TOKEN": "xoxb-..." } }\n  }\n}',
      verify: '让 Agent 向测试频道发一条消息，频道里应收到。',
      seedData: ['Slack Bot Token（xoxb-…）', '目标频道 ID'],
      notes: '注意 Bot 的频道权限范围，避免越权读取私密频道。',
    }),
  },
  {
    slug: 'gmail', name: 'Gmail MCP', oneLiner: '让 AI 读邮件、起草回复、整理收件箱。',
    deployMethod: 'remote', reviewStatus: 'basic', agentMdStatus: 'ok',
    stars: 1240, downloadCount: 305, likeCount: 47, originalAuthor: 'GongRzhe',
    repoUrl: 'https://github.com/GongRzhe/Gmail-MCP-Server', license: 'MIT',
    supportedPlatforms: ['Kimi', '通义千问', 'Claude.ai', 'ChatGPT'],
    categories: ref('social/email'),
    descriptionMd: '接入 Gmail，让 Agent 检索邮件、起草与发送、打标签归档，做邮箱助理。',
    lastRepoUpdate: '2026-04-12', createdAt: '2026-05-13',
    agentMd: buildAgentMd({
      name: 'Gmail MCP', deploy: '远程服务',
      what: '让 Agent 管理 Gmail 邮件：检索、起草、发送、归档。',
      scenarios: ['让 AI 汇总今日未读邮件', '起草回复后由你确认发送'],
      env: '需 Google OAuth 凭证。',
      install: '配置 Google Cloud OAuth、授权账户，填入服务配置。',
      config: '{\n  "mcpServers": {\n    "gmail": { "url": "https://gmail-mcp.example.com/sse" }\n  }\n}',
      verify: '让 Agent 列出最近 5 封邮件标题，应返回真实邮件。',
      seedData: ['Google OAuth 授权（按引导一次性完成）'],
      notes: '⚠️ 涉及隐私邮件，建议先用「仅起草不自动发送」模式。',
    }),
  },
  {
    slug: 'github', name: 'GitHub MCP', oneLiner: '让 AI 管理 GitHub 仓库、Issue、PR，开发流程全打通。',
    deployMethod: 'both', reviewStatus: 'verified', agentMdStatus: 'ok',
    stars: 12800, downloadCount: 1024, likeCount: 210, originalAuthor: 'github',
    repoUrl: 'https://github.com/github/github-mcp-server', license: 'MIT',
    supportedPlatforms: ['Claude Code', 'Cursor', 'OpenClaw', 'Windsurf', '通义千问'],
    categories: ref('dev/repo'),
    descriptionMd: 'GitHub 官方 MCP server，让 Agent 读写仓库、管理 Issue 与 PR、查 CI，是开发自动化的核心件。',
    lastRepoUpdate: '2026-05-12', createdAt: '2026-05-22',
    agentMd: buildAgentMd({
      name: 'GitHub MCP', deploy: '两者皆可',
      what: '让 Agent 操作 GitHub：读写代码、管理 Issue/PR、查看 CI 状态。',
      scenarios: ['让 AI 帮你提 PR、回评论', '汇总仓库待办 Issue'],
      env: 'Node.js ≥ 18 或使用官方远程服务；需 GitHub Token。',
      install: '1. 生成 GitHub Personal Access Token\n2. 配置 server 与 Token\n3. 重启 Agent',
      config: '{\n  "mcpServers": {\n    "github": {\n      "command": "npx",\n      "args": ["-y", "@github/github-mcp-server"],\n      "env": { "GITHUB_TOKEN": "ghp_..." }\n    }\n  }\n}',
      verify: '让 Agent 列出某仓库的最近 Issue，应返回真实数据。',
      seedData: ['GitHub Personal Access Token（按需勾选权限）', '目标仓库 owner/name'],
      notes: 'Token 权限按最小化原则勾选；不要授予不必要的写权限。',
    }),
  },
  {
    slug: 'cloudflare', name: 'Cloudflare MCP', oneLiner: '让 AI 管理 Cloudflare 的 Workers、D1、KV、R2。',
    deployMethod: 'remote', reviewStatus: 'basic', agentMdStatus: 'ok',
    stars: 1530, downloadCount: 221, likeCount: 35, originalAuthor: 'cloudflare',
    repoUrl: 'https://github.com/cloudflare/mcp-server-cloudflare', license: 'Apache-2.0',
    supportedPlatforms: ['Claude Code', 'Cursor', 'Claude.ai'],
    categories: ref('dev/cloud'),
    descriptionMd: 'Cloudflare 官方 MCP，让 Agent 查询与管理 Workers、D1 数据库、KV、R2 等云资源。',
    lastRepoUpdate: '2026-05-05', createdAt: '2026-05-12',
    agentMd: buildAgentMd({
      name: 'Cloudflare MCP', deploy: '远程服务',
      what: '让 Agent 管理 Cloudflare 云资源：Workers、D1、KV、R2 等。',
      scenarios: ['让 AI 查 Worker 日志/配置', '管理 D1 数据库'],
      env: '需 Cloudflare 账户授权（OAuth）。',
      install: '在 Agent 中连接 Cloudflare 远程 MCP 并完成 OAuth 授权。',
      config: '{\n  "mcpServers": {\n    "cloudflare": { "url": "https://mcp.cloudflare.com/sse" }\n  }\n}',
      verify: '让 Agent 列出账户下的 Workers，应返回真实列表。',
      seedData: ['Cloudflare 账户 OAuth 授权'],
      notes: '管理类操作有风险，建议先在测试账户演练。',
    }),
  },
  {
    slug: 'notion', name: 'Notion MCP', oneLiner: '让 AI 读写 Notion 页面与数据库，知识库自动化。',
    deployMethod: 'remote', reviewStatus: 'basic', agentMdStatus: 'ok',
    stars: 2240, downloadCount: 388, likeCount: 59, originalAuthor: 'makenotion',
    repoUrl: 'https://github.com/makenotion/notion-mcp-server', license: 'MIT',
    supportedPlatforms: ['Kimi', '通义千问', 'Claude.ai', 'Dify'],
    categories: ref('office/notes', 'office/project'),
    descriptionMd: 'Notion 官方 MCP，让 Agent 检索、创建、更新页面与数据库条目，把知识库接入 AI。',
    lastRepoUpdate: '2026-04-30', createdAt: '2026-05-11',
    agentMd: buildAgentMd({
      name: 'Notion MCP', deploy: '远程服务',
      what: '让 Agent 读写 Notion 页面与数据库，做知识库与项目记录自动化。',
      scenarios: ['让 AI 把会议纪要写进 Notion', '从 Notion 数据库查任务'],
      env: '需 Notion Integration Token 并授权目标页面。',
      install: '创建 Notion Integration、分享目标页面给它，填入 Token。',
      config: '{\n  "mcpServers": {\n    "notion": { "url": "https://notion-mcp.example.com/sse", "env": { "NOTION_TOKEN": "secret_..." } }\n  }\n}',
      verify: '让 Agent 在测试页面新建一条记录，Notion 中应出现。',
      seedData: ['Notion Integration Token', '已授权的目标页面/数据库'],
      notes: '记得把 Integration 分享给具体页面，否则无权访问。',
    }),
  },
  {
    slug: 'weather', name: 'Weather MCP', oneLiner: '让 AI 查实时天气与预报。',
    deployMethod: 'remote', reviewStatus: 'verified', agentMdStatus: 'ok',
    stars: 540, downloadCount: 276, likeCount: 40, originalAuthor: 'modelcontextprotocol',
    repoUrl: 'https://github.com/modelcontextprotocol/servers', license: 'MIT',
    supportedPlatforms: ['Kimi', '通义千问', 'Claude.ai', 'ChatGPT'],
    categories: ref('life/weather'),
    descriptionMd: '查询指定地点的实时天气与多日预报，给 Agent 加上「看天」能力。',
    lastRepoUpdate: '2026-04-18', createdAt: '2026-05-10',
    agentMd: buildAgentMd({
      name: 'Weather MCP', deploy: '远程服务',
      what: '查询实时天气与预报。',
      scenarios: ['出行前问天气', '让 AI 根据天气给穿衣建议'],
      env: '无需本地环境；部分实现需天气 API Key。',
      install: '接入远程 MCP URL（如需 Key 则一并配置）。',
      config: '{\n  "mcpServers": {\n    "weather": { "url": "https://weather-mcp.example.com/sse" }\n  }\n}',
      verify: '让 Agent 查「北京今天天气」，应返回温度与天气状况。',
      seedData: ['（视实现）天气服务 API Key'],
      notes: '不同数据源覆盖地区与精度不同。',
    }),
  },
  {
    slug: 'time', name: 'Time MCP', oneLiner: '时区转换、当前时间、时间换算，小而实用。',
    deployMethod: 'local', reviewStatus: 'verified', agentMdStatus: 'ok',
    stars: 380, downloadCount: 190, likeCount: 25, originalAuthor: 'modelcontextprotocol',
    repoUrl: 'https://github.com/modelcontextprotocol/servers', license: 'MIT',
    supportedPlatforms: ['Claude Code', 'OpenClaw', 'Cursor'],
    categories: ref('life/time'),
    descriptionMd: '提供当前时间、时区转换与时间换算，弥补大模型不知「现在几点」的短板。',
    lastRepoUpdate: '2026-03-22', createdAt: '2026-05-09',
    agentMd: buildAgentMd({
      name: 'Time MCP', deploy: '本地部署',
      what: '提供当前时间与时区转换。',
      scenarios: ['跨时区安排会议', '让 AI 知道「现在」'],
      env: 'Node.js ≥ 18，本地运行。',
      install: '`npx -y @modelcontextprotocol/server-time` 并加入配置。',
      config: '{\n  "mcpServers": {\n    "time": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-time"] }\n  }\n}',
      verify: '让 Agent 报出当前 UTC 时间，应正确。',
      seedData: ['（可选）默认时区'],
      notes: '无外部依赖，轻量安全。',
    }),
  },
  {
    slug: 'memory', name: 'Memory MCP', oneLiner: '给 AI 一个知识图谱式长期记忆，跨会话记住你。',
    deployMethod: 'local', reviewStatus: 'verified', agentMdStatus: 'ok',
    stars: 1980, downloadCount: 612, likeCount: 95, originalAuthor: 'modelcontextprotocol',
    repoUrl: 'https://github.com/modelcontextprotocol/servers', license: 'MIT',
    supportedPlatforms: ['Claude Code', 'OpenClaw', 'Cursor', 'Windsurf'],
    categories: ref('ai/memory'),
    descriptionMd: '基于知识图谱的长期记忆 server，Agent 可把实体与关系存下来，跨会话保持对你的了解。',
    lastRepoUpdate: '2026-05-08', createdAt: '2026-05-08',
    agentMd: buildAgentMd({
      name: 'Memory MCP', deploy: '本地部署',
      what: '用知识图谱记录实体与关系，给 Agent 跨会话的长期记忆。',
      scenarios: ['让 AI 记住你的偏好与项目背景', '构建个人知识图谱'],
      env: 'Node.js ≥ 18，本地运行（数据存本地）。',
      install: '`npx -y @modelcontextprotocol/server-memory` 并加入配置。',
      config: '{\n  "mcpServers": {\n    "memory": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-memory"] }\n  }\n}',
      verify: '让 Agent 记住一条事实，新开会话后再问，应能回忆。',
      seedData: ['（可选）记忆存储文件路径'],
      notes: '记忆存本地文件，注意备份与隐私。',
    }),
  },
  {
    slug: 'figma', name: 'Figma MCP', oneLiner: '让 AI 读取 Figma 设计稿，把设计转成代码。',
    deployMethod: 'remote', reviewStatus: 'basic', agentMdStatus: 'incomplete',
    stars: 670, downloadCount: 88, likeCount: 12, originalAuthor: 'GLips',
    repoUrl: 'https://github.com/GLips/Figma-Context-MCP', license: 'MIT',
    supportedPlatforms: ['Cursor', 'Windsurf', 'Claude Code'],
    categories: ref('creative/design'),
    descriptionMd: '读取 Figma 文件的图层与样式信息，供 Agent 还原为代码或理解设计意图。',
    lastRepoUpdate: '2026-02-28', createdAt: '2026-05-07',
    agentMd: null,
  },
];

export const plugins: PluginDetail[] = SEEDS.map((s, i) => ({
  id: i + 1,
  slug: s.slug,
  name: s.name,
  oneLiner: s.oneLiner,
  deployMethod: s.deployMethod,
  reviewStatus: s.reviewStatus,
  agentMdStatus: s.agentMdStatus,
  stars: s.stars,
  downloadCount: s.downloadCount,
  likeCount: s.likeCount,
  originalAuthor: s.originalAuthor,
  categories: s.categories,
  lastRepoUpdate: s.lastRepoUpdate,
  updatedAt: s.lastRepoUpdate,
  descriptionMd: s.descriptionMd,
  agentMd: s.agentMd,
  repoUrl: s.repoUrl,
  originalAuthorUrl: `https://github.com/${s.originalAuthor}`,
  supportedPlatforms: s.supportedPlatforms,
  license: s.license,
  createdAt: s.createdAt,
}));
