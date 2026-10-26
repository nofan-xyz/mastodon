# 4.7 / 5.0 共用正式数据部署

北京时间 2026-10-26 15:44 切换生效，15:48 完成旧快照服务停用。nofan.xyz 保留 4.7 界面，beta.nofan.xyz 使用 5.0 界面；账号身份仍为 @用户@nofan.xyz。两个入口的发帖、资料、偏好、关注、通知与媒体都作用于同一个正式实例。Cookie 仍按 host 隔离，beta 用户需重新登录；密码与两步验证沿用正式站，未实现免登录 SSO。

## 当前镜像与拓扑

| 角色 | 固定镜像 digest | 来源 |
| --- | --- | --- |
| 4.7 Web | `ghcr.io/nofan-xyz/mastodon@sha256:6cf1fb7e9a85b7446f1393d79f47c73392d08157ff6778ee0a67f54fb171a0f0` | `1d03b99d8412785da33b127eb72336d0898045bc` |
| 5.0 Web / workers | `ghcr.io/nofan-xyz/mastodon@sha256:e736342d74cd43d3409a81d160f7b284c8d68c88b764072bd5cbabe8a60f3c61` | `e89c5c38dc9b67b03f0a12f2f16ecb1b6099087e` |
| Streaming | `ghcr.io/nofan-xyz/mastodon-streaming@sha256:1ed93ed34faf5e0c865faae70158e673b3d13f0a7339fb604af9a21933b6b1c8` | 首次 5.0 CI，Streaming 源码未变 |

