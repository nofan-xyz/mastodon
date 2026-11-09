# 2026-11-09 Beta 同步 v5.0.0-beta.1（仅源码，未部署）

## 来源与边界

- 项目：`/home/twoheart/projects/mastodon-5`，对应 `beta.nofan.xyz`，分支 `codex/upgrade-mastodon-5`。
- 合并前提交：`d286410d767d6b26dbddd4d4aa9d4b7a4824fd17`。
- 本地备份分支：`codex/backup-before-beta1-20261109`。
- 上游：[v5.0.0-beta.1](https://github.com/mastodon/mastodon/releases/tag/v5.0.0-beta.1)，固定提交 `08b05423b5e1f8c6c57a10d49760fd0ecd8846f4`。仅合并此 tag，没有跟进 tag 之后的 main。
- 相对此前已合并的 `2676e857b3`，新增 21 个上游提交；版本默认预发布标识由 `alpha.2` 改为 `beta.1`，保留本站四段版本规则。
- 用户明确要求先不部署。本次只同步、验证并推送源码，没有触发镜像构建、修改线上配置、重启线上容器或执行线上数据库迁移。

## 合并内容

本次增量包括会话列表与私信界面调整、低高度视口和 iPad WebKit 的全屏发帖器、弹窗按钮与屏蔽/静音对话框更新、搜索 Escape 行为、长竖排文本滚动、域名屏蔽修复、认证错误返回 422、路由响应格式、Rails 8.1.4.1 和 WebSocket 依赖更新。

唯一文本冲突为 `.github/workflows/codeql.yml`：采用上游 YAML 分支列表锚点和移除 autobuild 的变更，保留 fork 已关闭的定时扫描。业务代码自动合并；人工核对发帖器两个 SCSS 文件保留本站的 `min-height: 0` 和列间距修复，接受上游 `data-fullscreen` 布局逻辑。主题、个人表情分类选择/排序、那年今日、账号切换及共享数据兼容代码保留。

与合并前代码相比，`db/migrate`、`db/post_migrate` 和 `db/schema.rb` 均无变更。上游 release 的迁移说明针对从 4.7 升级，不能据此断言本次 alpha.2 到 beta.1 增量新增了迁移；后续发布仍需根据实际线上 schema 单独核查。

## 本地验证

使用 Ruby 4.0.9、Node 26.13.0；Yarn immutable 安装和 Bundle frozen 安装通过，没有额外改动依赖锁。

- TypeScript 通过。
- 42 个前端测试文件、4,276 项测试通过。
- 完整生产前端构建通过，转换 6,589 个模块；包含本站定制主题与表情模块。
- 后端 262 项测试通过：注册、密码/二次验证与会话、well-known 路由、HTTP 签名、ActivityPub、用户与共享偏好、共享缓存/Web 来源、FASP、个人表情、会话 API、那年今日。
- Rails Zeitwerk 加载检查通过；测试邮件预览目录未列为 eager load，保留框架原提示。
- ESLint 38 个变更路径、Stylelint 11 个、RuboCop 8 个、格式检查 66 个路径通过；合并 diff 无空白错误。
- 工作流 YAML（包括锚点）解析通过。

后端测试仅使用本地独立 `mastodon_beta1_20261109_test` 数据库和端口 6398 的任务专用 Redis，结束后停止 Redis。ML-DSA 测试通过进程级 `LD_LIBRARY_PATH` 使用现有 OpenSSL 3.6.1；没有修改系统默认库或跳过签名测试。

日志保存在本地 `tmp/beta1-20261109/`。本次没有进行最终容器镜像、浏览器交互、真实账号或跨版本线上流程验收；本地生产构建不等于已部署。

## 后续上线前

按共享数据发布流程核查 Beta Web、三组 5.0 消费者及 Streaming 的最终镜像和依赖，使用隔离环境验证与正式 4.7 Web 共库兼容。此文不是部署授权或线上验收记录。
