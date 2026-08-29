import type { Category, PluginSummary } from '@ppx/shared'
import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'

import { apiClient } from '../../api/client'
import { PluginCard } from '../../components/plugin-card'

const PAGE_SIZE = 12
type LoadState = 'loading' | 'ready' | 'error'

export default function CategoryPage() {
  const params = Taro.getCurrentInstance().router?.params
  const categorySlug = params?.category ? decodeURIComponent(params.category) : ''
  const routeName = params?.name ? decodeURIComponent(params.name) : categorySlug

  const [categoryInfo, setCategoryInfo] = useState<Category | null>(null)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState('')
  const [plugins, setPlugins] = useState<PluginSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [listState, setListState] = useState<LoadState>('loading')
  const [loadingMore, setLoadingMore] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const loadCategoryInfo = useCallback(async () => {
    setCategoryError(null)
    try {
      const response = await apiClient.getCategories()
      const matched = response.categories.find((category) => category.slug === categorySlug) ?? null
      if (!matched) throw new Error(`未找到分类：${categorySlug || '空分类标识'}`)
      setCategoryInfo(matched)
    } catch (caught) {
      setCategoryInfo(null)
      setCategoryError(caught instanceof Error ? caught.message : String(caught))
    }
  }, [categorySlug])

  const loadPlugins = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!categorySlug) {
        setListError('缺少分类标识')
        setListState('error')
        return
      }

      if (append) setLoadingMore(true)
      else setListState('loading')
      setListError(null)

      try {
        const response = await apiClient.getPlugins({
          category: categorySlug,
          subcategory: selectedSubcategory || undefined,
          page: nextPage,
          pageSize: PAGE_SIZE,
        })
        setPlugins((current) => (append ? [...current, ...response.plugins] : response.plugins))
        setTotal(response.total)
        setPage(response.page)
        setListState('ready')
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught)
        setListError(message)
        if (!append) {
          setPlugins([])
          setTotal(0)
          setListState('error')
        }
      } finally {
        setLoadingMore(false)
      }
    },
    [categorySlug, selectedSubcategory],
  )

  useEffect(() => {
    void loadCategoryInfo()
  }, [loadCategoryInfo])

  useEffect(() => {
    void loadPlugins(1, false)
  }, [loadPlugins])

  const categoryName = categoryInfo?.name ?? (routeName || '分类')
  const hasMore = listState === 'ready' && plugins.length < total

  return (
    <View className='page-shell'>
      <View className='page-title'>
        <Text>{categoryName}</Text>
      </View>
      <View className='page-subtitle'>
        <Text>分类标识：{categorySlug || '缺失'}</Text>
      </View>

      {categoryError ? (
        <View className='status-panel status-panel--error' style={{ marginBottom: '24rpx' }}>
          <View className='status-panel__message'>
            <Text>分类信息加载失败：{categoryError}</Text>
          </View>
          <Button className='btn btn-ghost btn-compact' onClick={() => void loadCategoryInfo()}>
            重试分类信息
          </Button>
        </View>
      ) : null}

      {categoryInfo && categoryInfo.subcategories.length > 0 ? (
        <View className='section'>
          <View className='section-header'>
            <Text className='section-title'>子分类</Text>
          </View>
          <View className='chip-row'>
            <View className={selectedSubcategory ? 'chip' : 'chip chip--active'} onClick={() => setSelectedSubcategory('')}>
              <Text>全部</Text>
            </View>
            {categoryInfo.subcategories.map((subcategory) => (
              <View
                key={subcategory.slug}
                className={selectedSubcategory === subcategory.slug ? 'chip chip--active' : 'chip'}
                onClick={() => setSelectedSubcategory(subcategory.slug)}
              >
                <Text>{subcategory.name}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {listState === 'loading' ? (
        <View className='status-panel status-panel--loading'>
          <Text>插件加载中…</Text>
        </View>
      ) : null}

      {listState === 'error' ? (
        <View className='status-panel status-panel--error'>
          <View className='status-panel__message'>
            <Text>插件加载失败：{listError}</Text>
          </View>
          <Button className='btn btn-ghost btn-compact' onClick={() => void loadPlugins(1, false)}>
            重试
          </Button>
        </View>
      ) : null}

      {listState === 'ready' && total === 0 ? (
        <View className='status-panel status-panel--empty'>
          <Text>这个分类暂时没有插件。</Text>
        </View>
      ) : null}

      {plugins.length > 0 ? (
        <View>
          <View className='list-summary' style={{ marginBottom: '20rpx' }}>
            <Text>共 {total} 个插件</Text>
          </View>
          {plugins.map((plugin) => (
            <PluginCard key={plugin.slug} plugin={plugin} />
          ))}
        </View>
      ) : null}

      {listError && listState === 'ready' ? (
        <View className='error-text'>
          <Text>加载更多失败：{listError}</Text>
        </View>
      ) : null}

      {hasMore ? (
        <Button
          className='btn btn-ghost'
          disabled={loadingMore}
          onClick={() => void loadPlugins(page + 1, true)}
          style={{ marginTop: '12rpx' }}
        >
          {loadingMore ? '加载中…' : '加载更多'}
        </Button>
      ) : null}
    </View>
  )
}
