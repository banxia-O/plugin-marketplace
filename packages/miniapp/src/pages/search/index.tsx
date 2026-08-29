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
    <View style={{ padding: '40rpx 32rpx 64rpx', fontSize: '30rpx', lineHeight: 1.6 }}>
      <View style={{ marginBottom: '20rpx', fontSize: '38rpx', fontWeight: '600' }}>
        <Text>搜索插件</Text>
      </View>

      <Input
        value={keyword}
        placeholder='搜插件、功能或科研场景'
        confirmType='search'
        onInput={(event) => setKeyword(event.detail.value)}
        onConfirm={submitSearch}
        style={{
          boxSizing: 'border-box',
          width: '100%',
          minHeight: '88rpx',
          padding: '20rpx 24rpx',
          border: '1rpx solid #d9d9d9',
          borderRadius: '16rpx',
          background: '#ffffff',
        }}
      />
      <Button onClick={submitSearch} style={{ marginTop: '16rpx', marginBottom: '12rpx', fontSize: '30rpx' }}>
        搜索
      </Button>
      <View style={{ marginBottom: '28rpx', fontSize: '24rpx', color: '#777777' }}>
        <Text>{sensitivityNotice}</Text>
      </View>

      {loadState === 'idle' ? (
        <View>
          <Text>输入关键词后开始搜索。</Text>
        </View>
      ) : null}

      {loadState === 'loading' ? (
        <View>
          <Text>搜索中…</Text>
        </View>
      ) : null}

      {loadState === 'error' ? (
        <View style={{ padding: '24rpx', border: '1rpx solid #e5e5e5', borderRadius: '16rpx' }}>
          <View style={{ marginBottom: '12rpx' }}>
            <Text>搜索失败：{error}</Text>
          </View>
          <Button onClick={() => void loadPage(activeQuery, 1, false)} style={{ fontSize: '28rpx' }}>
            重试
          </Button>
        </View>
      ) : null}

      {loadState === 'ready' && total === 0 ? (
        <View>
          <View style={{ marginBottom: '16rpx' }}>
            <Text>暂时没找到匹配的插件，试试缩短关键词，或者从分类里找找。</Text>
          </View>
          <Button onClick={() => void Taro.navigateTo({ url: '/pages/categories/index' })} style={{ fontSize: '28rpx' }}>
            去全部分类
          </Button>
        </View>
      ) : null}

      {plugins.length > 0 ? (
        <View>
          <View style={{ marginBottom: '20rpx', color: '#666666', fontSize: '26rpx' }}>
            <Text>“{activeQuery}” 共 {total} 个结果</Text>
          </View>
          {plugins.map((plugin) => (
            <PluginCard key={plugin.slug} plugin={plugin} />
          ))}
        </View>
      ) : null}

      {error && loadState === 'ready' ? (
        <View style={{ marginBottom: '16rpx', color: '#b42318', fontSize: '26rpx' }}>
          <Text>加载更多失败：{error}</Text>
        </View>
      ) : null}

      {hasMore ? (
        <Button
          disabled={loadingMore}
          onClick={() => void loadPage(activeQuery, page + 1, true)}
          style={{ marginTop: '12rpx', fontSize: '28rpx' }}
        >
          {loadingMore ? '加载中…' : '加载更多'}
        </Button>
      ) : null}
    </View>
  )
}
