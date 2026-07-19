import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';

const OLD_SCHEMA = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE
);
CREATE TABLE subcategories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);
CREATE TABLE plugins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  one_liner TEXT NOT NULL,
  description_md TEXT NOT NULL DEFAULT '',
  repo_url TEXT NOT NULL UNIQUE,
  agent_md TEXT,
  agent_md_status TEXT NOT NULL DEFAULT 'incomplete',
  deploy_method TEXT NOT NULL,
  supported_platforms TEXT NOT NULL DEFAULT '[]',
  license TEXT NOT NULL DEFAULT '',
  original_author TEXT NOT NULL DEFAULT '',
  original_author_url TEXT,
  uploader_user_id INTEGER REFERENCES users(id),
  review_status TEXT NOT NULL DEFAULT 'basic',
  stars INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  last_repo_update TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE plugin_categories (
  plugin_id INTEGER NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  subcategory_id INTEGER NOT NULL REFERENCES subcategories(id),
  PRIMARY KEY (plugin_id, subcategory_id)
);
CREATE TABLE submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_url TEXT NOT NULL,
  uploader_user_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','done','rejected')),
  reject_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_submissions_status ON submissions(status);
INSERT INTO users (id, username) VALUES (1, 'test-user');
INSERT INTO subcategories (id, name) VALUES (1, 'one'), (2, 'two');
`;

export interface TestD1 {
  db: D1Database;
  dispose(): Promise<void>;
}

async function executeSqlScript(db: D1Database, sql: string): Promise<void> {
  const statements = sql
    .replace(/^\s*--.*$/gm, '')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) await db.prepare(statement).run();
}

export async function createOldTestD1(): Promise<TestD1> {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok") } }',
    compatibilityDate: '2025-01-09',
    d1Databases: { DB: crypto.randomUUID() },
  });
  const db = await mf.getD1Database('DB');
  await executeSqlScript(db, OLD_SCHEMA);
  return { db, dispose: () => mf.dispose() };
}

export async function createMigratedTestD1(): Promise<TestD1> {
  const testD1 = await createOldTestD1();
  const migration = readFileSync(new URL('../../migrations/0004_reliable_review_pipeline.sql', import.meta.url), 'utf8');
  await executeSqlScript(testD1.db, migration);
  return testD1;
}
