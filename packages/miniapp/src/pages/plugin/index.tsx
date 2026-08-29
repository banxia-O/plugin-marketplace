import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'

export default function PluginPage() {
  const rawSlug = Taro.getCurrentInstance().router?.params.slug ?? ''
  const slug = rawSlug ? decodeURIComponent(rawSlug) : ''

  return (
    <View style={{ padding: '40rpx 32rpx', fontSize: '30rpx', lineHeight: 1.6 }}>
      <View style={{ marginBottom: '16rpx', fontSize: '38rpx', fontWeight: '600' }}>
        <Text>插件详情</Text>
      </View>
      <View style={{ marginBottom: '12rpx', color: '#666666' }}>
        <Text>插件标识：{slug || '缺失'}</Text>
      </View>
      <View style={{ color: '#777777', fontSize: '26rpx' }}>
        <Text>详情内容与 agent.md 将在 Step 4 实现。</Text>
      </View>
    </View>
  )
}
