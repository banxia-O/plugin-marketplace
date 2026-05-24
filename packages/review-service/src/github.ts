/** 允许收录的 SPDX 许可证（宽松型开源许可证） */
const ALLOWED_LICENSES = new Set([
  'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause',
  'ISC', 'Unlicense', 'CC0-1.0', '0BSD', 'WTFPL',
]);

/** 明确拒绝的许可证（Copyleft） */
const REJECTED_LICENSES = new Set([
  'GPL-2.0', 'GPL-3.0', 'GPL-2.0-only', 'GPL-3.0-only',
  'AGPL-1.0', 'AGPL-3.0', 'AGPL-3.0-only',
  'LGPL-2.0', 'LGPL-2.1', 'LGPL-3.0',
  'SSPL-1.0', 'CC-BY-SA-4.0', 'OSL-3.0',
]);

export interface RepoMeta {
  owner: string;
  repo: string;
  fullName: string;
  description: string | null;
  license: string | null;       // SPDX id
  stars: number;
  pushedAt: string | null;
  defaultBranch: string;
  isPrivate: boolean;
  isArchived: boolean;
  ownerUrl: string;
}

export interface LicenseCheckResult {
  allowed: boolean;
  reason?: string;
}

export interface ReadmeResult {
  content: string;
  adequate: boolean; // ≥200 chars AND has at least one heading
}

function makeHeaders(token: string): Record<string, string> {
  const h: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'plugin-marketplace-review/1.0',
  };
  if (token) h['authorization'] = `Bearer ${token}`;
  return h;
}

/** owner/repo 从 GitHub URL 中提取 */
export function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com\/([^/]+)\/([^/?#]+?)(?:\.git)?(?:[/?#]|$)/);
  if (!m || !m[1] || !m[2]) return null;
  return { owner: m[1], repo: m[2] };
}

export async function fetchRepoMeta(owner: string, repo: string, token: string): Promise<RepoMeta> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: makeHeaders(token),
  });
  if (res.status === 404) throw new Error(`仓库 ${owner}/${repo} 不存在或已设为私有`);
  if (!res.ok) throw new Error(`GitHub API 返回 ${res.status}`);
  const d = (await res.json()) as {
    full_name: string;
    description: string | null;
    private: boolean;
    archived: boolean;
    license: { spdx_id: string } | null;
    stargazers_count: number;
    pushed_at: string | null;
    default_branch: string;
    owner: { html_url: string };
  };
  return {
    owner,
    repo,
    fullName: d.full_name,
    description: d.description,
    license: d.license?.spdx_id ?? null,
    stars: d.stargazers_count,
    pushedAt: d.pushed_at,
    defaultBranch: d.default_branch,
    isPrivate: d.private,
    isArchived: d.archived,
    ownerUrl: d.owner.html_url,
  };
}

export function checkLicense(spdxId: string | null): LicenseCheckResult {
  if (!spdxId || spdxId === 'NOASSERTION') {
    return { allowed: false, reason: '仓库未声明许可证，或许可证无法识别' };
  }
  if (REJECTED_LICENSES.has(spdxId)) {
    return { allowed: false, reason: `${spdxId} 属于 Copyleft 许可证，不符合收录条件` };
  }
  if (!ALLOWED_LICENSES.has(spdxId)) {
    // 未知许可证，宽松处理：允许收录但标为 basic
    return { allowed: true };
  }
  return { allowed: true };
}

export async function fetchReadme(owner: string, repo: string, token: string): Promise<ReadmeResult> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
    headers: makeHeaders(token),
  });
  if (!res.ok) return { content: '', adequate: false };
  const d = (await res.json()) as { content: string; encoding: string };
  const raw = d.encoding === 'base64' ? Buffer.from(d.content, 'base64').toString('utf-8') : d.content;
  const adequate = raw.length >= 200 && /^#{1,3} /m.test(raw);
  return { content: raw, adequate };
}

/** 检查仓库根目录是否存在 agent.md，存在则返回文本内容 */
export async function fetchAgentMd(owner: string, repo: string, token: string): Promise<string | null> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/agent.md`, {
    headers: makeHeaders(token),
  });
  if (!res.ok) return null;
  const d = (await res.json()) as { content?: string; encoding?: string };
  if (!d.content) return null;
  return d.encoding === 'base64' ? Buffer.from(d.content, 'base64').toString('utf-8') : d.content;
}

/** 获取 package.json 前 2000 字符用于安全扫描 */
export async function fetchPackageJson(owner: string, repo: string, token: string): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/package.json`, {
    headers: makeHeaders(token),
  });
  if (!res.ok) return '';
  const d = (await res.json()) as { content?: string; encoding?: string };
  if (!d.content) return '';
  const text = d.encoding === 'base64' ? Buffer.from(d.content, 'base64').toString('utf-8') : (d.content ?? '');
  return text.slice(0, 2000);
}
