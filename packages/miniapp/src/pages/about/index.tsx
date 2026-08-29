import { Text, View } from '@tarojs/components'

const sensitivityNotice = '请勿输入患者身份信息、未公开研究数据或其他敏感信息。'
const projectRepoUrl = 'https://github.com/banxia-O/plugin-marketplace'

export default function AboutPage() {
  return (
    <View className='page-shell'>
      <View className='page-title'>
        <Text>关于 / 合规</Text>
      </View>
      <View className='page-subtitle'>
        <Text>插件百宝阁（科研版） · 给科研 Agent 找趁手的工具</Text>
      </View>

      <View className='sensitivity-notice'>
        <View className='about-card__title'>
          <Text>科研敏感信息提醒</Text>
        </View>
        <Text>{sensitivityNotice}</Text>
      </View>

      <View className='about-card'>
        <View className='about-card__title'>
          <Text>用户协议（V1）</Text>
        </View>
        <View className='about-paragraph'>
          <Text>本产品提供公开插件信息的检索、分类浏览与整理，帮助你把插件信息交给桌面端 AI Agent 使用。</Text>
        </View>
        <View className='about-paragraph'>
          <Text>插件的实际安装、配置、运行及产生的结果，由你和所使用的 Agent 自行完成与核验。</Text>
        </View>
        <View className='about-paragraph'>
          <Text>第三方插件由其原作者维护。使用前请自行检查插件权限、许可证、代码来源、运行环境和适用性。</Text>
        </View>
        <View className='about-paragraph'>
          <Text>本产品不提供医疗诊断、临床决策或诊疗建议，不应用于替代专业医学判断。</Text>
        </View>
        <View className='about-paragraph'>
          <Text>不得利用本产品从事违法活动，也不要提交患者身份信息、未公开研究数据或其他不应上传的敏感信息。</Text>
        </View>
      </View>

      <View className='about-card'>
        <View className='about-card__title'>
          <Text>隐私说明</Text>
        </View>
        <View className='about-paragraph'>
          <Text>V1 不要求微信登录，不建立微信用户账号体系，也不主动获取微信昵称、头像、手机号、通讯录、精确位置、相册或麦克风信息。</Text>
        </View>
        <View className='about-paragraph'>
          <Text>最近浏览仅保存在当前设备的小程序本地 Storage，用于下次快速找回看过的插件，不上传服务器。</Text>
        </View>
        <View className='about-paragraph'>
          <Text>你输入的搜索关键词会发送至插件百宝阁现有 API，仅用于返回插件搜索结果。因此搜索时只需输入插件名、功能词或科研场景词。</Text>
        </View>
        <View className='about-paragraph'>
          <Text>正式《小程序用户隐私保护指引》将在上线前按照本小程序实际使用的接口、组件、SDK 与数据处理行为在微信公众平台配置。</Text>
        </View>
      </View>

      <View className='about-card'>
        <View className='about-card__title'>
          <Text>数据来源说明</Text>
        </View>
        <View className='about-paragraph'>
          <Text>小程序与现有插件百宝阁网站读取同一套 Cloudflare D1 数据库和 Worker API，不维护第二份插件数据库。</Text>
        </View>
        <View className='about-paragraph'>
          <Text>展示的数据包括插件名称、简介、原仓库、分类、部署方式、Stars、仓库更新时间、原作者、许可证、支持平台、审核状态和 agent.md 等。</Text>
        </View>
        <View className='about-paragraph'>
          <Text>agent.md 为面向 AI Agent 整理的中文使用手册；使用插件时仍应以原作者仓库、许可证和实际代码为最终核验依据。</Text>
        </View>
      </View>

      <View className='about-card'>
        <View className='about-card__title'>
          <Text>第三方 / 开源说明</Text>
        </View>
        <View className='about-paragraph'>
          <Text>目录中的第三方插件由各自原作者或维护者提供。插件百宝阁展示其原作者、原仓库和已记录的许可证信息，不宣称这些插件由本项目开发。</Text>
        </View>
        <View className='about-paragraph'>
          <Text>插件百宝阁项目本身采用 MIT License 开源。</Text>
        </View>
        <View className='about-paragraph'>
          <Text>项目开源仓库：</Text>
        </View>
        <View className='repo-link'>
          <Text userSelect>{projectRepoUrl}</Text>
        </View>
      </View>

      <View className='about-card'>
        <View className='about-card__title'>
          <Text>版本信息</Text>
        </View>
        <View className='about-paragraph'>
          <Text>产品版本：V1</Text>
        </View>
        <View className='about-paragraph'>
          <Text>当前 V1：匿名搜索、分类浏览、插件详情、agent.md、复制与本地最近浏览。</Text>
        </View>
      </View>
    </View>
  )
}
