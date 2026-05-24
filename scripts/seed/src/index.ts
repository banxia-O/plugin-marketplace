// 冷启动种子脚本。
// 扫一份精选候选清单 → 按 许可证 / 星标 / 更新时间 预筛 → 以「种子用户」身份
// 提交到 Worker 的 /api/submissions，由 review-service 跑管线生成 agent.md 并入库。
//
// 用法：先 `pnpm --filter @ppx/seed build`，再 `node scripts/seed/dist/index.js`
// 需要 Worker（已设 REVIEW_SERVICE_URL）和 review-service 都在运行才能完整入库；
// 否则提交会停在 queued。配置见下方 env。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { DeployMethod } from '@ppx/shared';

const WORKER_URL = process.env['WORKER_URL'] ?? 'http://localhost:8787';
const SEED_USERNAME = process.env['SEED_USERNAME'] ?? 'seed-bot';
const SEED_PASSWORD = process.env['SEED_PASSWORD'] ?? 'seed-bot-cold-start-2026';
const GITHUB_TOKEN = process.env['GITHUB_TOKEN'] ?? '';
const MIN_STARS = Number(process.env['MIN_STARS'] ?? 50);
const MAX_AGE_MONTHS = Number(process.env['MAX_AGE_MONTHS'] ?? 3);
const DRY_RUN = process.env['DRY_RUN'] === '1';

const ALLOWED_LICENSES = new Set([
  'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Unlicense', 'CC0-1.0', '0BSD',
]);

interface Candidate {
  repoUrl: string;
  name: string;
  oneLiner: string;
  subcategorySlugs: string[];
  deployMethod: DeployMethod;
}

interface RepoMeta {
  stars: number;
  pushedAt: string | null;
  license: string | null;
  owner: string;
  isPrivate: boolean;
  isArchived: boolean;
}

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'plugin-marketplace-seed/1.0',
  };
  if (GITHUB_TOKEN) h['authorization'] = `Bearer ${GITHUB_TOKEN}`;
  return h;
}

function parseRepo(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com\/([^/]+)\/([^/?#]+?)(?:\.git)?(?:[/?#]|$)/);
  return m && m[1] && m[2] ? { owner: m[1], repo: m[2] } : null;
}

function loadCandidates(): Candidate[] {
  const path = process.env['SEED_CANDIDATES'] ?? fileURLToPath(new URL('../data/candidates.json', import.meta.url));
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
  if (!Array.isArray(raw)) throw new Error('candidates.json 必须是数组');
  return raw.map((c, i) => {
    const o = c as Partial<Candidate>;
    if (!o.repoUrl || !o.name || !o.oneLiner || !Array.isArray(o.subcategorySlugs) || !o.deployMethod) {
      throw new Error(`candidates[${i}] 字段缺失`);
    }
    return o as Candidate;
  });
}

async function authenticate(): Promise<string> {
  const reg = await fetch(`${WORKER_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: SEED_USERNAME, password: SEED_PASSWORD }),
  });
  if (reg.ok) return ((await reg.json()) as { token: string }).token;

  const login = await fetch(`${WORKER_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: SEED_USERNAME, password: SEED_PASSWORD }),
  });
  if (!login.ok) throw new Error(`种子用户认证失败：${login.status} ${await login.text()}`);
  return ((await login.json()) as { token: string }).token;
}

async function fetchSubcategoryMap(): Promise<Map<string, number>> {
  const res = await fetch(`${WORKER_URL}/api/categories`);
  if (!res.ok) throw new Error(`拉取分类失败：${res.status}`);
  const data = (await res.json()) as { categories: Array<{ subcategories: Array<{ id: number; slug: string }> }> };
  const map = new Map<string, number>();
  for (const cat of data.categories) for (const sub of cat.subcategories) map.set(sub.slug, sub.id);
  return map;
}

