import Taro from '@tarojs/taro'

export interface RecentView {
  slug: string
  name: string
  oneLiner: string
  lastViewedAt: number
}

const STORAGE_KEY = 'ppx:miniapp:recent-views:v1'
const MAX_RECENT_VIEWS = 20

function isMissingStorageError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('errMsg' in error)) return false
  return String((error as { errMsg: unknown }).errMsg).includes('data not found')
}

export async function getRecentViews(): Promise<RecentView[]> {
  try {
    const result = await Taro.getStorage<RecentView[]>({ key: STORAGE_KEY })
    return result.data
  } catch (error) {
    if (isMissingStorageError(error)) return []
    throw error
  }
}

export async function recordRecentView(view: RecentView): Promise<void> {
  const current = await getRecentViews()
  const next = [view, ...current.filter((item) => item.slug !== view.slug)].slice(0, MAX_RECENT_VIEWS)
  await Taro.setStorage({ key: STORAGE_KEY, data: next })
}

export async function clearRecentViews(): Promise<void> {
  try {
    await Taro.removeStorage({ key: STORAGE_KEY })
  } catch (error) {
    if (isMissingStorageError(error)) return
    throw error
  }
}
