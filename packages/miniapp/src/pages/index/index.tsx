import { Button, Input, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'

import { HOME_CATEGORY_SHORTCUTS } from '../../config/home'
import { clearRecentViews, getRecentViews, type RecentView } from '../../storage/recent-views'

const sensitivityNotice = '请勿输入患者身份信息、未公开研究数据或其他敏感信息。'

export default function Index() {
  const [keyword, setKeyword] = useState('')
  const [recentViews, setRecentViews] = useState<RecentView[]>([])
  const [recentError, setRecentError] = useState<string | null>(null)

  const loadRecentViews = async () => {
    try {
      const views = await getRecentViews()
      setRecentViews(views.slice(0, 6))
      setRecentError(null)
    } catch (caught) {
      setRecentError(caught instanceof Error ? caught.message : String(caught))
    }
  }

  useDidShow(() => {
    void loadRecentViews()
  })

  const goSearch = (rawKeyword: string) => {
    const q = rawKeyword.trim()
    if (!q) return

    void Taro.navigateTo({
      url: `/pages/search/index?q=${encodeURIComponent(q)}`,
    })
  }

  const goCategory = (slug: string, name: string) => {
    void Taro.navigateTo({
      url: `/pages/category/index?category=${encodeURIComponent(slug)}&name=${encodeURIComponent(name)}`,
    })
  }

  const goPlugin = (slug: string) => {
    void Taro.navigateTo({
      url: `/pages/plugin/index?slug=${encodeURIComponent(slug)}`,
    })
  }

  const clearRecent = async () => {
    try {
      await clearRecentViews()
      setRecentViews([])
      setRecentError(null)
    } catch (caught) {
      setRecentError(caught instanceof Error ? caught.message : String(caught))
    }
  }

  return (
    <View className='page-shell'>
      <View className='hero'>
        <View className='hero-title'>
          <Text>插件百宝阁（科研版）</Text>
        </View>
        <View className='hero-subtitle'>
          <Text>给科研 Agent 找趁手的工具</Text>
        </View>
      </View>

      <View className='sensitivity-notice'>
        <Text>{sensitivityNotice}</Text>
      </View>

      <View className='section'>
        <Input
          className='search-input'
          value={keyword}
          placeholder='搜插件、功能或科研场景'
          confirmType='search'
          onInput={(event) => setKeyword(event.detail.value)}
          onConfirm={(event) => goSearch(event.detail.value)}
        />
        <Button className='btn btn-primary' onClick={() => goSearch(keyword)} style={{ marginTop: '16rpx' }}>
          搜索
        </Button>
      </View>

      {recentViews.length > 0 ? (
        <View className='section'>
          <View className='section-header'>
            <Text className='section-title'>最近浏览</Text>
            <Text className='text-action' onClick={() => void clearRecent()}>
              清空
            </Text>
          </View>
          <View className='recent-list'>
            {recentViews.map((view) => (
              <View key={view.slug} className='card tap-card recent-card' onClick={() => goPlugin(view.slug)}>
                <View className='recent-card__title'>
                  <Text>{view.name}</Text>
                </View>
                <View className='recent-card__desc'>
                  <Text>{view.oneLiner}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {recentError ? (
        <View className='error-text'>
          <Text>最近浏览读取失败：{recentError}</Text>
        </View>
      ) : null}

      <View className='section'>
        <View className='section-header'>
          <Text className='section-title'>科研高频分类</Text>
        </View>
        <View className='category-grid'>
          {HOME_CATEGORY_SHORTCUTS.map((category) => (
            <View
              key={category.slug}
              className='category-shortcut'
              onClick={() => goCategory(category.slug, category.name)}
            >
              <Text>{category.name}</Text>
            </View>
          ))}
        </View>
      </View>

      <Button className='btn btn-secondary' onClick={() => void Taro.navigateTo({ url: '/pages/categories/index' })}>
        全部分类
      </Button>

      <View className='footer-link' onClick={() => void Taro.navigateTo({ url: '/pages/about/index' })}>
        <Text>关于 / 隐私</Text>
      </View>
    </View>
  )
}