async function fetchRepoMeta(owner: string, repo: string): Promise<RepoMeta | null> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: ghHeaders() });
  if (!res.ok) return null;
  const d = (await res.json()) as {
    stargazers_count: number;
    pushed_at: string | null;
    license: { spdx_id: string } | null;
    private: boolean;
    archived: boolean;
    owner: { login: string };
  };
  return {
    stars: d.stargazers_count,
    pushedAt: d.pushed_at,
    license: d.license?.spdx_id ?? null,
    owner: d.owner.login,
    isPrivate: d.private,
    isArchived: d.archived,
  };
}

function passesFilter(meta: RepoMeta): { ok: boolean; reason?: string } {
  if (meta.isPrivate) return { ok: false, reason: '私有仓库' };
  if (meta.isArchived) return { ok: false, reason: '已归档' };
  if (meta.stars < MIN_STARS) return { ok: false, reason: `星标 ${meta.stars} < ${MIN_STARS}` };
  if (!meta.license || !ALLOWED_LICENSES.has(meta.license)) {
    return { ok: false, reason: `许可证 ${meta.license ?? '无'} 不在白名单` };
  }
  if (meta.pushedAt) {
    const ageMonths = (Date.now() - new Date(meta.pushedAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (ageMonths > MAX_AGE_MONTHS) return { ok: false, reason: `${ageMonths.toFixed(1)} 个月未更新` };
  }
  return { ok: true };
}

async function submit(token: string, c: Candidate, subcategoryIds: number[], owner: string): Promise<number> {
  const res = await fetch(`${WORKER_URL}/api/submissions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      repoUrl: c.repoUrl,
      name: c.name,
      oneLiner: c.oneLiner,
      subcategoryIds,
      deployMethod: c.deployMethod,
      originalAuthor: owner,
    }),
  });
  return res.status;
}

async function main(): Promise<void> {
  console.log(`[seed] Worker=${WORKER_URL} 过滤：星标≥${MIN_STARS} 近${MAX_AGE_MONTHS}月更新 ${DRY_RUN ? '(DRY RUN)' : ''}`);
  const candidates = loadCandidates();
  console.log(`[seed] 载入 ${candidates.length} 个候选`);

  const token = DRY_RUN ? '' : await authenticate();
  const subMap = await fetchSubcategoryMap();

  const stats = { submitted: 0, duplicate: 0, filtered: 0, error: 0 };

  for (const c of candidates) {
    const parsed = parseRepo(c.repoUrl);
    if (!parsed) {
      console.log(`  ✗ ${c.name}：URL 无法解析`);
      stats.error += 1;
      continue;
    }
    const subcategoryIds = c.subcategorySlugs.map((s) => subMap.get(s)).filter((id): id is number => id !== undefined);
    if (subcategoryIds.length === 0) {
      console.log(`  ✗ ${c.name}：分类 slug 无一命中（${c.subcategorySlugs.join(',')}）`);
      stats.error += 1;
      continue;
    }

    const meta = await fetchRepoMeta(parsed.owner, parsed.repo);
    if (!meta) {
      console.log(`  ✗ ${c.name}：GitHub 仓库不可访问`);
      stats.filtered += 1;
      continue;
    }
    const filter = passesFilter(meta);
    if (!filter.ok) {
      console.log(`  – ${c.name}：跳过（${filter.reason}）`);
      stats.filtered += 1;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  ✓ ${c.name}：通过预筛（★${meta.stars} ${meta.license}）`);
      stats.submitted += 1;
      continue;
    }

    const status = await submit(token, c, subcategoryIds, meta.owner);
    if (status === 202) {
      console.log(`  ✓ ${c.name}：已提交审核`);
      stats.submitted += 1;
    } else if (status === 409) {
      console.log(`  · ${c.name}：已存在，跳过`);
      stats.duplicate += 1;
    } else {
      console.log(`  ✗ ${c.name}：提交失败 HTTP ${status}`);
      stats.error += 1;
    }
  }

  console.log(
    `[seed] 完成：提交 ${stats.submitted}，重复 ${stats.duplicate}，过滤 ${stats.filtered}，失败 ${stats.error}`,
  );
}

main().catch((err) => {
  console.error('[seed] 致命错误:', err);
  process.exit(1);
});
