import type { Env } from './env.js';

interface PluginRepo {
  id: number;
  repo_url: string;
}

interface GithubRepoMeta {
  stargazers_count: number;
  pushed_at: string;
  archived: boolean;
}

function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
  return m ? { owner: m[1], repo: m[2] } : null;
}

async function fetchRepoMeta(
  owner: string,
  repo: string,
  token?: string,
): Promise<GithubRepoMeta | null> {
  const headers: Record<string, string> = {
    accept: 'application/vnd.github.v3+json',
    'user-agent': 'plugin-marketplace-sync',
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!res.ok) return null;
  return res.json() as Promise<GithubRepoMeta>;
}

export async function syncRepoMetadata(env: Env): Promise<{ synced: number; failed: number }> {
  const plugins = (
    await env.DB.prepare('SELECT id, repo_url FROM plugins').all<PluginRepo>()
  ).results;

  let synced = 0;
  let failed = 0;

  for (const p of plugins) {
    const parsed = parseGithubUrl(p.repo_url);
    if (!parsed) {
      failed++;
      continue;
    }

    try {
      const meta = await fetchRepoMeta(parsed.owner, parsed.repo, env.GITHUB_TOKEN);
      if (!meta) {
        failed++;
        continue;
      }

      await env.DB.batch([
        env.DB.prepare(
          'UPDATE plugins SET stars = ?, last_repo_update = ?, updated_at = datetime(\'now\') WHERE id = ?',
        ).bind(meta.stargazers_count, meta.pushed_at, p.id),
        env.DB.prepare(
          'INSERT OR REPLACE INTO star_snapshots (plugin_id, stars, snapshot_date) VALUES (?, ?, date(\'now\'))',
        ).bind(p.id, meta.stargazers_count),
      ]);

      synced++;
    } catch {
      failed++;
    }
  }

  console.log(`[sync] 完成：${synced} 成功，${failed} 失败，共 ${plugins.length} 个插件`);
  return { synced, failed };
}
