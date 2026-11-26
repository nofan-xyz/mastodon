# 2026-11-11 双站投票与表情分类栏更新

- 正式站与 Beta 新建投票均最多 12 项，单选和多选一致，每项最多 50 字。
- 表情选择器快速分类栏支持桌面端按住鼠标左右拖动；拖动时不误切分类，单击仍切换分类；触屏端保留原生横向滑动。
- 主站源码 3acd30a31220d5eac694524e9f9f2d420d8615c0，4.7.5.0+shared47-3acd；镜像 ghcr.io/nofan-xyz/mastodon@sha256:6f77f53891d1bdd733b3bd748c0f4906bce469f413242f547be559a1f13f9b24；[构建](https://github.com/nofan-xyz/mastodon/actions/runs/42955967161)。
- Beta 源码 1ae47ccc081d4c45135085a8193dc489b7b799a3，5.0.0.0-beta.1+beta-1ae47；镜像 ghcr.io/nofan-xyz/mastodon@sha256:8c0702d642499cc38def87391e214af6554cf43b0649737f703296f41811103d；[构建](https://github.com/nofan-xyz/mastodon/actions/runs/42955967148)。
- 已发布到 nofan.xyz 和 beta.nofan.xyz，仅更新两个 Web 服务；其他七个服务未重建，九个服务均健康。没有数据库迁移、Redis 清理或 Nginx 改动。
- 正式站补入 192 个新 Web 资源；Beta 归档 426 个旧静态资源。
- 两站公网版本和 v1/v2 投票设置回读正确；登录页所需新 JS/CSS 可访问。公网页面在 1440px 与 390px 视口通过且无页面错误。未在登录态内自动操作拖动。
- 两分支 ESLint、Stylelint、TypeScript 和 Vite 生产构建通过。部署记录目录：/home/mastodon/shared-rollout/20261111T041103Z-emoji-category-drag。
