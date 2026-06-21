import type {
  Category,
  PluginCategoryRef,
  PluginDetail,
  PluginListQuery,
  PluginSummary,
  ReviewPluginData,
  Subcategory,
} from '@ppx/shared';

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  icon: string;
  sort_order: number;
}

interface SubcategoryRow {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  sort_order: number;
}

interface PluginRow {
  id: number;
  name: string;
  slug: string;
  one_liner: string;
  description_md: string;
  repo_url: string;
  agent_md: string | null;
  agent_md_status: PluginDetail['agentMdStatus'];
  deploy_method: PluginDetail['deployMethod'];
  supported_platforms: string;
  license: string;
  original_author: string;
  original_author_url: string | null;
  review_status: PluginDetail['reviewStatus'];
  stars: number;
  download_count: number;
  like_count: number;
  last_repo_update: string | null;
  created_at: string;
  updated_at: string;
}

interface CategoryRefRow extends PluginCategoryRef {
  plugin_id: number;
}

export interface UserRow {
  id: number;
  username: string;
  email: string | null;
  password_hash: string | null;
  github_id: number | null;
  github_login: string | null;
  avatar_url: string | null;
  created_at: string;
}

export async function findUserById(db: D1Database, id: number): Promise<UserRow | null> {
  return (await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>()) ?? null;
}

/** 按用户名或邮箱查找；登录时把用户输入同时当作两者匹配 */
export async function findUserByUsernameOrEmail(
  db: D1Database,
  username: string,
  email: string | null,
): Promise<UserRow | null> {
  if (email) {
    return (
      (await db
        .prepare('SELECT * FROM users WHERE username = ? OR email = ?')
        .bind(username, email)
        .first<UserRow>()) ?? null
    );
  }
  return (await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first<UserRow>()) ?? null;
}

export async function createUser(
  db: D1Database,
  input: { username: string; email: string | null; passwordHash: string },
): Promise<UserRow> {
  const row = await db
    .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?) RETURNING *')
    .bind(input.username, input.email, input.passwordHash)
    .first<UserRow>();
  return row as UserRow;
}

async function usernameTaken(db: D1Database, username: string): Promise<boolean> {
  return !!(await db.prepare('SELECT 1 AS x FROM users WHERE username = ?').bind(username).first());
}

async function emailTaken(db: D1Database, email: string): Promise<boolean> {
  return !!(await db.prepare('SELECT 1 AS x FROM users WHERE email = ?').bind(email).first());
}

/** github_login 可能与已有用户名冲突，逐次加后缀直到唯一 */
async function uniqueUsername(db: D1Database, base: string): Promise<string> {
  const seed = base.trim() || 'github-user';
  let candidate = seed;
  let n = 0;
  while (await usernameTaken(db, candidate)) {
    n += 1;
    candidate = `${seed}-${n}`;
  }
  return candidate;
}

export interface GithubProfile {
  id: number;
  login: string;
  avatarUrl: string | null;
  email: string | null;
}

/** 以 github_id 为唯一键 upsert；新建时回避用户名/邮箱唯一约束冲突 */
export async function upsertGithubUser(db: D1Database, gh: GithubProfile): Promise<UserRow> {
  const existing = await db
    .prepare('SELECT * FROM users WHERE github_id = ?')
    .bind(gh.id)
    .first<UserRow>();

  if (existing) {
    const updated = await db
      .prepare(
        'UPDATE users SET github_login = ?, avatar_url = ?, email = COALESCE(email, ?) WHERE github_id = ? RETURNING *',
      )
      .bind(gh.login, gh.avatarUrl, gh.email, gh.id)
      .first<UserRow>();
    return updated as UserRow;
  }

  const username = await uniqueUsername(db, gh.login);
  const email = gh.email && !(await emailTaken(db, gh.email)) ? gh.email : null;
  const created = await db
    .prepare(
      'INSERT INTO users (username, email, github_id, github_login, avatar_url) VALUES (?, ?, ?, ?, ?) RETURNING *',
    )
    .bind(username, email, gh.id, gh.login, gh.avatarUrl)
    .first<UserRow>();
  return created as UserRow;
}

export async function getCategories(db: D1Database): Promise<Category[]> {
  const cats = (await db.prepare('SELECT id, name, slug, icon, sort_order FROM categories ORDER BY sort_order').all<CategoryRow>()).results;
  const subs = (await db.prepare('SELECT id, category_id, name, slug, sort_order FROM subcategories ORDER BY sort_order').all<SubcategoryRow>()).results;

  const subsByCat = new Map<number, Subcategory[]>();
  for (const s of subs) {
    const list = subsByCat.get(s.category_id) ?? [];
    list.push({ id: s.id, categoryId: s.category_id, name: s.name, slug: s.slug, sortOrder: s.sort_order });
    subsByCat.set(s.category_id, list);
  }

  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    sortOrder: c.sort_order,
    subcategories: subsByCat.get(c.id) ?? [],
  }));
}

