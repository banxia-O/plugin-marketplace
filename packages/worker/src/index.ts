import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { PluginListQuery } from '@ppx/shared';
import { getCategories, getPluginBySlug, getTrendingPlugins, listPlugins } from './db.js';
import { authMiddleware, authRoutes, findUserById, toAuthUser } from './auth.js';
import { adminRoutes, submissionRoutes } from './submissions.js';
import type { AppContext } from './env.js';

import { syncRepoMetadata } from './sync.js';

export type { Env } from './env.js';

const CATEGORIES_CACHE_KEY = 'categories:v1';
const CATEGORIES_TTL = 300;

const app = new Hono<AppContext>();

app.onError((err, c) => {
  console.error('[worker error]', err.message, err.stack);
  return c.json({ error: 'internal', message: err.message }, 500);
});

// 生产走同源 /api，无需 CORS；此处放开便于本地跨端口直连与调试。
app.use('/api/*', cors());

app.get('/api/health', (c) => c.json({ status: 'ok' }));

app.route('/api/auth', authRoutes);
app.route('/api/submissions', submissionRoutes);
app.route('/api/admin', adminRoutes);

app.get('/api/me', authMiddleware, async (c) => {
  const user = await findUserById(c.env.DB, c.get('userId'));
  if (!user) return c.json({ error: 'not_found', message: '用户不存在' }, 404);
  return c.json({ user: toAuthUser(user) });
});

app.get('/api/categories', async (c) => {
  const cached = await c.env.CACHE.get(CATEGORIES_CACHE_KEY, 'json');
  if (cached) return c.json({ categories: cached });

  const categories = await getCategories(c.env.DB);
  await c.env.CACHE.put(CATEGORIES_CACHE_KEY, JSON.stringify(categories), { expirationTtl: CATEGORIES_TTL });
  return c.json({ categories });
});

app.get('/api/plugins', async (c) => {
  const parsed = PluginListQuery.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: 'bad_request', message: '查询参数不合法' }, 400);
  }
  const query = parsed.data;
  const { plugins, total } = await listPlugins(c.env.DB, query);
  return c.json({ plugins, total, page: query.page, pageSize: query.pageSize });
});

app.get('/api/search', async (c) => {
  const parsed = PluginListQuery.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: 'bad_request', message: '查询参数不合法' }, 400);
  }
  const { plugins, total } = await listPlugins(c.env.DB, parsed.data);
  return c.json({ plugins, total, page: parsed.data.page, pageSize: parsed.data.pageSize });
});

const TRENDING_CACHE_KEY = 'trending:v1';
const TRENDING_TTL = 3600;

app.get('/api/trending', async (c) => {
  const cached = await c.env.CACHE.get(TRENDING_CACHE_KEY, 'json');
  if (cached) return c.json({ plugins: cached });

  const plugins = await getTrendingPlugins(c.env.DB);
  await c.env.CACHE.put(TRENDING_CACHE_KEY, JSON.stringify(plugins), { expirationTtl: TRENDING_TTL });
  return c.json({ plugins });
});

app.get('/api/plugins/:slug', async (c) => {
  const plugin = await getPluginBySlug(c.env.DB, c.req.param('slug'));
  if (!plugin) {
    return c.json({ error: 'not_found', message: '插件不存在' }, 404);
  }
  return c.json({ plugin });
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: import('./env.js').Env, ctx: ExecutionContext) {
    ctx.waitUntil(syncRepoMetadata(env));
  },
};
