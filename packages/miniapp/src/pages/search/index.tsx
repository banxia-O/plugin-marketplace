import type { PluginSummary } from '@ppx/shared'
import { Button, Input, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'

import { apiClient } from '../../api/client'
import { PluginCard } from '../../components/plugin-card'

const PAGE_SIZE = 12
const sensitivityNotice = '请勿输入患者身份信息、未公开研究数据或其他敏感信息。'
type LoadState = 'idle' | 'loading' | 'ready' | 'error'

function readInitialQuery(): string {
  const rawQuery = Taro.getCurrentInstance().router?.params.q ?? ''
  return rawQuery ? decodeURIComponent(rawQuery) : ''
}

export default function SearchPage() {
  const initialQuery = readInitialQuery()
  const [keyword, setKeyword] = useState(initialQuery)
  const [activeQuery, setActiveQuery] = useState(initialQuery.trim())
  const [plugins, setPlugins] = useState<PluginSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loadState, setLoadState] = useState<LoadState>(initialQuery.trim() ? 'loading' : 'idle')
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPage = useCallback(async (q: string, nextPage: number, append: boolean) => {
    if (!q) return

    if (append) setLoadingMore(true)
    else setLoadState('loading')
    setError(null)

    try {
      const response = await apiClient.getPlugins({ q, page: nextPage, pageSize: PAGE_SIZE })
      setPlugins((current) => (append ? [...current, ...response.plugins] : response.plugins))
      setTotal(response.total)
      setPage(response.page)
      setLoadState('ready')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught)
      setError(message)
      if (!append) {
        setPlugins([])
        setTotal(0)
        setLoadState('error')
      }
    } finally {
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    if (!activeQuery) {
      setPlugins([])
      setTotal(0)
      setLoadState('idle')
      return
    }
    void loadPage(activeQuery, 1, false)
  }, [activeQuery, loadPage])

  const submitSearch = () => {
    const q = keyword.trim()
    if (!q) {
      setActiveQuery('')
      return
    }

    if (q === activeQuery) {
      void loadPage(q, 1, false)
      return
    }
    setActiveQuery(q)
  }

  const hasMore = loadState === 'ready' && plugins.length < total

  return (
    <View className='page-shell'>
      <View className='page-title'>
        <Text>搜索插件</Text>
      </View>
      <View className='page-subtitle'>
        <Text>中文、英文关键词都可以直接搜索</Text>
      </View>

      <View className='section'>
        <Input
          className='search-input'
          value={keyword}
          placeholder='搜插件、功能或科研场景'
          confirmType='search'
          onInput={(event) => setKeyword(event.detail.value)}
          onConfirm={submitSearch}
        />
        <Button className='btn btn-primary' onClick={submitSearch} style={{ marginTop: '16rpx' }}>
          搜索
        </Button>
      </View>

      <View className='sensitivity-notice'>
        <Text>{sensitivityNotice}</Text>
      </View>

      {loadState === 'idle' ? (
        <View className='status-panel status-panel--empty'>
          <Text>输入关键词后开始搜索。</Text>
        </View>
      ) : null}

      {loadState === 'loading' ? (
        <View className='status-panel status-panel--loading'>
          <Text>搜索中…</Text>
        </View>
      ) : null}

      {loadState === 'error' ? (
        <View className='status-panel status-panel--error'>
          <View className='status-panel__message'>
            <Text>搜索失败：{error}</Text>
          </View>
          <Button className='btn btn-ghost btn-compact' onClick={() => void loadPage(activeQuery, 1, false)}>
            重试
          </Button>
        </View>
      ) : null}

      {loadState === 'ready' && total === 0 ? (
        <View className='status-panel status-panel--empty'>
          <View className='status-panel__message'>
            <Text>暂时没找到匹配的插件，试试缩短关键词，或者从分类里找找。</Text>
          </View>
          <Button className='btn btn-secondary btn-compact' onClick={() => void Taro.navigateTo({ url: '/pages/categories/index' })}>
            去全部分类
          </Button>
        </View>
      ) : null}

      {plugins.length > 0 ? (
        <View>
          <View className='list-summary' style={{ marginBottom: '20rpx' }}>
            <Text>“{activeQuery}” 共 {total} 个结果</Text>
          </View>
          {plugins.map((plugin) => (
            <PluginCard key={plugin.slug} plugin={plugin} />
          ))}
        </View>
      ) : null}

      {error && loadState === 'ready' ? (
        <View className='error-text'>
          <Text>加载更多失败：{error}</Text>
        </View>
      ) : null}

      {hasMore ? (
        <Button
          className='btn btn-ghost'
          disabled={loadingMore}
          onClick={() => void loadPage(activeQuery, page + 1, true)}
          style={{ marginTop: '12rpx' }}
        >
          {loadingMore ? '加载中…' : '加载更多'}
        </Button>
      ) : null}
    </View>
  )
}
