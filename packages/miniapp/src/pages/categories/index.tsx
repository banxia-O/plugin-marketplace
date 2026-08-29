import type { Category } from '@ppx/shared'
import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'

import { apiClient } from '../../api/client'

type LoadState = 'loading' | 'ready' | 'error'

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

  const loadCategories = useCallback(async () => {
    setLoadState('loading')
    setError(null)

    try {
      const response = await apiClient.getCategories()
      setCategories(response.categories)
      setLoadState('ready')
    } catch (caught) {
      setCategories([])
      setError(caught instanceof Error ? caught.message : String(caught))
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  const goCategory = (category: Category) => {
    void Taro.navigateTo({
      url: `/pages/category/index?category=${encodeURIComponent(category.slug)}&name=${encodeURIComponent(category.name)}`,
    })
  }

  return (
    <View style={{ padding: '40rpx 32rpx 64rpx', fontSize: '30rpx', lineHeight: 1.6 }}>
      <View style={{ marginBottom: '24rpx', fontSize: '38rpx', fontWeight: '600' }}>
        <Text>全部分类</Text>
      </View>

      {loadState === 'loading' ? (
        <View>
          <Text>分类加载中…</Text>
        </View>
      ) : null}

      {loadState === 'error' ? (
        <View style={{ padding: '24rpx', border: '1rpx solid #e5e5e5', borderRadius: '16rpx' }}>
          <View style={{ marginBottom: '12rpx' }}>
            <Text>分类加载失败：{error}</Text>
          </View>
          <Button onClick={() => void loadCategories()} style={{ fontSize: '28rpx' }}>
            重试
          </Button>
        </View>
      ) : null}

      {loadState === 'ready' ? (
        <View>
          {categories.map((category) => (
            <View
              key={category.slug}
              style={{
                marginBottom: '20rpx',
                padding: '24rpx',
                border: '1rpx solid #e5e5e5',
                borderRadius: '16rpx',
                background: '#ffffff',
              }}
            >
              <View
                onClick={() => goCategory(category)}
                style={{ marginBottom: category.subcategories.length > 0 ? '12rpx' : '0', fontWeight: '600' }}
              >
                <Text>{category.name}</Text>
              </View>
              {category.subcategories.length > 0 ? (
                <View style={{ fontSize: '26rpx', color: '#777777' }}>
                  <Text>{category.subcategories.map((subcategory) => subcategory.name).join(' · ')}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}
