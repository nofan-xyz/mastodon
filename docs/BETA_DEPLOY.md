# beta.nofan.xyz 部署

## 实例与来源

- 这是独立的 5.0 测试站。2026-10-26 开始导入 nofan.xyz 的单向数据库及媒体快照；不是实时互通，beta 的改动不回写正式站。导入状态见下文。
- 上游固定提交：`559688e153ce3a50b26e327bfe488743da99f3dc`。
- 首次部署应用提交：`47d6d67d70a35b152fe3100e1fbb4a3d13970a5f`，包含 Tangerine Neue 3.0 beta 3、X UI 和账号切换适配。
- 构建流程：`.github/workflows/build-beta.yml`，只写 `beta-*` 镜像标签，不覆盖 stable/latest。
- 部署目录：源站 `/home/mastodon-beta`，Compose 项目名 `nofan-beta`。
- 独立 PostgreSQL 14、Redis 7，数据库名 `mastodon_beta`；关闭 Elasticsearch。媒体使用独立的法兰克福桶。
- 快照模式只复制解密已有两步验证数据所需的 Active Record 加密密钥与 OTP 配置；会话密钥和 VAPID 密钥保持独立。按用户要求复用 S3 Access Key / Secret Key，不连接正式站实时数据库和 Redis。快照模式关闭邮件，不复用 SMTP 发送能力。
- 注册关闭；管理员创建测试账号或邀请后再开放测试。站点及反代均启用 noindex。

## 网络与证书

Cloudflare 的 beta A 记录指向源站 `38.242.199.52`，保留代理。此域名不经过 ban.fan 香港反代。

`deploy/beta/nginx.conf` 对应源站 `/etc/nginx/conf.d/nofan-beta.conf`；Rails 和 Streaming 分别只绑定源站 `127.0.0.1:3105`、`127.0.0.1:4105`。上传挂载路径为新版容器中的 `/opt/mastodon/public/system`。

证书独立存放在 `/etc/letsencrypt-beta`，HTTP 验证目录 `/var/www/beta-acme`。`nofan-beta-cert-renew.timer` 每日两次调用 Certbot 容器续期并验证、重载 nginx，不修改正式站证书配置。

## 日常操作

在源站执行：

```sh
cd /home/mastodon-beta
docker compose ps
docker compose logs --tail 100 web sidekiq streaming
curl -fsS http://127.0.0.1:3105/health
curl -fsS http://127.0.0.1:4105/api/v1/streaming/health
```

`.env` 记录 PostgreSQL 密码和实际镜像引用，`.env.production` 记录应用密钥，均不入 Git。独立测试站最初的管理员凭据保存在受保护的 `secrets/ADMIN-CREDENTIALS.txt`；恢复正式站快照后，该测试账号被替换，此文件仅用于旧 beta 回退。快照账号使用正式站原有的登录邮箱、密码和两步验证。

## 更新和回退

1. 在适配分支手动触发 Build nofan beta images；确认 Rails 和 Streaming 均成功。
2. 核对 Rails 镜像内的 `SOURCE_COMMIT`、两款镜像的 `MASTODON_VERSION_METADATA` 与目标提交相同，使用镜像 digest 固定 `.env` 中的两个镜像引用。
3. 更新前备份 `.env`、`.env.production`、Compose 文件、上传文件和数据库。数据库备份命令如下，文件只对部署管理员开放：

   ```sh
   umask 077
   docker compose exec -T db pg_dump -U mastodon -Fc mastodon_beta > backups/beta-before-update.dump
   ```

4. 只在 beta 目录执行 `docker compose pull`、迁移和 `docker compose up -d`；验证公网版本、健康、登录、主题与 WebSocket。
5. 若没有不兼容迁移，恢复旧的 digest 并重新启动 beta 应用即可。若存在不兼容迁移，先停止 beta 应用并恢复 beta 数据库备份，再恢复镜像；不能仅换镜像假设数据库可回退。