async function refsFor(db: D1Database, pluginIds: number[]): Promise<Map<number, PluginCategoryRef[]>> {
  const map = new Map<number, PluginCategoryRef[]>();
  if (pluginIds.length === 0) return map;
  const placeholders = pluginIds.map(() => '?').join(',');
  const rows = (
    await db
      .prepare(
        `SELECT pc.plugin_id AS plugin_id,
                c.slug AS categorySlug, c.name AS categoryName,
                s.slug AS subcategorySlug, s.name AS subcategoryName
         FROM plugin_categories pc
         JOIN subcategories s ON s.id = pc.subcategory_id
         JOIN categories c ON c.id = s.category_id
         WHERE pc.plugin_id IN (${placeholders})
         ORDER BY c.sort_order, s.sort_order`,
      )
      .bind(...pluginIds)
      .all<CategoryRefRow>()
  ).results;
  for (const r of rows) {
    const list = map.get(r.plugin_id) ?? [];
    list.push({
      categorySlug: r.categorySlug,
      categoryName: r.categoryName,
      subcategorySlug: r.subcategorySlug,
      subcategoryName: r.subcategoryName,
    });
    map.set(r.plugin_id, list);
  }
  return map;
}

function toSummary(row: PluginRow, categories: PluginCategoryRef[]): PluginSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    oneLiner: row.one_liner,
    repoUrl: row.repo_url,
    deployMethod: row.deploy_method,
    reviewStatus: row.review_status,
    agentMdStatus: row.agent_md_status,
    stars: row.stars,
    downloadCount: row.download_count,
    likeCount: row.like_count,
    originalAuthor: row.original_author,
    categories,
    lastRepoUpdate: row.last_repo_update,
    updatedAt: row.updated_at,
  };
}

const SORT_SQL: Record<PluginListQuery['sort'], string> = {
  comprehensive: 'download_count + like_count * 3 DESC, id DESC',
  newest: 'created_at DESC, id DESC',
  hottest: 'download_count DESC, id DESC',
  top_rated: 'like_count DESC, id DESC',
  trending: 'p.stars DESC, id DESC',
};

function buildWhere(query: PluginListQuery): { clause: string; args: unknown[] } {
  const conds: string[] = ["p.review_status != 'rejected'"];
  const args: unknown[] = [];

  if (query.category) {
    conds.push(
      `EXISTS (SELECT 1 FROM plugin_categories pc JOIN subcategories s ON s.id = pc.subcategory_id
               JOIN categories c ON c.id = s.category_id WHERE pc.plugin_id = p.id AND c.slug = ?)`,
    );
    args.push(query.category);
  }
  if (query.subcategory) {
    conds.push(
      `EXISTS (SELECT 1 FROM plugin_categories pc JOIN subcategories s ON s.id = pc.subcategory_id
               WHERE pc.plugin_id = p.id AND s.slug = ?)`,
    );
    args.push(query.subcategory);
  }
  if (query.deployMethod) {
    conds.push('p.deploy_method = ?');
    args.push(query.deployMethod);
  }
  if (query.q && query.q.trim()) {
    const like = `%${query.q.trim()}%`;
    conds.push(
      `(p.name LIKE ? OR p.one_liner LIKE ? OR p.description_md LIKE ?
        OR EXISTS (SELECT 1 FROM plugin_categories pc JOIN subcategories s ON s.id = pc.subcategory_id
                   JOIN categories c ON c.id = s.category_id
                   WHERE pc.plugin_id = p.id AND (c.name LIKE ? OR s.name LIKE ?)))`,
    );
    args.push(like, like, like, like, like);
  }

  return { clause: conds.join(' AND '), args };
}

export async function listPlugins(
  db: D1Database,
  query: PluginListQuery,
): Promise<{ plugins: PluginSummary[]; total: number }> {
  const { clause, args } = buildWhere(query);

  const totalRow = await db
    .prepare(`SELECT COUNT(*) AS n FROM plugins p WHERE ${clause}`)
    .bind(...args)
    .first<{ n: number }>();
  const total = totalRow?.n ?? 0;

  const offset = (query.page - 1) * query.pageSize;
  const rows = (
    await db
      .prepare(`SELECT * FROM plugins p WHERE ${clause} ORDER BY ${SORT_SQL[query.sort]} LIMIT ? OFFSET ?`)
      .bind(...args, query.pageSize, offset)
      .all<PluginRow>()
  ).results;

  const refs = await refsFor(db, rows.map((r) => r.id));
  const plugins = rows.map((r) => toSummary(r, refs.get(r.id) ?? []));
  return { plugins, total };
}

