import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { sign, verify } from 'hono/jwt';
import * as bcrypt from 'bcryptjs';
import { LoginRequest, RegisterRequest } from '@ppx/shared';
import type { AuthUser } from '@ppx/shared';
import type { AppContext } from './env.js';
import {
  createUser,
  findUserById,
  findUserByUsernameOrEmail,
  upsertGithubUser,
  type GithubProfile,
  type UserRow,
} from './db.js';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 天
const BCRYPT_COST = 10;
const OAUTH_STATE_TTL_SECONDS = 600;
const GITHUB_SCOPE = 'read:user user:email';

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    avatarUrl: row.avatar_url,
    githubLogin: row.github_login,
  };
}

async function signToken(secret: string, user: UserRow): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign({ sub: user.id, username: user.username, iat: now, exp: now + TOKEN_TTL_SECONDS }, secret);
}

/** 验证 Bearer token，成功时注入 userId，失败返回 401 */
export const authMiddleware: MiddlewareHandler<AppContext> = async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return c.json({ error: 'unauthorized', message: '缺少认证令牌' }, 401);
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256');
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) throw new Error('invalid subject');
    c.set('userId', userId);
  } catch {
    return c.json({ error: 'unauthorized', message: '认证令牌无效或已过期' }, 401);
  }
  await next();
};

async function fetchGithubProfile(accessToken: string): Promise<GithubProfile> {
  const headers = {
    authorization: `Bearer ${accessToken}`,
    accept: 'application/vnd.github+json',
    'user-agent': 'plugin-marketplace',
  };

  const userRes = await fetch('https://api.github.com/user', { headers });
  if (!userRes.ok) throw new Error('github user fetch failed');
  const u = (await userRes.json()) as {
    id: number;
    login: string;
    avatar_url: string | null;
    email: string | null;
  };

  let email = u.email;
  if (!email) {
    const emailRes = await fetch('https://api.github.com/user/emails', { headers });
    if (emailRes.ok) {
      const emails = (await emailRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
      email =
        emails.find((e) => e.primary && e.verified)?.email ??
        emails.find((e) => e.verified)?.email ??
        null;
    }
  }

  return { id: u.id, login: u.login, avatarUrl: u.avatar_url, email };
}

export const authRoutes = new Hono<AppContext>();

authRoutes.post('/register', async (c) => {
  const parsed = RegisterRequest.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'bad_request', message: parsed.error?.issues[0]?.message ?? '注册信息不合法' }, 400);
  }
  const { username, email, password } = parsed.data;

  const existing = await findUserByUsernameOrEmail(c.env.DB, username, email ?? null);
  if (existing) {
    return c.json({ error: 'conflict', message: '用户名或邮箱已被注册' }, 409);
  }

  const passwordHash = bcrypt.hashSync(password, BCRYPT_COST);
  const user = await createUser(c.env.DB, { username, email: email ?? null, passwordHash });
  const token = await signToken(c.env.JWT_SECRET, user);
  return c.json({ token, user: toAuthUser(user) }, 201);
});

authRoutes.post('/login', async (c) => {
  const parsed = LoginRequest.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'bad_request', message: '登录信息不合法' }, 400);
  }
  const { identifier, password } = parsed.data;

  const user = await findUserByUsernameOrEmail(c.env.DB, identifier, identifier);
  // 统一报错信息，避免暴露账号是否存在
  if (!user || !user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
    return c.json({ error: 'unauthorized', message: '用户名或密码错误' }, 401);
  }

  const token = await signToken(c.env.JWT_SECRET, user);
  return c.json({ token, user: toAuthUser(user) });
});

authRoutes.get('/github', async (c) => {
  if (!c.env.GITHUB_CLIENT_ID) {
    return c.json({ error: 'not_configured', message: 'GitHub 登录未配置' }, 500);
  }
  const state = crypto.randomUUID();
  await c.env.CACHE.put(`oauth:state:${state}`, '1', { expirationTtl: OAUTH_STATE_TTL_SECONDS });

  const redirectUri = new URL('/api/auth/github/callback', c.req.url).toString();
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', c.env.GITHUB_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('scope', GITHUB_SCOPE);
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('allow_signup', 'true');
  return c.redirect(authorize.toString(), 302);
});

authRoutes.get('/github/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  if (!code || !state) {
    return c.json({ error: 'bad_request', message: '缺少 code 或 state' }, 400);
  }

  // state 一次性校验：存在即删除，杜绝重放与 CSRF
  const stateKey = `oauth:state:${state}`;
  const storedState = await c.env.CACHE.get(stateKey);
  if (!storedState) {
    return c.json({ error: 'bad_request', message: 'state 无效或已过期' }, 400);
  }
  await c.env.CACHE.delete(stateKey);

  const redirectUri = new URL('/api/auth/github/callback', c.req.url).toString();
  let profile: GithubProfile;
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        client_id: c.env.GITHUB_CLIENT_ID,
        client_secret: c.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenRes.ok || !tokenJson.access_token) {
      return c.json({ error: 'oauth_failed', message: 'GitHub 令牌交换失败' }, 502);
    }
    profile = await fetchGithubProfile(tokenJson.access_token);
  } catch {
    return c.json({ error: 'oauth_failed', message: 'GitHub 授权失败' }, 502);
  }

  const user = await upsertGithubUser(c.env.DB, profile);
  const token = await signToken(c.env.JWT_SECRET, user);

  // 浏览器重定向流：把 token 经 URL fragment 交回 SPA（fragment 不进服务端日志）
  const handoff = new URL('/', c.req.url);
  handoff.hash = `token=${token}`;
  return c.redirect(handoff.toString(), 302);
});

export { findUserById, toAuthUser };
