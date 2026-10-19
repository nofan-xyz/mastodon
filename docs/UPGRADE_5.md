# Mastodon 5.0 适配记录

## 范围与基线

- 2026-10-19 开始，分支 `codex/upgrade-mastodon-5`，独立工作区 `/home/twoheart/projects/mastodon-5`。
- nofan 基线：v4.7.3.3，`0afb546c7d8139688642c80c1cc14d6e17335317`。
- 评估目标：上游 `2a3b728653dd6b067650358133f92bee956f6da0`，自报 5.0.0-alpha.1；不是正式版。
- 先让官方默认界面和现有核心功能运行，再移植全部主题；不以隐藏功能或清空用户偏好作为兼容方案。
- 原工作区未提交的 `docs/CUSTOMIZATIONS.md`、`docs/MARKDOWN.md` 保留在原处，本分支从已提交版本建立。

## 阶段状态

| 阶段 | 状态 | 完成条件 |
| --- | --- | --- |
| 完整定制盘点 | 已完成源码盘点 | 见 CUSTOMIZATIONS.md，包含 3 个 flavour、13 个 skin |
| 独立分支与测试环境 | 分支已创建，环境待建立 | 独立数据库/Redis，外发邮件与联邦任务禁用，不连接生产数据服务 |
| 上游合并与默认界面 | 待处理 | 解决冲突，Rails/TS 检查和默认主题构建通过 |
| 核心定制迁移 | 待处理 | 富文本、那年今日、账号切换、搜索、表情和访客入口可用 |
| 主题兼容 | 待处理 | 保留用户偏好，各主题深浅模式及手机/桌面验收 |
| 数据库与升级演练 | 待处理 | 从 4.7 测试数据升级，检验迁移、联邦密钥及回滚路径 |
| 正式版发布上线 | 等待正式版 | 复核正式升级说明，PR/镜像/备份/部署/公网验收 |

## 已确认的适配点

| 项目 | 上游变化/接入位置 | 验收重点 |
| --- | --- | --- |
| 新发帖框 | `features/compose/redesign/`、`reducers/slices/composer.ts` | 格式选择、默认值、最小化草稿、5000 字、回复/编辑/警告/媒体/定时发布 |
| 新导航 | `features/navigation_panel/redesign/` | 那年今日、账号切换、手机和高级界面入口 |
| 那年今日页面 | 新 ColumnHeader、`components/status` | 消除旧组件引用、帖子操作、23:00/00:00/00:05、旧响应丢弃、删除过滤 |
| 账号切换 | 新账号卡片、ReauthConcern、sign-in token | 草稿提示、失效会话、2FA、安全密钥、跨标签页以及资料卡 |
| 主题 | 上游 `theme/color/density` 与本地 `flavour/skin` | 兼容已有设置、构建插件、配色变量及新 DOM |
| 搜索 | Query.validate_clauses! | 仅筛选请求、from:me/in:library 特例、中文词组及日期边界 |
| 表情 | 新发帖框及 Status DOM | 个人选包、排序/编号、放大预览和后台管理 |
| 品牌入口 | 新 FooterLinks 和导航、路由变化 | 欢迎页、登录落点、品牌资源、Donate/Roadmap |

## 合并与发布注意事项

首次只读 merge-tree 预检：89 个冲突文件，其中 59 个翻译文件、30 个其他文件。部分来自 stable 分支回移提交，并非全部由 nofan 定制造成；必须比较两边实际代码。

上游新增 `db/post_migrate/20261016161747_remove_private_key_from_accounts.rb`；4.7 已将本地私钥迁至 `keypairs`，仍须验证历史迁移完整执行。删除字段后的回滚不能仅假设更换旧镜像即可。

当前目标构建配置为 Ruby 4.0.7 / Node 26，最终最低要求以正式版为准。线上只读基线：Rails v4.7.3.3、Streaming v4.7.3.0、PostgreSQL 14、Redis 7、Elasticsearch 8.19.15。不要把开发环境依赖版本与服务最低版本混淆。

## 验证记录

- 2026-10-19：完成源码盘点与上游预检；尚未执行合并后测试。

## 官方参考

- https://blog.joinmastodon.org/2026/10/5.0-a-closer-look/
- https://github.com/mastodon/mastodon/releases
- https://github.com/mastodon/mastodon/pull/40236
