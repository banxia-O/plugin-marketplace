import { Text, View } from '@tarojs/components'
import { useEffect, useState } from 'react'

import { apiClient } from '../../api/client'

type Status = '请求中' | '成功'

export default function Index() {
  const [categoriesStatus, setCategoriesStatus] = useState<Status>('请求中')
  const [pluginsStatus, setPluginsStatus] = useState<Status>('请求中')
  const [detailStatus, setDetailStatus] = useState<Status>('请求中')
  const [categoryCount, setCategoryCount] = useState<number | null>(null)
  const [samplePluginName, setSamplePluginName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    void (async () => {
      try {
        const categories = await apiClient.getCategories()
        if (!active) return
        setCategoriesStatus('成功')
        setCategoryCount(categories.categories.length)

        const plugins = await apiClient.getPlugins({ page: 1, pageSize: 1 })
        if (!active) return
        setPluginsStatus('成功')

        const sample = plugins.plugins[0]
        if (!sample) {
          throw new Error('/api/plugins 未返回可用于详情验证的插件')
        }

        const detail = await apiClient.getPlugin(sample.slug)
        if (!active) return
        setDetailStatus('成功')
        setSamplePluginName(detail.plugin.name)
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
        <Text>分类读取：{error ? '失败' : categoriesStatus}</Text>
      </View>
      <View>
        <Text>线上分类数量：{error ? '读取失败' : categoryCount ?? '请求中'}</Text>
      </View>
      <View>
        <Text>插件列表读取：{error ? '失败' : pluginsStatus}</Text>
      </View>
      <View>
        <Text>插件详情读取：{error ? '失败' : detailStatus}</Text>
      </View>
      <View>
        <Text>验证插件：{error ? '读取失败' : samplePluginName ?? '请求中'}</Text>
      </View>
      {error ? (
        <View style={{ marginTop: '24rpx' }}>
          <Text>错误：{error}</Text>
        </View>
      ) : null}
    </View>
  )
}
