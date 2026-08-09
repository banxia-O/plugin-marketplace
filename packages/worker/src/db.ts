import type {
  Category,
  PluginCategoryRef,
  PluginDetail,
  PluginListQuery,
  PluginSummary,
  ReviewPluginData,
  StoredReviewJobPayload,
  Subcategory,
} from '@ppx/shared';
import { normalizeGithubRepoUrl } from './submission-service.js';

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  icon: string;
  sort_order: number;
  plugin_count: number;
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

async function findUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return (
    (await db
      .prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE')
      .bind(email)
      .first<UserRow>()) ?? null
  );
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

async function mergeGithubUser(
  db: D1Database,
  duplicate: UserRow,
  owner: UserRow,
  gh: GithubProfile,
): Promise<UserRow> {
  if (owner.github_id !== null && owner.github_id !== gh.id) {
    throw new Error('GitHub account cannot be linked to this email');
  }

  await db.batch([
    db.prepare('UPDATE plugins SET uploader_user_id = ? WHERE uploader_user_id = ?').bind(owner.id, duplicate.id),
    db.prepare('UPDATE submissions SET uploader_user_id = ? WHERE uploader_user_id = ?').bind(owner.id, duplicate.id),
    db
      .prepare('UPDATE submissions_legacy_phase1 SET uploader_user_id = ? WHERE uploader_user_id = ?')
      .bind(owner.id, duplicate.id),
    db.prepare('UPDATE ledger SET actor_user_id = ? WHERE actor_user_id = ?').bind(owner.id, duplicate.id),
    db.prepare('DELETE FROM users WHERE id = ?').bind(duplicate.id),
    db
      .prepare('UPDATE users SET github_id = ?, github_login = ?, avatar_url = ? WHERE id = ?')
      .bind(gh.id, gh.login, gh.avatarUrl, owner.id),
  ]);

  return (await findUserById(db, owner.id)) as UserRow;
}

/** 以 github_id 为唯一键 upsert；新建时回避用户名/邮箱唯一约束冲突 */
export async function upsertGithubUser(db: D1Database, gh: GithubProfile): Promise<UserRow> {
  const existing = await db
    .prepare('SELECT * FROM users WHERE github_id = ?')
    .bind(gh.id)
    .first<UserRow>();

  if (existing) {
    const emailOwner = gh.email ? await findUserByEmail(db, gh.email) : null;
    if (emailOwner && emailOwner.id !== existing.id) {
      return mergeGithubUser(db, existing, emailOwner, gh);
    }

    const updated = await db
      .prepare(
        'UPDATE users SET github_login = ?, avatar_url = ?, email = COALESCE(email, ?) WHERE github_id = ? RETURNING *',
      )
      .bind(gh.login, gh.avatarUrl, gh.email, gh.id)
      .first<UserRow>();
    return updated as UserRow;
  }

  if (gh.email) {
    const emailOwner = await findUserByEmail(db, gh.email);
    if (emailOwner) {
      if (emailOwner.github_id !== null && emailOwner.github_id !== gh.id) {
        throw new Error('GitHub account cannot be linked to this email');
      }
      const linked = await db
        .prepare('UPDATE users SET github_id = ?, github_login = ?, avatar_url = ? WHERE id = ? RETURNING *')
        .bind(gh.id, gh.login, gh.avatarUrl, emailOwner.id)
        .first<UserRow>();
      return linked as UserRow;
    }
  }

  const username = await uniqueUsername(db, gh.login);
  const created = await db
    .prepare(
      'INSERT INTO users (username, email, github_id, github_login, avatar_url) VALUES (?, ?, ?, ?, ?) RETURNING *',
    )
    .bind(username, gh.email, gh.id, gh.login, gh.avatarUrl)
    .first<UserRow>();
  return created as UserRow;
}