所有操作均限定 beta 的 Compose 项目和目录，不使用正式站的 deploy.sh，也不对正式站执行 down/recreate/migrate。

## S3 媒体配置（2026-10-26）

使用 IDrive e2 法兰克福新桶 `beta-nofan-box`，区域 `eu-central-2`；不是巴黎 `eu-west-4` 的同名旧桶。按用户要求复用正式站 S3 密钥，密钥只保存在服务器权限 600 的环境文件中，不写入此仓库。

```dotenv
S3_ENABLED=true
S3_BUCKET=beta-nofan-box
S3_REGION=eu-central-2
S3_ENDPOINT=https://v2p4.fra2.idrivee2-54.com
S3_HOSTNAME=media.nofan.xyz
S3_ALIAS_HOST=media.nofan.xyz/beta-nofan-box
S3_PROTOCOL=https
S3_PERMISSION=public-read
S3_OVERRIDE_PATH_STYLE=false
```

原生 IDrive 域名匿名读取返回 403，已有媒体域名 `media.nofan.xyz/beta-nofan-box/对象键` 返回 200，实际配置使用后者，无需新增媒体 DNS。已验证区域、密钥访问、测试对象上传/删除，以及 Mastodon MediaAttachment 实际图片上传、CDN 内容读取和附件删除。测试对象已清理；切换前 beta 本地上传目录为空，无待迁移文件。

此配置通过桶路径分离 beta 和正式站媒体；因为复用同一密钥，不应将其误认为 IAM 权限级隔离。

## 正式站快照导入（2026-10-26）

本次任务已获用户授权：导入正式站账号、设置和媒体快照。正式站仅运行只读 `pg_dump` 和 S3 List/CopySource 读取；不迁移正式站数据库，不停止或重建正式站应用。

快照批次：`/home/mastodon-beta/backups/snapshot-20261026T035130Z`。`snapshot-current` 指向当前批次。备份、应用环境和数据清单仅部署管理员可读，禁止提交到 Git。数据库快照由 PostgreSQL 一致性事务生成；S3 不是事务快照，按逐页清单和 ETag 条件复制，源对象变化或消失会记录错误，不能将复制任务启动视为全量完成。

北京时间 2026-10-26 12:28，数据库恢复、清洗和 5.0 迁移完成，beta 已解除维护：1,332 个用户、1,410 条本地账号记录、21,309,840 条动态、5,418,662 条附件记录。密码与偏好摘要保持一致；13 个开启两步验证的账号均成功解密，进程内账号授权及页面、身份、偏好、主页 API 检查通过。公网登录页 200、流地址为 `wss://beta.nofan.xyz`、认证 Cookie 不跨域，联邦入口 403；正式站仍为 4.7.3.3，两站健康检查正常。15 个媒体样本的 ETag、大小和 CDN 匿名读取检查通过，24 个站点品牌文件已优先复制。全量 S3 复制仍在后台执行，尚未标记整体快照完成。

导入前已备份 beta 数据库和配置。数据库恢复到 `mastodon_beta` 后，在启动应用前清除 beta 副本中的登录会话、OAuth 授权令牌、Web Push 订阅、定时发帖和 Webhook，使复制的邀请过期，轮换 OAuth 应用标识与 secret，并清除密码重置/确认/登录临时令牌。账号密码哈希、个人资料、偏好、关注关系及历史数据保留；迁移前后比较密码和设置的汇总摘要。注册保持关闭，强制 noindex。

`LOCAL_DOMAIN=nofan.xyz` 保持已有账号身份，`WEB_DOMAIN=beta.nofan.xyz` 用于 beta 页面。两步验证加密配置与正式站匹配，但不会复制正式站 Cookie/Redis 会话。WebAuthn 使用 RP ID `nofan.xyz`、允许来源仅 `https://beta.nofan.xyz`；已有安全密钥是否可用仍需用户实际浏览器验证。

