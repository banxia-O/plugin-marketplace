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
      <View style={{ padding: '40rpx 32rpx', fontSize: '30rpx' }}>
        <Text>插件详情加载中…</Text>
      </View>
    )
  }

  if (loadState === 'error' || !plugin) {
    return (
      <View style={{ padding: '40rpx 32rpx', fontSize: '30rpx', lineHeight: 1.6 }}>
        <View style={{ marginBottom: '16rpx' }}>
          <Text>插件详情加载失败：{error ?? '未知错误'}</Text>
        </View>
        {slug ? (
          <Button onClick={() => void loadPlugin()} style={{ fontSize: '28rpx' }}>
            重试
          </Button>
        ) : null}
      </View>
    )
  }

  const categoryText = plugin.categories.length
    ? plugin.categories.map((item) => `${item.categoryName} / ${item.subcategoryName}`).join(' · ')
    : '暂无'

  return (
    <View style={{ padding: '40rpx 32rpx 72rpx', fontSize: '28rpx', lineHeight: 1.65 }}>
      <View style={{ marginBottom: '10rpx', fontSize: '40rpx', fontWeight: '700' }}>
        <Text>{plugin.name}</Text>
      </View>
      <View style={{ marginBottom: '28rpx', color: '#555555' }}>
        <Text>{plugin.oneLiner}</Text>
      </View>

      <View style={{ marginBottom: '28rpx', padding: '24rpx', border: '1rpx solid #e5e5e5', borderRadius: '16rpx' }}>
        <View style={{ marginBottom: '10rpx' }}>
          <Text>分类：{categoryText}</Text>
        </View>
        <View style={{ marginBottom: '10rpx' }}>
          <Text>部署方式：{deployMethodLabel[plugin.deployMethod]}</Text>
        </View>
        <View style={{ marginBottom: '10rpx' }}>
          <Text>Stars：{plugin.stars}</Text>
        </View>
        <View style={{ marginBottom: '10rpx' }}>
          <Text>仓库最近更新：{formatDate(plugin.lastRepoUpdate)}</Text>
        </View>
        <View style={{ marginBottom: '10rpx' }}>
          <Text>审核状态：{reviewStatusLabel[plugin.reviewStatus]}</Text>
        </View>
        <View style={{ marginBottom: '10rpx' }}>
          <Text>agent.md：{agentStatusLabel[plugin.agentMdStatus]}</Text>
        </View>
        <View style={{ marginBottom: '10rpx' }}>
          <Text>支持平台：{plugin.supportedPlatforms.length ? plugin.supportedPlatforms.join(' / ') : '暂无'}</Text>
        </View>
        <View style={{ marginBottom: '10rpx' }}>
          <Text>许可证：{plugin.license || '暂无'}</Text>
        </View>
        <View>
          <Text>原作者：{plugin.originalAuthor || '暂无'}</Text>
        </View>
      </View>

      <View style={{ marginBottom: '12rpx', fontSize: '32rpx', fontWeight: '600' }}>
        <Text>原仓库地址</Text>
      </View>
      <View style={{ marginBottom: '14rpx', color: '#555555', wordBreak: 'break-all' }}>
        <Text userSelect>{plugin.repoUrl}</Text>
      </View>
      <Button
        onClick={() => void copyText(plugin.repoUrl, '仓库地址已复制')}
        style={{ marginBottom: '34rpx', fontSize: '28rpx' }}
      >
        复制仓库地址
      </Button>

      <View style={{ marginBottom: '8rpx', fontSize: '34rpx', fontWeight: '700' }}>
        <Text>agent.md</Text>
      </View>
      <View style={{ marginBottom: '20rpx', color: '#777777', fontSize: '24rpx' }}>
        <Text>面向 AI Agent 优化的中文使用手册，用于理解插件用途、安装、配置和验证方式。</Text>
      </View>

      {plugin.agentMd ? (
        <>
          <View style={{ marginBottom: '22rpx', padding: '24rpx', border: '1rpx solid #e5e5e5', borderRadius: '16rpx' }}>
            <MarkdownView source={plugin.agentMd} />
          </View>
          <Button
            onClick={() => void copyText(plugin.agentMd as string, 'agent.md 已复制')}
            style={{ fontSize: '28rpx' }}
          >
            复制 agent.md
          </Button>
        </>
      ) : (
        <View style={{ padding: '24rpx', border: '1rpx solid #e5e5e5', borderRadius: '16rpx', color: '#666666' }}>
          <Text>当前 agent.md 状态：{agentStatusLabel[plugin.agentMdStatus]}。暂无可展示内容。</Text>
        </View>
      )}

      {copyError ? (
        <View style={{ marginTop: '18rpx', color: '#b42318' }}>
          <Text>{copyError}</Text>
        </View>
      ) : null}

      {recentViewError ? (
        <View style={{ marginTop: '18rpx', color: '#b42318' }}>
          <Text>{recentViewError}</Text>
        </View>
      ) : null}
    </View>
  )
}
