import {
  CategoriesResponse,
  PluginDetailResponse,
  PluginListResponse,
  type PluginListQuery,
} from '@ppx/shared';

// Phase 2：apiClient 改为请求真实 Worker。默认走同源 /api（生产 CF Pages 同域路由）；
// 本地开发可用 Vite 代理（见 vite.config.ts），或设 VITE_API_BASE 直连 Worker。
const BASE = import.meta.env.VITE_API_BASE ?? '';

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    let message = `请求失败（${res.status}）`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(message);
  }
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

export const apiClient = { getCategories, getPlugins, getPlugin };
