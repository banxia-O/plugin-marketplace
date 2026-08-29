import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'

const sensitivityNotice = '请勿输入患者身份信息、未公开研究数据或其他敏感信息。'

export default function SearchPage() {
  const rawQuery = Taro.getCurrentInstance().router?.params.q ?? ''
  const query = rawQuery ? decodeURIComponent(rawQuery) : ''

  return (
    <View style={{ padding: '40rpx 32rpx', fontSize: '30rpx', lineHeight: 1.6 }}>
      <View style={{ marginBottom: '20rpx', fontSize: '38rpx', fontWeight: '600' }}>
        <Text>搜索结果</Text>
      </View>
      <View style={{ marginBottom: '16rpx' }}>
        <Text>关键词：{query}</Text>
      </View>
      <View style={{ fontSize: '24rpx', color: '#777777' }}>
        <Text>{sensitivityNotice}</Text>
      </View>
    </View>
  )
}
