# 2026-11-04 Beta 上游同步与表情分类栏发布

北京时间 2026-11-04 完成部署。版本为 `5.0.0.0-alpha.2+beta-cc0f26e0729ff156d622b663106de77561fece3b`，仍为 5.0 alpha.2 测试版。本次包含上游 main 截至 `2676e857b32489688dfaf4ea002e6cd5b1d51bba` 的 58 个提交，以及用户追加要求的「nofan 表情包分类栏易用性更新」。

## 固定来源

- 最终源码：`cc0f26e0729ff156d622b663106de77561fece3b`；最初仅合并上游的 `22fc1ffbb5` 候选没有切换到生产。
- 构建：https://github.com/nofan-xyz/mastodon/actions/runs/41666418778 ，Rails 与 Streaming 双架构构建和 manifest 全部成功；Streaming 源码未变，生产保留原镜像。
- 最终 Rails 镜像：`ghcr.io/nofan-xyz/mastodon@sha256:b322dccde5f6246e02d962448bf7e3f1ad88f63d6d647246a93322ba94b35a99`。
- 原 Beta/消费者镜像：`ghcr.io/nofan-xyz/mastodon@sha256:cd29d3990cfdb26945c7f41e29e563b81cee85c7b5b5a6357f3131c954c39d42`。
- Streaming 保持：`ghcr.io/nofan-xyz/mastodon-streaming@sha256:9feab6157f3f88c876d90e70a328691f701f02a5ca8969b14042f95ff3758fdb`。
- 正式站保持：`4.7.4.0+shared47-94b44346e1f6a656eb5bf1ef45c5406c7013fef0`，容器及镜像未变化。

## 验证

- 4276 项前端测试、309 项 Ruby 测试、TypeScript、相关 lint 与完整生产前端构建通过。上游合并验证中的一个 legacy JSX 路径被上游 ESLint 配置忽略，该合并片段已人工核对并通过生产编译；分类栏新增/修改文件的 ESLint、Stylelint、RuboCop 全部通过。
- 最终镜像 5027 个源文件与固定提交逐一匹配，兼容依赖 linzer/crass/pghero 符合预期。容器 OpenSSL 3.5.7 实测支持 ML-DSA-44；本地测试使用进程级 OpenSSL 3.6.1，没有修改系统默认库或跳过上游签名测试。
- 独立 PostgreSQL、Redis 和测试媒体前缀的隔离环境中，当前正式站 4.7 镜像与最终 Beta 镜像共同验收：密码/TOTP/防重放、共享登录限流、OAuth、跨版本发帖/编辑/删除/幂等、互动和通知、认证 WebSocket 分发、媒体与头像、纯文本/Markdown/HTML 安全过滤、并发偏好保存、双向站点设置和 FASP 兼容性均通过。生产未进行测试性写入。
- 实际最终镜像的 896 个未压缩前端资源与本地用于浏览器测试的资源 SHA-256 完全一致。通过仅指向隔离环境的本地 HTTPS 通道完成 12 个主题/深浅色/桌面手机宽度场景、48 项菜单交互，另有 72 个顶部滚动与 240 个控件配色/对比度场景通过。
- 分类栏 8 项真实页面检查通过：个人选择及无序号排序、featured 静态封面、悬停细浅滚动条且不跳布局、滚轮与触屏滑动、搜索后分类跳转和插入、隐藏全部清空导航、重新显示并保存新顺序、显示/隐藏序号保持顺序。仅在隔离库创建专用表情包，浏览器使用受控 PNG 夹具验证图标渲染，没有使用生产账号写入测试。

## 生产结果

- 更新 Beta Web 与三组消费者；正式站 4.7 Web、Streaming、PostgreSQL、Redis、Elasticsearch 容器 ID 均保持不变。
- 隔离与生产均确认没有待执行迁移，没有运行生产 db:migrate。
- 生产既有 OAuth 身份只读核对：两版本资料、公共偏好、主页和通知一致；签名密钥与已启用的 TOTP 可解密；WebAuthn RP 为 nofan.xyz，包含明确 Beta origin。
- 三个后台进程、一个 scheduler 消费者；队列及新增兼容性检查通过。历史 retry/dead 未清空，不以此宣称全部历史失败任务归零。
- 生产全部 9 个服务健康，发布后观察日志未匹配缺表/缺列、NameError/NoMethodError、未定义常量或 unknown keyword 等兼容错误。
- 公网 Beta 与正式站版本回读正确；表情接口返回 1806 个表情、32 个分类且顺序字段完整；登录页引用的 34 个 JS/CSS 资源全部返回 200。
- 保留旧 Beta 不可变资源，本次归档新增 648 个旧资源文件以兼容未刷新的页面。
- 隔离服务和本地浏览器代理已停止。源码清单、CI/测试及浏览器结果、隔离验收和公网结果保存在 `/home/mastodon-shared-rehearsal/results/upstream-20261103/`。

## 回退

配置/镜像/验收备份：`/home/mastodon/shared-rollout/20261103T162951Z-application`。确认没有后续发布后，恢复其中的 `before-compose.override.yml` 到 `/home/mastodon/docker-compose.override.yml`，在 `/home/mastodon` 重新启动 `web-beta sidekiq sidekiq-ingress sidekiq-push`，再检查健康、身份只读回读及队列。核对后按需恢复发布元数据；保留实时数据库和媒体写入，不用旧数据备份覆盖线上数据。
