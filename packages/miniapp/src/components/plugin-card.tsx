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
  const reviewBadgeClass = plugin.reviewStatus === 'rejected' ? 'badge badge--danger' : 'badge badge--status'
  const agentBadgeClass =
    plugin.agentMdStatus === 'ok'
      ? 'badge badge--ok'
      : plugin.agentMdStatus === 'pending'
        ? 'badge badge--warning'
        : 'badge badge--status'

  return (
    <View
      className='plugin-card'
      onClick={() =>
        void Taro.navigateTo({
          url: `/pages/plugin/index?slug=${encodeURIComponent(plugin.slug)}`,
        })
      }
    >
      <View className='plugin-card__title'>
        <Text>{plugin.name}</Text>
      </View>
      <View className='plugin-card__desc'>
        <Text>{plugin.oneLiner}</Text>
      </View>

      {visibleCategories.length > 0 ? (
        <View className='badge-row'>
          {visibleCategories.map((category) => (
            <Text key={`${category.categorySlug}-${category.subcategorySlug}`} className='badge'>
              {category.categoryName} · {category.subcategoryName}
            </Text>
          ))}
        </View>
      ) : null}

      <View className='badge-row'>
        <Text className='badge badge--deploy'>{deployMethodLabel[plugin.deployMethod]}</Text>
        <Text className={reviewBadgeClass}>{reviewStatusLabel[plugin.reviewStatus]}</Text>
        <Text className={agentBadgeClass}>{agentMdStatusLabel[plugin.agentMdStatus]}</Text>
      </View>

      <View className='meta-line'>
        <Text>Stars {plugin.stars}</Text>
      </View>
    </View>
  )
}