export async function getCategories(db: D1Database): Promise<Category[]> {
  const cats = (
    await db
      .prepare(
        `SELECT c.id, c.name, c.slug, c.icon, c.sort_order,
                COUNT(DISTINCT CASE WHEN p.review_status != 'rejected' THEN p.id END) AS plugin_count
         FROM categories c
         LEFT JOIN subcategories s ON s.category_id = c.id
         LEFT JOIN plugin_categories pc ON pc.subcategory_id = s.id
         LEFT JOIN plugins p ON p.id = pc.plugin_id
         GROUP BY c.id, c.name, c.slug, c.icon, c.sort_order
         ORDER BY c.sort_order`,
      )
      .all<CategoryRow>()
  ).results;
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
    pluginCount: c.plugin_count,
    subcategories: subsByCat.get(c.id) ?? [],
  }));
}

async function refsFor(db: D1Database, pluginIds: number[]): Promise<Map<number, PluginCategoryRef[]>> {
  const map = new Map<number, PluginCategoryRef[]>();
  if (pluginIds.length === 0) return map;
  const batchSize = 80;
  for (let i = 0; i < pluginIds.length; i += batchSize) {
    const batch = pluginIds.slice(i, i + batchSize);
    const placeholders = batch.map(() => '?').join(',');
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
        .bind(...batch)
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
  baseline_date: string;
}

export async function getTrendingPlugins(
  db: D1Database,
  limit = 8,
): Promise<PluginSummary[]> {
  const rows = (
    await db
      .prepare(
        `SELECT p.*, (p.stars - s.stars) AS star_delta, s.snapshot_date AS baseline_date
         FROM plugins p
         JOIN star_snapshots s
           ON s.plugin_id = p.id
           AND s.snapshot_date = (
             SELECT MAX(snapshot_date) FROM star_snapshots
             WHERE plugin_id = p.id AND snapshot_date <= date('now', '-30 days')
           )
         WHERE p.review_status != 'rejected'
           AND p.stars > s.stars
         ORDER BY (p.stars - s.stars) DESC, p.stars DESC, p.id DESC
         LIMIT ?`,
      )
      .bind(limit)
      .all<TrendingRow>()
  ).results;

  const refs = await refsFor(db, rows.map((r) => r.id));
  return rows.map((r) => ({
    ...toSummary(r, refs.get(r.id) ?? []),
    starDelta: r.star_delta,
    trendBaselineDate: r.baseline_date,
  }));
}

// ── Submissions ──────────────────────────────────────────────────────────────

export interface SubmissionRow {
  id: number;
  repo_url: string;
  uploader_user_id: number | null;
  status: import('./submission-state.js').SubmissionStatus;
  reject_reason: string | null;
  payload_version: number;
  job_payload_json: string;
  attempt_count: number;
  max_attempts: number;
  last_error_code: string | null;
  last_error_message: string | null;
  idempotency_key: string | null;
  active_repo_key: string | null;
  next_attempt_at: string | null;
  processing_started_at: string | null;
  completed_at: string | null;
  correlation_id: string | null;
  last_callback_attempt: number | null;
  created_at: string;
  updated_at: string;
}

export async function isDuplicateRepo(db: D1Database, repoUrl: string): Promise<boolean> {
  const inPlugins = await db.prepare('SELECT 1 AS x FROM plugins WHERE lower(repo_url) = lower(?)').bind(repoUrl).first();
  if (inPlugins) return true;
  const inQueue = await db
    .prepare("SELECT 1 AS x FROM submissions WHERE lower(repo_url) = lower(?) AND status NOT IN ('rejected', 'failed', 'dead_letter')")
    .bind(repoUrl)
    .first();
  return !!inQueue;
}

export async function isPublishedRepo(db: D1Database, repoUrl: string): Promise<boolean> {
  return !!(await db.prepare('SELECT 1 AS x FROM plugins WHERE lower(repo_url) = lower(?)').bind(repoUrl).first());
}

export class IdempotencyConflictError extends Error {
  constructor(public readonly existingSubmissionId: number) {
    super('Idempotency key was already used for a different submission payload');
    this.name = 'IdempotencyConflictError';
  }
}

export class ActiveSubmissionConflictError extends Error {
  constructor(public readonly existingSubmissionId: number) {
    super('An active submission already exists for this repository');
    this.name = 'ActiveSubmissionConflictError';
  }
}

export async function insertSubmission(
  db: D1Database,
  input: {
    repoUrl: string;
    uploaderUserId: number;
    idempotencyKey: string;
    payload: StoredReviewJobPayload;
    correlationId?: string;
  },
): Promise<{ submission: SubmissionRow; created: boolean }> {
  const payloadJson = JSON.stringify(input.payload);
  const normalizedRepoUrl = normalizeGithubRepoUrl(input.repoUrl);
  try {
    const inserted = await db
      .prepare(`INSERT INTO submissions
        (repo_url, uploader_user_id, payload_version, job_payload_json, idempotency_key, active_repo_key, correlation_id, next_attempt_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now')) RETURNING *`)
      .bind(
        normalizedRepoUrl,
        input.uploaderUserId,
        input.payload.payloadVersion,
        payloadJson,
        input.idempotencyKey,
        normalizedRepoUrl,
        input.correlationId ?? null,
      )
      .first<SubmissionRow>();
    return { submission: inserted as SubmissionRow, created: true };
  } catch (error) {
    const existingByKey = await findSubmissionByIdempotencyKey(db, input.idempotencyKey);
    if (existingByKey) {
      if (existingByKey.job_payload_json === payloadJson) return { submission: existingByKey, created: false };
      throw new IdempotencyConflictError(existingByKey.id);
    }
    const active = await db
      .prepare('SELECT * FROM submissions WHERE active_repo_key = ?')
      .bind(normalizedRepoUrl)
      .first<SubmissionRow>();
    if (active) throw new ActiveSubmissionConflictError(active.id);
    throw error;
  }
}

export async function findSubmissionByIdempotencyKey(
  db: D1Database,
  idempotencyKey: string,
): Promise<SubmissionRow | null> {
  return (
    (await db.prepare('SELECT * FROM submissions WHERE idempotency_key = ?').bind(idempotencyKey).first<SubmissionRow>()) ?? null
  );
}

export async function findSubmissionById(db: D1Database, id: number): Promise<SubmissionRow | null> {
  return (await db.prepare('SELECT * FROM submissions WHERE id = ?').bind(id).first<SubmissionRow>()) ?? null;
}

export async function transitionSubmissionStatus(
  db: D1Database,
  id: number,
  from: SubmissionRow['status'],
  to: SubmissionRow['status'],
  input: {
    rejectReason?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    nextAttemptAt?: string | null;
    callbackAttempt?: number;
  } = {},
): Promise<boolean> {
  const { assertSubmissionTransition } = await import('./submission-state.js');
  assertSubmissionTransition(from, to);
  const terminal = ['done', 'rejected', 'failed', 'dead_letter'].includes(to);
  const result = await db
    .prepare(`UPDATE submissions SET
      status = ?, reject_reason = ?, last_error_code = ?, last_error_message = ?, next_attempt_at = ?,
      active_repo_key = CASE WHEN ? THEN NULL ELSE active_repo_key END,
      last_callback_attempt = COALESCE(?, last_callback_attempt),
      completed_at = CASE WHEN ? THEN datetime('now') ELSE completed_at END,
      updated_at = datetime('now')
      WHERE id = ? AND status = ?`)
    .bind(
      to,
      input.rejectReason ?? null,
      input.errorCode ?? null,
      input.errorMessage?.replace(/[\r\n\t]+/g, ' ').slice(0, 500) ?? null,
      input.nextAttemptAt ?? null,
      terminal ? 1 : 0,
      input.callbackAttempt ?? null,
      terminal ? 1 : 0,
      id,
      from,
    )
    .run();
  return (result.meta.changes ?? 0) === 1;
}

// ── Plugin insert from review result ─────────────────────────────────────────

function pluginInsertValues(p: ReviewPluginData): unknown[] {
  return [
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
  ];
}

function preparePluginInsert(db: D1Database, p: ReviewPluginData): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO plugins
         (name, slug, one_liner, description_md, repo_url, agent_md, agent_md_status,
          deploy_method, supported_platforms, license, original_author, original_author_url,
          uploader_user_id, review_status, stars, last_repo_update)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(repo_url) DO NOTHING`,
  )
    .bind(...pluginInsertValues(p));
}

function preparePluginCategories(db: D1Database, p: ReviewPluginData): D1PreparedStatement[] {
  return p.subcategoryIds.map((subcategoryId) =>
    db
      .prepare(`INSERT OR IGNORE INTO plugin_categories (plugin_id, subcategory_id)
        SELECT id, ? FROM plugins WHERE repo_url = ?`)
      .bind(subcategoryId, p.repoUrl),
  );
}

async function findPluginIdByRepo(db: D1Database, repoUrl: string): Promise<number> {
  const row = await db.prepare('SELECT id FROM plugins WHERE repo_url = ?').bind(repoUrl).first<{ id: number }>();
  if (!row) throw new Error(`Plugin insert did not produce a row for ${repoUrl}`);
  return row.id;
}

export async function insertPluginFromReview(db: D1Database, p: ReviewPluginData): Promise<number> {
  await db.batch([preparePluginInsert(db, p), ...preparePluginCategories(db, p)]);
  return findPluginIdByRepo(db, p.repoUrl);
}

export async function completeSubmissionWithPlugin(
  db: D1Database,
  submission: SubmissionRow,
  plugin: ReviewPluginData,
  callbackAttempt: number,
): Promise<{ pluginId: number; deduplicated: boolean }> {
  const { assertSubmissionTransition } = await import('./submission-state.js');
  assertSubmissionTransition(submission.status, 'done');
  const statements = [
    db
      .prepare(`UPDATE submissions SET
        status = 'done', active_repo_key = NULL, next_attempt_at = NULL,
        last_callback_attempt = ?, completed_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ? AND status = ? AND attempt_count = ?`)
      .bind(callbackAttempt, submission.id, submission.status, callbackAttempt),
    db
      .prepare(`INSERT INTO plugins
        (name, slug, one_liner, description_md, repo_url, agent_md, agent_md_status,
         deploy_method, supported_platforms, license, original_author, original_author_url,
         uploader_user_id, review_status, stars, last_repo_update)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        FROM submissions
        WHERE id = ? AND status = 'done' AND last_callback_attempt = ?
        ON CONFLICT(repo_url) DO NOTHING`)
      .bind(...pluginInsertValues(plugin), submission.id, callbackAttempt),
    ...plugin.subcategoryIds.map((subcategoryId) =>
      db
        .prepare(`INSERT OR IGNORE INTO plugin_categories (plugin_id, subcategory_id)
          SELECT plugins.id, ? FROM plugins
          WHERE plugins.repo_url = ?
            AND EXISTS (
              SELECT 1 FROM submissions
              WHERE id = ? AND status = 'done' AND last_callback_attempt = ?
            )`)
        .bind(subcategoryId, plugin.repoUrl, submission.id, callbackAttempt),
    ),
  ];
  const results = await db.batch(statements);
  const transition = results[0];
  const current = await findSubmissionById(db, submission.id);
  if (current?.status !== 'done' || current.last_callback_attempt !== callbackAttempt) {
    throw new Error(`Submission state conflict during completion: submission=${submission.id} attempt=${callbackAttempt}`);
  }
  const pluginId = await findPluginIdByRepo(db, plugin.repoUrl);
  if ((transition?.meta.changes ?? 0) === 1) return { pluginId, deduplicated: false };
  return { pluginId, deduplicated: true };
}
