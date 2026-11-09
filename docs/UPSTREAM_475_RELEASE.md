# nofan 正式站同步上游 v4.7.5

上游 release：[v4.7.5](https://github.com/mastodon/mastodon/releases/tag/v4.7.5)，发布于 2026-11-03。生产升级基于当前 4.7.4 定制分支 `e1429e115c`，合并上游完整 tag，源码提交 `66e79ae9b14db18fcd5a60992ce7147d514e437d`。

## 变更范围

- 修复长期未登录账号的密码认证绕过。
- JSON-LD 压缩前检查资源限制，防止拒绝服务。
- 调整代理请求头优先级，并更新依赖中的安全修复。
- 邀请码使用次数不再随被邀请用户删除而减少。

合并时 `User` 模型末尾存在一处冲突，保留 nofan 的 `reload_home_feed` 和上游的 `increment_invite_uses` 两个独立方法及回调。前端、主题、表情选择、节日页脚、“那年今日”及搜索代码与升级前生产分支一致。

## 构建与本地验证

- [GitHub Actions 42559030328](https://github.com/nofan-xyz/mastodon/actions/runs/42559030328)：AMD64、ARM64 和 manifest 合并成功。
- `spec/models/user_spec.rb`、`spec/controllers/auth/sessions_controller_spec.rb`、`spec/services/activitypub/process_activity_service_spec.rb`、`spec/requests/api/v1/custom_emojis_spec.rb`：140 项，零失败。
- 6 个修改的 Ruby 文件 RuboCop 通过；`git diff --check` 通过。
- 测试在本地独立 `nofan475_test` 数据库和 Redis 测试分区运行。首次执行缺少前端 manifest、mailer CSS 和 Redis，补齐后完整重跑通过；没有对正式数据库运行测试。

## 部署约束

正式实例采用 4.7 Web 与 5.0 Web/消费者共库架构。此次只替换 `web`，没有数据库迁移，不将消费者降级为 4.7。现有 5.0 消费者的 `ProcessActivityService` 已包含压缩前 JSON-LD 限制检查。Streaming 在本次上游补丁中没有代码变化。

切换前执行完整数据库备份及恢复目录验证；保留旧镜像、Compose、nginx 和旧静态资源。正式 nginx 的应用与 Streaming 代理清除传入的 `Forwarded` 请求头，保留既有 `X-Forwarded-For` 配置。

## 正式部署与验收

北京时间 2026-11-09 12:20:46 开始切换，正式站已返回 `4.7.5.0+shared47-66e79ae9b14db18fcd5a60992ce7147d514e437d`。

- 固定镜像：`ghcr.io/nofan-xyz/mastodon@sha256:e42c8e0780442c7c392051a66cd6ceb6942c064c990997acb2e1262324bcdbf5`。
- 镜像内 4,156 个源码和依赖配置文件 SHA-256 与发布提交一致。
- 最终镜像在隔离共库演练中通过：4.7.5 和现有 5.0 可读取相同用户数量、canonical domain；两个 Web 的实例 API、登录页、关于页和表情 API 返回 200。演练后停止四个演练服务。
- 正式库新备份：`/home/mastodon/shared-rollout/20261109T035701Z/production.dump`，约 23 GiB；`pg_restore --list` 成功且存在 `backup.done`。本次没有再次完整恢复该新备份，不能将目录验证称为完整恢复验收。
- 配置、旧镜像、nginx 和部署收据：`/home/mastodon/shared-rollout/20261109-v475/`。保留升级前静态资源并补齐新镜像资源。
- 仅重建正式 `web`；逐个核对其余容器 ID 与镜像未变，9 个正式服务均健康，没有数据库迁移。
- 公网关于页在 320、390、768、1440px 无横向溢出，手机截图人工查看正常，浏览器无页面异常；源码链接指向本次提交。
- 公网登录页、介绍页、健康页和 7 个登录页资源正常；表情 API 返回 1,806 个表情和 32 个分类，排序字段完整且分类顺序值唯一。
- 现有 OAuth 身份只读验收：两版资料及公共偏好一致，主页和通知可读取。签名密钥、启用 TOTP 的密文可解密；WebAuthn RP 和 Beta 来源保持正确。未使用真实用户密码进行交互登录或发布嘟文。
- 后台仍为三个进程、一个 scheduler 消费者；上线后无新增队列兼容错误，联邦新动态继续入库。历史 retry/dead 任务仍存在，本次不清空。
- 上线观察中发现同一远端媒体代理请求两次 500；nginx 历史记录确认同一媒体在切换前已出现 500，媒体处理器源码也未变化。此处保留问题边界，不声称全站零错误。

## 回退

先确认没有后续发布，再恢复 `20261109-v475/before-compose.override.yml` 和 `before-mastodon.conf`，执行 `nginx -t` 后 reload nginx，在 `/home/mastodon` 执行 `docker compose up -d --no-deps web`，检查健康和公网版本。按需恢复 `before-release.json`。只回退应用和代理配置，不恢复旧数据库覆盖线上新写入。
