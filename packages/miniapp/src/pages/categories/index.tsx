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
    <View className='page-shell'>
      <View className='page-title'>
        <Text>全部分类</Text>
      </View>
      <View className='page-subtitle'>
        <Text>点击大类进入插件列表</Text>
      </View>

      {loadState === 'loading' ? (
        <View className='status-panel status-panel--loading'>
          <Text>分类加载中…</Text>
        </View>
      ) : null}

      {loadState === 'error' ? (
        <View className='status-panel status-panel--error'>
          <View className='status-panel__message'>
            <Text>分类加载失败：{error}</Text>
          </View>
          <Button className='btn btn-ghost btn-compact' onClick={() => void loadCategories()}>
            重试
          </Button>
        </View>
      ) : null}

      {loadState === 'ready' ? (
        <View>
          {categories.map((category) => (
            <View key={category.slug} className='card tap-card category-card' onClick={() => goCategory(category)}>
              <View className='category-card__title'>
                <Text>{category.name}</Text>
              </View>
              {category.subcategories.length > 0 ? (
                <View className='category-card__subs'>
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
