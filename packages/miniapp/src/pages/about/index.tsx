import { Text, View } from '@tarojs/components'

const sensitivityNotice = '请勿输入患者身份信息、未公开研究数据或其他敏感信息。'

export default function AboutPage() {
  return (
    <View style={{ padding: '40rpx 32rpx', fontSize: '30rpx', lineHeight: 1.6 }}>
      <View style={{ marginBottom: '20rpx', fontSize: '38rpx', fontWeight: '600' }}>
        <Text>关于 / 隐私</Text>
      </View>
      <View style={{ marginBottom: '16rpx' }}>
        <Text>插件百宝阁（科研版）</Text>
      </View>
      <View style={{ fontSize: '26rpx', color: '#777777' }}>
        <Text>{sensitivityNotice}</Text>
      </View>
    </View>
  )
}
