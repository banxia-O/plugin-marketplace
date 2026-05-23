# 🏪 插件百宝阁

> 给你的 AI 找趁手的工具

[![License: MIT](https://img.shields.io/badge/License-MIT-9B8FFF.svg)](LICENSE)

国内面向非技术用户的 AI Agent 插件精选市场。

🔗 **站点**：[plugin.md-banxia.cn](https://plugin.md-banxia.cn)

---

## 这是什么？

MCP 插件生态正在爆发，但国内用户面临三大痛点：

1. **不知道有什么插件** — 优质插件散落在 GitHub 各处，没有中文集中入口
2. **不会装** — 安装配置对非程序员来说门槛太高
3. **不知道好不好用** — 缺乏中文评价和使用说明

插件百宝阁要做的事：把好用的 MCP 插件收集起来，给每个插件写一份中文 **agent.md**，让用户只需要给 AI 一个链接，AI 就能自己完成安装、配置、验证，并引导用户提供必要的种子数据。

**无脑到什么程度？** 一个初中生手里有个 Agent，告诉 Agent "我需要 XX 功能"，Agent 在这里找到插件，读完 agent.md，装好，搞定。

---

## 核心特性

- 📂 **按功能分类浏览** — 12 大类，覆盖信息检索、办公协作、科研学术等场景
- 📖 **agent.md** — 每个插件配备中文使用手册，Agent 读完即可全流程跑通
- 🔍 **中文搜索** — 大白话搜"翻译""微信""写论文"就能找到对应插件
- 🏷️ **部署方式标注** — 明确标注本地部署/远程服务/两者皆可，避免装了用不了
- 🤖 **Agent 友好** — Agent 可独立注册账户、浏览下载，与 User 绑定共享积分
- 🔒 **安全审核** — AI 自动审核许可证合规、依赖漏洞、代码行为

---

## 项目文档

| 文档 | 说明 |
|------|------|
| [`插件百宝阁-PRD.md`](插件百宝阁-PRD.md) | 产品需求文档（功能、流程、版本规划） |
| [`插件百宝阁-分类体系.md`](插件百宝阁-分类体系.md) | 12 大类 + 子类定义、数据库表结构、V1 内容预判 |
| [`插件百宝阁-前端设计规范.md`](插件百宝阁-前端设计规范.md) | 配色、字体、组件样式、布局、响应式、动效规范 |

> CC 开工前请按顺序读完以上三份文档。第一件事：建 `docs/` 目录，把三份文档移进去并重命名（去掉"插件百宝阁-"前缀）。

---

## 技术栈

| 层 | 方案 |
|----|------|
| 前端 | React + CF Pages |
| 后端 | Cloudflare Workers |
| 数据库 | Cloudflare D1 (SQLite) |
| 缓存 | Cloudflare KV |
| 认证 | JWT |
| 审核工作流 | 墨衍 VPS + DeepSeek flash API |
| 域名 | plugin.md-banxia.cn → Cloudflare |

---

## 项目结构（规划）

```
plugin-marketplace/
├── 插件百宝阁-PRD.md            # 产品需求文档
├── 插件百宝阁-分类体系.md        # 分类体系定义
├── 插件百宝阁-前端设计规范.md     # 前端设计规范
├── frontend/                   # React 前端（CF Pages）[待建]
├── worker/                     # Cloudflare Workers 后端 API [待建]
├── scripts/                    # 工具脚本 [待建]
│   └── seed/                   # 冷启动：批量爬取+生成 agent.md
├── README.md
└── LICENSE
```

---

## 版本规划

**V1（MVP）** — 插件浏览 + 搜索 + agent.md 展示 + 用户注册 + 工作流审核

**V2** — Credits 积分系统 + Agent 账户 + 用户上传 + 社交验证

**V3** — 版本追踪 + 一键配置生成器 + API 接口 + 组合推荐

---

## 贡献

欢迎提交 Issue 和 PR。如果你有好用的 MCP 插件想推荐，欢迎在 Issue 中提交插件信息。

---

## 许可证

[MIT License](LICENSE)

---

<p align="center">
  Made with 💜 by <a href="https://github.com/banxia-O">半夏</a>
</p>
