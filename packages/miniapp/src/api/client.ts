import type {
  CategoriesResponse,
  PluginDetailResponse,
  PluginListQuery,
  PluginListResponse,
} from '@ppx/shared'
import Taro from '@tarojs/taro'

import { API_BASE_URL } from '../config/api'

function buildQuery(query: Partial<PluginListQuery>): string {
  const pairs = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)

  return pairs.length > 0 ? `?${pairs.join('&')}` : ''
}

async function getJson<T>(path: string): Promise<T> {
  const response = await Taro.request<T>({
    url: `${API_BASE_URL}${path}`,
    method: 'GET',
    header: { accept: 'application/json' },
  })

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`${path} 请求失败（HTTP ${response.statusCode}）`)
  }

  return response.data
}

function getCategories(): Promise<CategoriesResponse> {
  return getJson<CategoriesResponse>('/api/categories')
}

function getPlugins(query: Partial<PluginListQuery> = {}): Promise<PluginListResponse> {
  return getJson<PluginListResponse>(`/api/plugins${buildQuery(query)}`)
}

function getPlugin(slug: string): Promise<PluginDetailResponse> {
  return getJson<PluginDetailResponse>(`/api/plugins/${encodeURIComponent(slug)}`)
}

export const apiClient = {
  getCategories,
  getPlugins,
  getPlugin,
}
