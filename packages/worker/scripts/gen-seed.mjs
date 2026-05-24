// 从 @ppx/shared 的种子 fixtures 生成 D1 插件种子 SQL。
// 单一数据源：前端 mock（Phase 1）与 D1 种子（Phase 2）都来自同一份 fixtures。
// 用法：先 `pnpm --filter @ppx/shared build`，再 `node scripts/gen-seed.mjs`。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const { plugins } = await import(new URL('../../shared/dist/fixtures.js', import.meta.url));

function q(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

const lines = [
  '-- 由 scripts/gen-seed.mjs 从 @ppx/shared/fixtures 生成，请勿手改。',
  '-- 应用：wrangler d1 execute DB --local --file=seed/plugins.sql',
  'DELETE FROM plugin_categories;',
  'DELETE FROM plugins;',
  '',
];

for (const p of plugins) {
  const cols = [
    p.id,
    q(p.name),
    q(p.slug),
    q(p.oneLiner),
    q(p.descriptionMd),
    q(p.repoUrl),
    q(p.agentMd),
    q(p.agentMdStatus),
    q(p.deployMethod),
    q(JSON.stringify(p.supportedPlatforms)),
    q(p.license),
    q(p.originalAuthor),
    q(p.originalAuthorUrl),
    q(p.reviewStatus),
    p.stars,
    p.downloadCount,
    p.likeCount,
    q(p.lastRepoUpdate),
    q(p.createdAt),
    q(p.updatedAt),
  ];
  lines.push(
    'INSERT INTO plugins (id, name, slug, one_liner, description_md, repo_url, agent_md, agent_md_status, ' +
      'deploy_method, supported_platforms, license, original_author, original_author_url, review_status, ' +
      `stars, download_count, like_count, last_repo_update, created_at, updated_at) VALUES (${cols.join(', ')});`,
  );
  for (const ref of p.categories) {
    lines.push(
      `INSERT INTO plugin_categories (plugin_id, subcategory_id) SELECT ${p.id}, s.id ` +
        'FROM subcategories s JOIN categories c ON c.id = s.category_id ' +
        `WHERE c.slug = ${q(ref.categorySlug)} AND s.slug = ${q(ref.subcategorySlug)};`,
    );
  }
}
lines.push('');

const outDir = resolve(here, '..', 'seed');
mkdirSync(outDir, { recursive: true });
const outFile = resolve(outDir, 'plugins.sql');
writeFileSync(outFile, lines.join('\n'), 'utf8');
console.log(`wrote ${outFile} (${plugins.length} plugins)`);
