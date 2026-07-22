import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Miniflare } from 'miniflare';
import { PluginListQuery } from '@ppx/shared';
import { getCategories, getTrendingPlugins, listPlugins } from '../src/db.js';

const SCHEMA = `
CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  icon TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);
CREATE TABLE subcategories (
  id INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);
CREATE TABLE plugins (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  one_liner TEXT NOT NULL,
  description_md TEXT NOT NULL DEFAULT '',
  repo_url TEXT NOT NULL UNIQUE,
  agent_md TEXT,
  agent_md_status TEXT NOT NULL DEFAULT 'incomplete',
  deploy_method TEXT NOT NULL DEFAULT 'local',
  supported_platforms TEXT NOT NULL DEFAULT '[]',
  license TEXT NOT NULL DEFAULT 'MIT',
  original_author TEXT NOT NULL DEFAULT 'author',
  original_author_url TEXT,
  review_status TEXT NOT NULL DEFAULT 'basic',
  stars INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  last_repo_update TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE plugin_categories (
  plugin_id INTEGER NOT NULL,
  subcategory_id INTEGER NOT NULL,
  PRIMARY KEY (plugin_id, subcategory_id)
);
CREATE TABLE star_snapshots (
  plugin_id INTEGER NOT NULL,
  stars INTEGER NOT NULL,
  snapshot_date TEXT NOT NULL,
  PRIMARY KEY (plugin_id, snapshot_date)
);
`;

describe('catalog queries', () => {
  let mf: Miniflare;
  let db: D1Database;

  beforeEach(async () => {
    mf = new Miniflare({
      modules: true,
      script: 'export default { fetch() { return new Response("ok") } }',
      compatibilityDate: '2025-01-09',
      d1Databases: { DB: crypto.randomUUID() },
    });
    db = await mf.getD1Database('DB');
    for (const statement of SCHEMA.split(';').map((sql) => sql.trim()).filter(Boolean)) {
      await db.prepare(statement).run();
    }
    await db.prepare("INSERT INTO categories VALUES (1, '开发工具', 'dev', 'Code', 1)").run();
    await db.prepare("INSERT INTO subcategories VALUES (1, 1, 'API 与调试', 'api', 1)").run();

    const statements: D1PreparedStatement[] = [];
    for (let id = 1; id <= 120; id += 1) {
      statements.push(
        db.prepare(
          'INSERT INTO plugins (id, name, slug, one_liner, repo_url) VALUES (?, ?, ?, ?, ?)',
        ).bind(id, `Plugin ${id}`, `plugin-${id}`, `Plugin ${id}`, `https://github.com/example/plugin-${id}`),
        db.prepare('INSERT INTO plugin_categories VALUES (?, 1)').bind(id),
      );
    }
    for (let i = 0; i < statements.length; i += 80) {
      await db.batch(statements.slice(i, i + 80));
    }
  });

  afterEach(async () => {
    await mf.dispose();
  });

  it('returns category counts and category refs for more than 100 plugins', async () => {
    const categories = await getCategories(db);
    expect(categories[0]?.pluginCount).toBe(120);

    const result = await listPlugins(db, PluginListQuery.parse({ pageSize: 200 }));
    expect(result.total).toBe(120);
    expect(result.plugins).toHaveLength(120);
    expect(result.plugins.every((plugin) => plugin.categories[0]?.categorySlug === 'dev')).toBe(true);
  });

  it('ranks plugins by growth from the latest baseline at least 30 days old', async () => {
    await db.prepare('UPDATE plugins SET stars = 25 WHERE id = 1').run();
    await db.prepare('UPDATE plugins SET stars = 100 WHERE id = 2').run();
    await db.prepare('UPDATE plugins SET stars = 500 WHERE id = 3').run();
    await db
      .prepare("INSERT INTO star_snapshots VALUES (1, 10, date('now', '-30 days'))")
      .run();
    await db
      .prepare("INSERT INTO star_snapshots VALUES (2, 20, date('now', '-30 days'))")
      .run();
    await db
      .prepare("INSERT INTO star_snapshots VALUES (3, 1, date('now', '-29 days'))")
      .run();

    const result = await getTrendingPlugins(db, 50);

    expect(result.map((plugin) => [plugin.id, plugin.starDelta])).toEqual([
      [2, 80],
      [1, 15],
    ]);
  });
});
