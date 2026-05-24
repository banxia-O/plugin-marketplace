import {
  AuthResponse,
  CategoriesResponse,
  PluginDetailResponse,
  PluginListResponse,
  type AuthUser,
  type LoginRequest,
  type PluginListQuery,
  type RegisterRequest,
  type SubmissionRequest,
} from '@ppx/shared';
import { getToken } from '../lib/token.js';

// Phase 2：apiClient 改为请求真实 Worker。默认走同源 /api（生产 CF Pages 同域路由）；
// 本地开发可用 Vite 代理（见 vite.config.ts），或设 VITE_API_BASE 直连 Worker。
const BASE = import.meta.env.VITE_API_BASE ?? '';

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function parseError(res: Response): Promise<string> {
  let message = `请求失败（${res.status}）`;
  try {
    const body = (await res.json()) as { message?: string };
    if (body?.message) message = body.message;
  } catch {
    /* ignore non-JSON error bodies */
  }
  return message;
}

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, { headers: { accept: 'application/json', ...authHeaders() } });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

async function postJson(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

function buildQuery(query: Partial<PluginListQuery>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

async function getCategories(): Promise<CategoriesResponse> {
  return CategoriesResponse.parse(await getJson('/api/categories'));
}

async function getPlugins(query: Partial<PluginListQuery> = {}): Promise<PluginListResponse> {
  return PluginListResponse.parse(await getJson(`/api/plugins${buildQuery(query)}`));
}

async function getPlugin(slug: string): Promise<PluginDetailResponse> {
  return PluginDetailResponse.parse(await getJson(`/api/plugins/${encodeURIComponent(slug)}`));
}

async function register(body: RegisterRequest): Promise<AuthResponse> {
  return AuthResponse.parse(await postJson('/api/auth/register', body));
}

async function login(body: LoginRequest): Promise<AuthResponse> {
  return AuthResponse.parse(await postJson('/api/auth/login', body));
}

async function getMe(): Promise<{ user: AuthUser }> {
  return (await getJson('/api/me')) as { user: AuthUser };
}

async function createSubmission(body: SubmissionRequest): Promise<{ submissionId: number; status: string }> {
  return (await postJson('/api/submissions', body)) as { submissionId: number; status: string };
}

/** GitHub OAuth 入口（浏览器整页跳转，不走 fetch） */
function githubLoginUrl(): string {
  return `${BASE}/api/auth/github`;
}

export const apiClient = {
  getCategories,
  getPlugins,
  getPlugin,
  register,
  login,
  getMe,
  createSubmission,
  githubLoginUrl,
};
