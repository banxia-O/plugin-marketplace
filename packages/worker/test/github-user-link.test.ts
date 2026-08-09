import { afterEach, describe, expect, it } from 'vitest';
import { Miniflare } from 'miniflare';
import { upsertGithubUser } from '../src/db.js';

const databases: Miniflare[] = [];

async function createDb(): Promise<D1Database> {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok") } }',
    compatibilityDate: '2025-01-09',
    d1Databases: { DB: crypto.randomUUID() },
  });
  databases.push(mf);
  const db = await mf.getD1Database('DB');
  const statements = [
    `CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT,
      github_id INTEGER UNIQUE,
      github_login TEXT,
      avatar_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    'CREATE TABLE plugins (id INTEGER PRIMARY KEY, uploader_user_id INTEGER REFERENCES users(id))',
    'CREATE TABLE submissions (id INTEGER PRIMARY KEY, uploader_user_id INTEGER REFERENCES users(id))',
    'CREATE TABLE submissions_legacy_phase1 (id INTEGER PRIMARY KEY, uploader_user_id INTEGER REFERENCES users(id))',
    'CREATE TABLE ledger (id INTEGER PRIMARY KEY, actor_user_id INTEGER REFERENCES users(id))',
  ];
  for (const statement of statements) await db.prepare(statement).run();
  return db;
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.dispose()));
});

describe('upsertGithubUser', () => {
  it('links a new GitHub identity to an existing email account', async () => {
    const db = await createDb();
    await db
      .prepare('INSERT INTO users (id, username, email, password_hash) VALUES (1, ?, ?, ?)')
      .bind('banxia', 'owner@example.com', 'hash')
      .run();

    const user = await upsertGithubUser(db, {
      id: 42,
      login: 'banxia-O',
      avatarUrl: 'https://example.com/avatar.png',
      email: 'owner@example.com',
    });

    expect(user).toMatchObject({ id: 1, username: 'banxia', github_id: 42, github_login: 'banxia-O' });
    expect((await db.prepare('SELECT COUNT(*) AS count FROM users').first<{ count: number }>())?.count).toBe(1);
  });

  it('merges a legacy GitHub-only duplicate and preserves its references', async () => {
    const db = await createDb();
    await db.batch([
      db
        .prepare('INSERT INTO users (id, username, email, password_hash) VALUES (1, ?, ?, ?)')
        .bind('banxia', 'owner@example.com', 'hash'),
      db
        .prepare('INSERT INTO users (id, username, github_id, github_login) VALUES (6, ?, ?, ?)')
        .bind('banxia-O', 42, 'banxia-O'),
      db.prepare('INSERT INTO plugins (id, uploader_user_id) VALUES (1, 6)'),
      db.prepare('INSERT INTO submissions (id, uploader_user_id) VALUES (1, 6)'),
      db.prepare('INSERT INTO submissions_legacy_phase1 (id, uploader_user_id) VALUES (1, 6)'),
      db.prepare('INSERT INTO ledger (id, actor_user_id) VALUES (1, 6)'),
    ]);

    const user = await upsertGithubUser(db, {
      id: 42,
      login: 'banxia-O',
      avatarUrl: null,
      email: 'owner@example.com',
    });

    expect(user).toMatchObject({ id: 1, username: 'banxia', github_id: 42, github_login: 'banxia-O' });
    expect(await db.prepare('SELECT id FROM users WHERE id = 6').first()).toBeNull();
    for (const [table, column] of [
      ['plugins', 'uploader_user_id'],
      ['submissions', 'uploader_user_id'],
      ['submissions_legacy_phase1', 'uploader_user_id'],
      ['ledger', 'actor_user_id'],
    ]) {
      const row = await db.prepare(`SELECT ${column} AS user_id FROM ${table} WHERE id = 1`).first<{ user_id: number }>();
      expect(row?.user_id).toBe(1);
    }
  });
});
