# 2026-10-28 上游同步与共享数据发布

## 固定版本与范围

本次从上游 main 新增合并 65 个提交，固定 `68f6e597ee81f9146f0aeb876150cd389af5991e`，本站应用构建 `8c3aaaf494798b7ba2a454d1e9ac0fced00d6d73`。版本仍为 Mastodon 5.0.0-alpha.1 开发快照。

上游更新包括：内容警告添加、删除与空值校验；嵌套引用样式；媒体隐藏按钮统一；手机导航间距及高级界面发帖框占用高度；独立发帖页导航误提示；Inter Semibold 字重和正文行高；包含百分号的服务条款/隐私政策接口；Sidekiq 调度类名修正；UTS58 文本识别及相关依赖更新。Ruby 更新到 4.0.9。保留 nofan 自定义主题、账号切换、那年今日预处理和新旧版本共库适配。

合并唯一冲突位于镜像工作流的 Docker Hub 登录条件：保留本站 `twoheart/` 镜像命名条件，接纳上游新版构建 action。没有新增数据库迁移。本次只更新 5.0 Web、三组消费者与 Streaming 镜像；4.7 Web、规范域名、数据库、Redis 分工和媒体设置保持既有配置。

## 构建与验证

[镜像构建 40539074199](https://github.com/nofan-xyz/mastodon/actions/runs/40539074199) 的 Rails、Streaming amd64/arm64 及 manifest 合并全部成功。

- Rails：`ghcr.io/nofan-xyz/mastodon@sha256:66c5c31c5937e2c78d64bc3c8d91e649d5ea4ce198c4b3658b71a2445837a5f7`。
- Streaming：`ghcr.io/nofan-xyz/mastodon-streaming@sha256:9feab6157f3f88c876d90e70a328691f701f02a5ca8969b14042f95ff3758fdb`。
- Rails 镜像 5039 份应用、配置、数据库、依赖和 Streaming 源文件匹配固定源码；Streaming 镜像另外检查源文件、依赖锁与版本元数据。
- 前端 TypeScript、生产构建、相关 ESLint/Stylelint/格式检查、相关 Ruby lint 通过。
- JavaScript 4255 项测试通过；Ruby 文本、接口、调度、共库设置、WebAuthn、那年今日及外观请求 222 项测试通过。
- Chromium 109、当前 Chromium、Windows Edge 156.0.4314.50、Chrome 156.0.8078.48，共 48 个生产构建菜单/表情/悬停场景通过。Mastodon、X UI、Tangerine 深浅模式及手机/桌面均覆盖。
- Windows Edge 另有 12 个账号切换与内容警告添加/编辑/删除场景通过，手机账号箭头目标至少 44×44px；72 个顶部滚动遮挡、240 个皮肤菜单对比度组合通过。

Streaming 独立 `typecheck` 仍报告上游既有的 JSDoc 类型语法、缺少 jsdom 声明等错误。相关 index.js、utils.js 与本次合并前及上游源码一致；对照旧文件同样报错。本次未以放宽检查、删注释或大改 Streaming 类型掩盖结果；Streaming lint/语法检查及实际 HTTP、认证 WebSocket 分发另外验收，不能把前端 typecheck 通过说成 Streaming 全量静态类型通过。

## 隔离环境

`/home/mastodon-shared-rehearsal` 使用独立 PostgreSQL/Redis、专用 beta 桶前缀，禁用联邦外发、邮件和周期调度。新 Streaming 通过 `compose.20261028.json` 最后覆盖；4.7/5.0 均不连接正式数据库进行写入测试。

双版本验收包括密码与 TOTP、防重放、共享登录限流、OAuth 身份、发帖/编辑/删除及幂等、收藏/书签/转发、通知、认证 WebSocket 分发、媒体与头像上传、纯文本/Markdown/HTML、安全过滤、并发偏好写入、双向站点设置和 FASP 双向兼容。FASP 第一轮因上次固定测试 provider 已存在而停止，改用本次独立命名后补测，未据此修改业务逻辑。

本次新增 `deploy/shared/update_application_release.py`：要求固定镜像/源码/旧镜像及完整验收清单，先检查无待迁移，再优雅停止消费者并更新应用角色；健康和正式认证只读验收失败时恢复原 Compose/镜像，保留正式数据，不执行数据库迁移或旧备份覆盖。

## 发布状态

北京时间2026-10-28 00:36完成线上切换。beta 公网版本为 `5.0.0.0-alpha.1+beta-8c3aaaf494798b7ba2a454d1e9ac0fced00d6d73`；正式站和ban.fan仍为 `4.7.3.3+shared47-1d03b99d8412785da33b127eb72336d0898045bc`。9个服务健康，三组消费者、一个scheduler消费者；新兼容错误零。已有retry=67、dead=9999为历史队列，未清空。正式身份的资料、公共偏好、主页及通知只读一致，签名密钥和已启用TOTP可解密。三个公网入口的health、sw.js、登录页引用的本站JS/CSS成功回读，ban.fan资源仍使用ban.fan域名。回退记录目录 `/home/mastodon/shared-rollout/20261027T163454Z-application`，没有运行数据库迁移。ban.fan 本次不调整 nginx、协议、缓存或线路；跨域修复、静态缓存和 HTTP/1.1 属于近期已完成项目，不能写成本次新增改动，也不能据此宣称所有运营商冷启动已解决。