共库初次构建：[5.0](https://github.com/nofan-xyz/mastodon/actions/runs/40285173202)、[4.7 兼容 Web](https://github.com/nofan-xyz/mastodon/actions/runs/40285177869)。均完成 amd64/arm64 构建及 registry manifest 合并。媒体修复构建见 [40292802936](https://github.com/nofan-xyz/mastodon/actions/runs/40292802936)，16:40 更新 5.0 Web / workers，未运行数据库迁移、未重启 Streaming。没有覆盖 stable/latest 镜像标签。

部署目录 `/home/mastodon`，项目 `mastodon`。`web` 为 4.7，回环端口 3000；`web-beta` 为 5.0，回环端口 3106。Streaming 为 5.0，端口 4000，两域名的 nginx 均指向它。三个后台进程都使用 5.0 镜像，分别消费 default/mailers/scheduler/fasp、ingress、push/pull；只有第一个进程监听 scheduler。

保留原正式 PostgreSQL 14、Redis 7、Elasticsearch 8.19 及数据卷。搜索索引定义与正式 4.7 一致，本次未重建索引。协调、时间线、任务和唯一锁仍用正式 Redis DB0；两版普通缓存分到 DB1/DB2，跨版本广播失效，Rack::Attack 共用 DB0 的专用命名空间。

`docker-compose.override.yml` 固定所有应用镜像及共享参数，权限 600；`.env.production` 继续使用正式站原密钥。没有复制 beta 的 SECRET/VAPID 或媒体写入配置到正式环境。账号签名、AR 加密、OTP、SECRET 和 VAPID 均沿用原正式配置。两个 Web 的 LOCAL_DOMAIN/WEB_DOMAIN 都是 nofan.xyz，beta 为明确允许的别名及 WebAuthn 来源，RP ID 为 nofan.xyz。

4.7 的 `SOURCE_TAG` 指向真实分支 `codex/v4.7.3.3-shared-data`，该引用与镜像 SOURCE_COMMIT 相同，使原有 tag 推导的第四段版本号保持 3。源码 SHA 与镜像均未因此更改；公开版本为 `4.7.3.3+shared47-...`。5.0 仍固定上游 `559688e153ce3a50b26e327bfe488743da99f3dc`，不是 5.0 稳定版。

## 备份、迁移与隔离环境

一致性备份：`/home/mastodon/shared-rollout/20261026T072248Z/production.dump`，已完成 pg_dump 并验证 pg_restore 目录。该新备份未再执行一次完整恢复；此前同版本正式快照已在独立演练库完整恢复并验证。该目录同时保留旧 Compose、密钥文件副本、部署前容器配置、迁移前后身份摘要、队列基线及发布方案，均仅管理员可读。

共存迁移已保留旧 accounts.private_key 与 FASP JSON，不删除回退所需字段。迁移前后用户数量、密码哈希、本地签名密钥密文及旧密钥汇总摘要一致。没有恢复旧数据库覆盖正式数据，也未清空正式 Redis。

旧独立 beta 的 Web、Sidekiq、Streaming 及媒体复制已停用，其 PostgreSQL、Redis、媒体桶和备份保留，不将其测试发帖、资料或上传合并进正式库。独立演练项目 `/home/mastodon-shared-rehearsal` 的结果及测试账号凭据仍受保护，演练初始化器不挂载到正式应用。

## 验证范围

- 两个公网 API 均正常返回，canonical domain 与站点标题一致；版本分别为 4.7 和 5.0。
- 现有正式 OAuth 身份经真实 HTTP 在两个 Web 读取相同资料、共同偏好、主页和通知；未修改该用户数据或打印令牌。
- 现有本地签名密钥及开启 TOTP 的账号密文可解密，WebAuthn RP / 来源正确。真实密码、TOTP 登录与跨入口重放限制在演练账号上通过；未用真实用户的密码登录，也未做实体安全密钥硬件验证。
- 最终发布镜像逐文件匹配演练运行时代码，登录、跨版本发帖/编辑/删除、幂等、关注、收藏、转发、热缓存拉黑、头像/媒体及 WebSocket 复测通过。
- 上线后只有一个 scheduler 消费进程，三组工作队列正常处理；观察窗口内未出现新的缺表、缺列、未知类或方法类兼容错误，最新联邦动态继续入库。
- 部署前已有 retry=101、dead=9999、scheduled=87；不能把这些历史失败任务当作本次新问题，也不能宣称正式环境重试/死信为零。

源站直连 nofan.xyz 的旧 443 证书已过期，导致最初的回环 TLS 验收失败；真实公网经既有反代的 HTTPS 验证通过，beta 源站证书正常。本次未修改正式域名证书或反代链路，应用验收改为真实公网 HTTPS 路由，源站旧证书需独立维护。

## 日常操作和回退

```sh
cd /home/mastodon
docker compose ps web web-beta sidekiq sidekiq-ingress sidekiq-push streaming
docker compose logs --tail 100 web web-beta sidekiq sidekiq-ingress sidekiq-push
curl -fsS https://nofan.xyz/health
curl -fsS https://beta.nofan.xyz/health
```

镜像以 override 中的 digest 为准，不能只修改原 `.env` 的 stable 标签，不能再次执行独立 beta 的快照清洗、迁移或媒体复制脚本。后续源码变更先走独立演练，更新镜像前核对两版兼容性与所有应用角色。

若需关闭 beta，可停用 `web-beta` 并调整 beta nginx 入口，正式 4.7 兼容 Web 与 5.0 workers 继续运行。若需回退某一 Web，优先保留扩展后的数据库与能消费新载荷的 5.0 workers，选择已验证兼容镜像；不能直接恢复旧数据库丢弃新写入，也不能让未经适配的旧 4.7 消费者抢走新任务。原始 4.7 镜像对扩展 schema 的只读回退探针已通过，不代表旧后台消费者能处理所有新载荷。真正恢复数据库属于另一次维护窗口。

登录后媒体问题的浏览器复现、修复及公网验收见 [MEDIA_SERVICE_WORKER_FIX.md](MEDIA_SERVICE_WORKER_FIX.md)。Worker 脚本现按发布版本注册，/sw.js 不进入长缓存。