快照防护代码为 `deploy/beta/snapshot_isolation.rb`，通过服务器 `compose.override.yml` 挂载。默认 `docker compose` 会自动读取此 override；后续部署不能遗漏。邮件关闭，Mastodon 签名 HTTP 请求禁止，应用和 nginx 均拒绝 ActivityPub 入站及账号发现。Sidekiq 使用 `snapshot_sidekiq.yml`，关闭调度器，客户端及服务端只放行本地时间线、通知、那年今日和媒体处理等指定任务；不运行联邦、邮件、推送、导入和清理任务。

媒体任务只从当前正式桶 `nofan-box` 复制到 `beta-nofan-box`，不删除源对象。优先处理非 cache 前缀，然后复制远程缓存。每页记录对象键、大小、ETag 和进度；任务可从分页标记恢复。上传和删除仍限定 beta 桶。

运行状态与日志：

```sh
cat /home/mastodon-beta/snapshot-current
systemctl status nofan-beta-snapshot-import --no-pager
journalctl -u nofan-beta-snapshot-import --no-pager -n 80
docker logs --tail 3 nofan-beta-media-snapshot
cat /home/mastodon-beta/backups/snapshot-20261026T035130Z/media-progress.json
```

`dump.done` 表示一致性备份完成；`database.done` 表示恢复、清洗、5.0 迁移、防护检查及 Web 健康检查完成；`media.done` 仅在所有复制页完成且无对象错误时写入。媒体复制尚未完成时，部分图片会暂时缺失，不应宣称全部导入完毕。数据库导入出错会保留 beta 维护页，不自动开放未经验证的副本。正式站不进入维护模式。

`nofan-beta-snapshot-verify.service` 等待数据库和媒体均完成后，再抽查复制对象的 ETag、字节数及 CDN 匿名读取，检查两站健康和 beta 联邦入口关闭，成功后写入本批次 `snapshot.done` 及 `snapshot-result.json`。错误会记录为 `needs_attention`，不会伪装为完成。此服务仅记录本地结果，不发送邮件或外部通知。服务器任务不依赖本地电脑保持连接，但服务器重启后须检查这些任务是否需要恢复。

应用校验会用 Warden 的进程内测试会话检查已复制账号的页面、身份、偏好及主页 API，不读取或更改用户密码；这不等于用户浏览器的真实密码登录测试。密码与偏好通过迁移前后的数据摘要核对，现有 TOTP 密文通过实际解密检查。因为快照关闭邮件，找回密码、邮箱验证及长期未登录账号的邮件安全码不能在 beta 完成；不会为绕过该限制而关闭两步验证或额外的登录安全检查。

本地可审阅导入脚本位于 `deploy/beta/snapshot/`，服务器实际脚本位于 `/home/mastodon-beta/snapshot-tools/`。服务器初次执行时部分 CLI 文件仍采用连字符命名，含义与仓库下划线命名的 Ruby 文件一致。

回退时先保留维护页、停止 beta web/sidekiq/streaming，再从本批次的 `beta-before.dump` 和 `.env.production` 恢复独立测试站，移走 `compose.override.yml`，恢复批次内原 nginx 配置及 beta Redis 空状态后重启。不要将 beta 快照导回正式站，也不要删除正式桶媒体。

## 首次部署校验

部署前修复 crass 1.0.8（GHSA-pq4g-8rxf-4g29）和 pghero 4.1.0（GHSA-5287-hmjh-qmqq），依赖扫描通过，相关 67 项回归通过。最终镜像构建为 Actions 40208096967。Rails 固定 digest 为 sha256:d361962fbc4039d4c9378bedda24b6d0d699406f5a6da44599400a00172ea307；Streaming 为 sha256:b1c0c41b0343fe42396e4e26c16180ddf3ecd8365a080b36a94f85b9a581f22d。服务器 release.json 另存提交与 digest，配置和初始化数据库已备份。

HTTPS 证书续期 dry-run 通过。初始管理员已确认邮箱并批准，避免关闭注册时的新账号审批状态阻止登录；不会自动发送确认邮件。
