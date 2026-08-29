import { Button, Input, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'

import { HOME_CATEGORY_SHORTCUTS } from '../../config/home'

const sensitivityNotice = '请勿输入患者身份信息、未公开研究数据或其他敏感信息。'

export default function Index() {
  const [keyword, setKeyword] = useState('')

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

  return (
    <View style={{ padding: '40rpx 32rpx 64rpx', fontSize: '30rpx', lineHeight: 1.6 }}>
      <View style={{ marginBottom: '8rpx', fontSize: '42rpx', fontWeight: '600' }}>
        <Text>插件百宝阁（科研版）</Text>
      </View>
      <View style={{ marginBottom: '28rpx', color: '#666666' }}>
        <Text>给科研 Agent 找趁手的工具</Text>
      </View>

      <View style={{ marginBottom: '16rpx', fontSize: '24rpx', color: '#777777' }}>
        <Text>{sensitivityNotice}</Text>
      </View>

      <View style={{ marginBottom: '40rpx' }}>
        <Input
          value={keyword}
          placeholder='搜插件、功能或科研场景'
          confirmType='search'
          onInput={(event) => setKeyword(event.detail.value)}
          onConfirm={(event) => goSearch(event.detail.value)}
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
        <Button
          onClick={() => goSearch(keyword)}
          style={{ marginTop: '16rpx', fontSize: '30rpx' }}
        >
          搜索
        </Button>
      </View>

      <View style={{ marginBottom: '20rpx', fontSize: '34rpx', fontWeight: '600' }}>
        <Text>科研高频分类</Text>
      </View>
      <View style={{ display: 'flex', flexWrap: 'wrap', gap: '16rpx', marginBottom: '28rpx' }}>
        {HOME_CATEGORY_SHORTCUTS.map((category) => (
          <View
            key={category.slug}
            onClick={() => goCategory(category.slug, category.name)}
            style={{
              boxSizing: 'border-box',
              width: 'calc(50% - 8rpx)',
              padding: '24rpx',
              border: '1rpx solid #e5e5e5',
              borderRadius: '16rpx',
              background: '#ffffff',
            }}
          >
            <Text>{category.name}</Text>
          </View>
        ))}
      </View>

      <Button
        onClick={() => void Taro.navigateTo({ url: '/pages/categories/index' })}
        style={{ marginBottom: '20rpx', fontSize: '30rpx' }}
      >
        全部分类
      </Button>

      <View
        onClick={() => void Taro.navigateTo({ url: '/pages/about/index' })}
        style={{ padding: '20rpx 0', textAlign: 'center', color: '#666666' }}
      >
        <Text>关于 / 隐私</Text>
      </View>
    </View>
  )
}
