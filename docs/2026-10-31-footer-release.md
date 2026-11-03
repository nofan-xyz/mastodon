# nofan 正式站页脚调整

正式站页脚显示中文入口「关于本站 · 支持本站 · 开发路线图」，关于本站指向 `/overview`。版本链接独立一行，显示 `nofan · Mastodon 4.7.4`；完整版本通过 title 与可访问名称保留，源码链接指向版本元数据中的提交。

- 源码：`9c5f2190563b364be622aec289a0fc775ae7bb3f`。
- 构建：https://github.com/nofan-xyz/mastodon/actions/runs/41175064433 。两个平台及镜像合并均成功。
- 镜像：`ghcr.io/nofan-xyz/mastodon@sha256:4cfbc36f44f985961dbe210138fddd0420e9743530e43a3b5fd600a1425743c8`。
- 原镜像：`ghcr.io/nofan-xyz/mastodon@sha256:4ec64b192bf2dc27c491d953983789e7104f27dcf34709318971bd8169f37766`。
- 回退目录：`/home/mastodon/shared-rollout/20261031-footer`，保留原 compose override、发布记录与前端静态文件。
- 仅更新 `web` 镜像；其他容器 ID 均未变化，没有执行数据库迁移。旧前端资源保留以兼容未刷新的页面。

## 验证

ESLint、Stylelint、TypeScript 与 diff 检查通过。构建镜像的 SOURCE_COMMIT 和两个页脚源码文件 SHA-256 与本地一致，前端 manifest 存在。

使用实际组件和 SCSS 的浏览器检查在 310、240、180、120 像素容器宽度下无横向溢出。公网未登录 `/about` 在 1440、1024、768、390 像素屏幕宽度下验证中文入口、版本独立行、完整版本提示与提交链接；没有页面异常。Web 容器健康，登录页、介绍页、Beta 实例 API 均返回 200。未执行真实账号登录；账号数据及发布流程未做变更。

## 回退

将回退目录的 `before-compose.override.yml` 恢复为 `/home/mastodon/docker-compose.override.yml`，在 `/home/mastodon` 执行 `docker compose up -d --no-deps web`，再检查健康与公网页面。恢复 `before-release.json` 时应先确认此后没有其他发布。无需操作数据库。