export async function getPluginBySlug(db: D1Database, slug: string): Promise<PluginDetail | null> {
  const row = await db.prepare('SELECT * FROM plugins WHERE slug = ?').bind(slug).first<PluginRow>();
  if (!row) return null;
  const refs = await refsFor(db, [row.id]);

  let platforms: string[] = [];
  try {
    platforms = JSON.parse(row.supported_platforms) as string[];
  } catch {
    platforms = [];
  }

  return {
    ...toSummary(row, refs.get(row.id) ?? []),
    descriptionMd: row.description_md,
    agentMd: row.agent_md,
    originalAuthorUrl: row.original_author_url,
    supportedPlatforms: platforms,
    license: row.license,
    createdAt: row.created_at,
  };
}

// ── Trending（飙升榜） ──────────────────────────────────────────────────────

interface TrendingRow extends PluginRow {
  star_delta: number;
}

export async function getTrendingPlugins(
  db: D1Database,
  limit = 8,
): Promise<PluginSummary[]> {
  const rows = (
    await db
      .prepare(
        `SELECT p.*, (p.stars - COALESCE(s.stars, p.stars)) AS star_delta
         FROM plugins p
         LEFT JOIN star_snapshots s
           ON s.plugin_id = p.id
           AND s.snapshot_date = (
             SELECT MAX(snapshot_date) FROM star_snapshots
             WHERE plugin_id = p.id AND snapshot_date <= date('now', '-30 days')
           )
         WHERE p.review_status != 'rejected'
           AND (p.stars - COALESCE(s.stars, p.stars)) >= 5
         ORDER BY (p.stars - COALESCE(s.stars, p.stars))
                  * (1.0 + sqrt(CAST((p.stars - COALESCE(s.stars, p.stars)) AS REAL) / MAX(COALESCE(s.stars, 1), 1))) DESC
         LIMIT ?`,
      )
      .bind(limit)
      .all<TrendingRow>()
  ).results;

  const refs = await refsFor(db, rows.map((r) => r.id));
  return rows.map((r) => toSummary(r, refs.get(r.id) ?? []));
}

// ── Submissions ──────────────────────────────────────────────────────────────

interface SubmissionRow {
  id: number;
  repo_url: string;
  uploader_user_id: number | null;
  status: 'queued' | 'processing' | 'done' | 'rejected';
  reject_reason: string | null;
  created_at: string;
}

export async function isDuplicateRepo(db: D1Database, repoUrl: string): Promise<boolean> {
  const inPlugins = await db.prepare('SELECT 1 AS x FROM plugins WHERE repo_url = ?').bind(repoUrl).first();
  if (inPlugins) return true;
  const inQueue = await db
    .prepare("SELECT 1 AS x FROM submissions WHERE repo_url = ? AND status != 'rejected'")
    .bind(repoUrl)
    .first();
  return !!inQueue;
}

export async function insertSubmission(
  db: D1Database,
  input: { repoUrl: string; uploaderUserId: number },
): Promise<{ id: number }> {
  const row = await db
    .prepare('INSERT INTO submissions (repo_url, uploader_user_id) VALUES (?, ?) RETURNING id')
    .bind(input.repoUrl, input.uploaderUserId)
    .first<{ id: number }>();
  return row as { id: number };
}

export async function findSubmissionById(db: D1Database, id: number): Promise<SubmissionRow | null> {
  return (await db.prepare('SELECT * FROM submissions WHERE id = ?').bind(id).first<SubmissionRow>()) ?? null;
}

export async function updateSubmissionStatus(
  db: D1Database,
  id: number,
  status: SubmissionRow['status'],
  rejectReason?: string,
): Promise<void> {
  await db
    .prepare('UPDATE submissions SET status = ?, reject_reason = ? WHERE id = ?')
    .bind(status, rejectReason ?? null, id)
    .run();
}

// ── Plugin insert from review result ─────────────────────────────────────────

export async function insertPluginFromReview(db: D1Database, p: ReviewPluginData): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO plugins
         (name, slug, one_liner, description_md, repo_url, agent_md, agent_md_status,
          deploy_method, supported_platforms, license, original_author, original_author_url,
          uploader_user_id, review_status, stars, last_repo_update)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
    )
    .bind(
      p.name,
      p.slug,
      p.oneLiner,
      p.descriptionMd,
      p.repoUrl,
      p.agentMd,
      p.agentMdStatus,
      p.deployMethod,
      JSON.stringify(p.supportedPlatforms),
      p.license,
      p.originalAuthor,
      p.originalAuthorUrl,
      p.uploaderUserId,
      p.reviewStatus,
      p.stars,
      p.lastRepoUpdate,
    )
    .first<{ id: number }>();
  const pluginId = (row as { id: number }).id;

  if (p.subcategoryIds.length > 0) {
    const stmts = p.subcategoryIds.map((sid) =>
      db
        .prepare('INSERT OR IGNORE INTO plugin_categories (plugin_id, subcategory_id) VALUES (?, ?)')
        .bind(pluginId, sid),
    );
    await db.batch(stmts);
  }

  return pluginId;
}
