import type { PluginDetail } from '@ppx/shared'
import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'

import { apiClient } from '../../api/client'
import { MarkdownView } from '../../components/markdown-view'
import { recordRecentView } from '../../storage/recent-views'

type LoadState = 'loading' | 'ready' | 'error'

const deployMethodLabel: Record<PluginDetail['deployMethod'], string> = {
  local: '本地部署',
  remote: '远程服务',
  both: '本地 / 远程均可',
}

const reviewStatusLabel: Record<PluginDetail['reviewStatus'], string> = {
  verified: '已审核',
  basic: '基础审核',
  rejected: '未通过',
}

const agentStatusLabel: Record<PluginDetail['agentMdStatus'], string> = {
  ok: '可用',
  pending: '生成中',
  incomplete: '待完善',
}

function formatDate(value: string | null): string {
  return value ? value.slice(0, 10) : '暂无'
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View className='detail-row'>
      <Text className='detail-label'>{label}</Text>
      <Text className='detail-value'>{value}</Text>
    </View>
  )
}

export default function PluginPage() {
  const rawSlug = Taro.getCurrentInstance().router?.params.slug ?? ''
  const slug = rawSlug ? decodeURIComponent(rawSlug) : ''
  const [plugin, setPlugin] = useState<PluginDetail | null>(null)
  const [loadState, setLoadState] = useState<LoadState>(slug ? 'loading' : 'error')
  const [error, setError] = useState<string | null>(slug ? null : '缺少插件标识')
  const [copyError, setCopyError] = useState<string | null>(null)
  const [recentViewError, setRecentViewError] = useState<string | null>(null)

  const loadPlugin = useCallback(async () => {
    if (!slug) return

    setLoadState('loading')
    setError(null)
    setRecentViewError(null)

    try {
      const response = await apiClient.getPlugin(slug)
      const detail = response.plugin
      setPlugin(detail)
      setLoadState('ready')

      try {
        await recordRecentView({
          slug: detail.slug,
          name: detail.name,
          oneLiner: detail.oneLiner,
          lastViewedAt: Date.now(),
        })
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught)
        setRecentViewError(`最近浏览保存失败：${message}`)
      }
    } catch (caught) {
      setPlugin(null)
      setError(caught instanceof Error ? caught.message : String(caught))
      setLoadState('error')
    }
  }, [slug])

  useEffect(() => {
    void loadPlugin()
  }, [loadPlugin])

  const copyText = async (value: string, successTitle: string) => {
    setCopyError(null)
    try {
      await Taro.setClipboardData({ data: value })
      await Taro.showToast({ title: successTitle, icon: 'success' })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught)
      setCopyError(`复制失败：${message}`)
    }
  }

  if (loadState === 'loading') {
    return (
      <View className='page-shell'>
        <View className='status-panel status-panel--loading'>
          <Text>插件详情加载中…</Text>
        </View>
      </View>
    )
  }

  if (loadState === 'error' || !plugin) {
    return (
      <View className='page-shell'>
        <View className='status-panel status-panel--error'>
          <View className='status-panel__message'>
            <Text>插件详情加载失败：{error ?? '未知错误'}</Text>
          </View>
          {slug ? (
            <Button className='btn btn-ghost btn-compact' onClick={() => void loadPlugin()}>
              重试
            </Button>
          ) : null}
        </View>
      </View>
    )
  }

  const categoryText = plugin.categories.length
    ? plugin.categories.map((item) => `${item.categoryName} / ${item.subcategoryName}`).join(' · ')
    : '暂无'

  return (
    <View className='page-shell'>
      <View className='page-title'>
        <Text>{plugin.name}</Text>
      </View>
      <View className='page-subtitle'>
        <Text>{plugin.oneLiner}</Text>
      </View>

      <View className='detail-card'>
        <DetailRow label='分类' value={categoryText} />
        <DetailRow label='部署方式' value={deployMethodLabel[plugin.deployMethod]} />
        <DetailRow label='Stars' value={plugin.stars} />
        <DetailRow label='仓库更新' value={formatDate(plugin.lastRepoUpdate)} />
        <DetailRow label='审核状态' value={reviewStatusLabel[plugin.reviewStatus]} />
        <DetailRow label='agent.md' value={agentStatusLabel[plugin.agentMdStatus]} />
        <DetailRow label='许可证' value={plugin.license || '暂无'} />
        <DetailRow label='原作者' value={plugin.originalAuthor || '暂无'} />
      </View>

      <View className='section'>
        <View className='section-header'>
          <Text className='section-title'>原仓库地址</Text>
        </View>
        <View className='repo-box'>
          <Text userSelect>{plugin.repoUrl}</Text>
        </View>
        <Button className='btn btn-secondary' onClick={() => void copyText(plugin.repoUrl, '仓库地址已复制')}>
          复制仓库地址
        </Button>
      </View>

      <View className='section'>
        <View className='section-header'>
          <View>
            <View className='section-title'>
              <Text>agent.md</Text>
            </View>
            <View className='section-note'>
              <Text>面向 AI Agent 优化的中文使用手册，用于理解插件用途、安装、配置和验证方式。</Text>
            </View>
          </View>
        </View>

        {plugin.agentMd ? (
          <>
            <View className='markdown-card'>
              <MarkdownView source={plugin.agentMd} />
            </View>
            <Button className='btn btn-primary' onClick={() => void copyText(plugin.agentMd as string, 'agent.md 已复制')}>
              复制 agent.md
            </Button>
          </>
        ) : (
          <View className='status-panel status-panel--empty'>
            <Text>当前 agent.md 状态：{agentStatusLabel[plugin.agentMdStatus]}。暂无可展示内容。</Text>
          </View>
        )}
      </View>

      {copyError ? (
        <View className='error-text'>
          <Text>{copyError}</Text>
        </View>
      ) : null}

      {recentViewError ? (
        <View className='error-text'>
          <Text>{recentViewError}</Text>
        </View>
      ) : null}
    </View>
  )
}
