import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { PluginListQuery } from '@ppx/shared';
import { getCategories, getPluginBySlug, listPlugins } from './db.js';
import { authMiddleware, authRoutes, findUserById, toAuthUser } from './auth.js';
import type { AppContext } from './env.js';

export type { Env } from './env.js';

const CATEGORIES_CACHE_KEY = 'categories:v1';
const CATEGORIES_TTL = 300;

const app = new Hono<AppContext>();

// 生产走同源 /api，无需 CORS；此处放开便于本地跨端口直连与调试。
app.use('/api/*', cors());

app.get('/api/health', (c) => c.json({ status: 'ok' }));

app.route('/api/auth', authRoutes);

// 受保护路由示例：返回当前登录用户（后续 Phase 的上传/点赞等均复用 authMiddleware）
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

// /api/search 是 /api/plugins 的语义别名（强制带 q）
app.get('/api/search', async (c) => {
  const parsed = PluginListQuery.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: 'bad_request', message: '查询参数不合法' }, 400);
  }
  const { plugins, total } = await listPlugins(c.env.DB, parsed.data);
  return c.json({ plugins, total, page: parsed.data.page, pageSize: parsed.data.pageSize });
});

app.get('/api/plugins/:slug', async (c) => {
  const plugin = await getPluginBySlug(c.env.DB, c.req.param('slug'));
  if (!plugin) {
    return c.json({ error: 'not_found', message: '插件不存在' }, 404);
  }
  return c.json({ plugin });
});

export default app;
