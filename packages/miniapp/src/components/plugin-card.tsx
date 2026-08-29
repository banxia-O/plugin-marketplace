import type { PluginSummary } from '@ppx/shared'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'

const deployMethodLabel = {
  local: '本地部署',
  remote: '远程服务',
  both: '本地 / 远程',
} as const

const reviewStatusLabel = {
  verified: '已审核',
  basic: '基础审核',
  rejected: '未通过',
} as const

const agentMdStatusLabel = {
  ok: 'agent.md 可用',
  pending: 'agent.md 生成中',
  incomplete: 'agent.md 待完善',
} as const

type PluginCardProps = {
  plugin: PluginSummary
}

export function PluginCard({ plugin }: PluginCardProps) {
  const visibleCategories = plugin.categories.slice(0, 2)

  return (
    <View
      onClick={() =>
        void Taro.navigateTo({
          url: `/pages/plugin/index?slug=${encodeURIComponent(plugin.slug)}`,
        })
      }
      style={{
        marginBottom: '20rpx',
        padding: '24rpx',
        border: '1rpx solid #e5e5e5',
        borderRadius: '16rpx',
        background: '#ffffff',
      }}
    >
      <View style={{ marginBottom: '8rpx', fontSize: '32rpx', fontWeight: '600' }}>
        <Text>{plugin.name}</Text>
      </View>
      <View style={{ marginBottom: '14rpx', fontSize: '27rpx', color: '#555555' }}>
        <Text>{plugin.oneLiner}</Text>
      </View>

      {visibleCategories.length > 0 ? (
        <View style={{ marginBottom: '12rpx', fontSize: '24rpx', color: '#777777' }}>
          <Text>
            {visibleCategories
              .map((category) => `${category.categoryName} · ${category.subcategoryName}`)
              .join('  /  ')}
          </Text>
        </View>
      ) : null}

      <View style={{ fontSize: '24rpx', color: '#666666' }}>
        <Text>
          {deployMethodLabel[plugin.deployMethod]} · Stars {plugin.stars} ·{' '}
          {reviewStatusLabel[plugin.reviewStatus]} · {agentMdStatusLabel[plugin.agentMdStatus]}
        </Text>
      </View>
    </View>
  )
}
