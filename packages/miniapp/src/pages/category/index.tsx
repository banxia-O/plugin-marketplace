import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'

export default function CategoryPage() {
  const params = Taro.getCurrentInstance().router?.params
  const category = params?.category ? decodeURIComponent(params.category) : ''
  const name = params?.name ? decodeURIComponent(params.name) : category

  return (
    <View style={{ padding: '40rpx 32rpx', fontSize: '30rpx', lineHeight: 1.6 }}>
      <View style={{ marginBottom: '16rpx', fontSize: '38rpx', fontWeight: '600' }}>
        <Text>{name || '分类'}</Text>
      </View>
      <View style={{ color: '#777777' }}>
        <Text>分类标识：{category}</Text>
      </View>
    </View>
  )
}
