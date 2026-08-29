import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'

import { API_BASE_URL } from '../../config/api'

type CategoriesPayload = {
  categories?: unknown
}

export default function Index() {
  const [healthStatus, setHealthStatus] = useState<'请求中' | '成功'>('请求中')
  const [categoryCount, setCategoryCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    void (async () => {
      try {
        const healthResponse = await Taro.request({
          url: `${API_BASE_URL}/api/health`,
          method: 'GET',
        })
        if (healthResponse.statusCode < 200 || healthResponse.statusCode >= 300) {
          throw new Error(`/api/health 请求失败（HTTP ${healthResponse.statusCode}）`)
        }

        const categoriesResponse = await Taro.request<CategoriesPayload>({
          url: `${API_BASE_URL}/api/categories`,
          method: 'GET',
        })
        if (categoriesResponse.statusCode < 200 || categoriesResponse.statusCode >= 300) {
          throw new Error(`/api/categories 请求失败（HTTP ${categoriesResponse.statusCode}）`)
        }

        const categories = categoriesResponse.data.categories
        if (!Array.isArray(categories)) {
          throw new Error('/api/categories 返回结构不符合预期')
        }

        if (!active) return
        setHealthStatus('成功')
        setCategoryCount(categories.length)
      } catch (caught) {
        if (!active) return
        setError(caught instanceof Error ? caught.message : String(caught))
      }
    })()

    return () => {
      active = false
    }
  }, [])

  return (
    <View style={{ padding: '48rpx 32rpx', fontSize: '30rpx', lineHeight: 1.8 }}>
      <View style={{ marginBottom: '32rpx', fontSize: '40rpx', fontWeight: '600' }}>
        <Text>插件百宝阁（科研版）</Text>
      </View>
      <View>
        <Text>API 健康检查：{error ? '失败' : healthStatus}</Text>
      </View>
      <View>
        <Text>线上分类数量：{error ? '读取失败' : categoryCount ?? '请求中'}</Text>
      </View>
      {error ? (
        <View style={{ marginTop: '24rpx' }}>
          <Text>错误：{error}</Text>
        </View>
      ) : null}
    </View>
  )
}
