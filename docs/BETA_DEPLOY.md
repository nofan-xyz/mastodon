# beta.nofan.xyz 部署

## 实例与来源

- 这是独立的 5.0 测试站，账号、帖子、上传文件和登录会话不与 nofan.xyz 互通。
- 上游固定提交：`559688e153ce3a50b26e327bfe488743da99f3dc`。
- 首次部署应用提交：`47d6d67d70a35b152fe3100e1fbb4a3d13970a5f`，包含 Tangerine Neue 3.0 beta 3、X UI 和账号切换适配。
- 构建流程：`.github/workflows/build-beta.yml`，只写 `beta-*` 镜像标签，不覆盖 stable/latest。
- 部署目录：源站 `/home/mastodon-beta`，Compose 项目名 `nofan-beta`。
- 独立 PostgreSQL 14、Redis 7，数据库名 `mastodon_beta`；关闭 Elasticsearch。2026-10-26 已将媒体切换到独立 S3 桶，正式数据快照尚未导入。
- 应用加密密钥独立；复用正式站的 SMTP 传输配置及用户指定的 S3 Access Key / Secret Key，不复用正式站实时数据库和 Redis。
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

`.env` 记录 PostgreSQL 密码和实际镜像引用，`.env.production` 记录应用密钥，均不入 Git。管理员初始凭据保存于受保护的 `secrets/ADMIN-CREDENTIALS.txt`，首次登录后修改邮箱和密码。

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

此配置通过桶路径分离 beta 和正式站媒体；因为复用同一密钥，不应将其误认为 IAM 权限级隔离。尚未开始复制正式站历史媒体。

## 首次部署校验

部署前修复 crass 1.0.8（GHSA-pq4g-8rxf-4g29）和 pghero 4.1.0（GHSA-5287-hmjh-qmqq），依赖扫描通过，相关 67 项回归通过。最终镜像构建为 Actions 40208096967。Rails 固定 digest 为 sha256:d361962fbc4039d4c9378bedda24b6d0d699406f5a6da44599400a00172ea307；Streaming 为 sha256:b1c0c41b0343fe42396e4e26c16180ddf3ecd8365a080b36a94f85b9a581f22d。服务器 release.json 另存提交与 digest，配置和初始化数据库已备份。

HTTPS 证书续期 dry-run 通过。初始管理员已确认邮箱并批准，避免关闭注册时的新账号审批状态阻止登录；不会自动发送确认邮件。
