# 2026-11-03 Beta 上游 main 合并

## 来源和范围

- 目标：`codex/upgrade-mastodon-5`，工作目录 `/home/twoheart/projects/mastodon-5`。
- 合并前：`4f386583973e7e1b39ccfe73439f0e80a5ffab05`；备份分支 `codex/backup-before-upstream-20261103`。
- 上游：`2676e857b32489688dfaf4ea002e6cd5b1d51bba`，共新增 58 个提交；提交前再次核对上游 main，仍为该提交。
- 来源：https://github.com/mastodon/mastodon/commit/2676e857b32489688dfaf4ea002e6cd5b1d51bba 。
- 仍为 Mastodon 5.0.0-alpha.2 开发版本，本次仅合并代码和验证，没有部署线上或执行生产数据库迁移。

更新包括登录邮件令牌过期校验、成功后清理令牌、二次验证限流及挑战重启；ActivityPub JSON-LD 节点限制；Forwarded 请求头处理修复；邀请次数统计；发帖敏感内容和引用图片处理、搜索快捷键、Safari 清除搜索按钮、高对比度显示及翻译和依赖更新。保留 nofan 自定义主题、账号切换、那年今日与共库适配。本次没有引入正式站 4.7 表情分类栏补丁，Beta 继续使用自己的新表情选择器。

## 合并处理

唯一冲突为 `.github/workflows/build-releases.yml`：保留 nofan 的 `if: startsWith(github.ref, 'refs/tags/')` 发布限制，接受上游 Ubuntu 26.04 runner。其他源文件自动合并后完成检查，没有改写上游业务逻辑。

没有新增 `db/migrate` 或 `db/post_migrate` 文件；`db/schema.rb` 的变更仅为已有 user_ips 视图 SQL 的列别名形式调整，schema 版本未变。未执行生产数据库迁移。

Node 按 `.nvmrc` 使用 26.13.0，Ruby 使用 4.0.9，Bundler 4.0.23。Yarn immutable 安装和 frozen bundle 安装通过，没有另外改动依赖锁。

## 验证

- TypeScript 检查通过；41 个前端测试文件、4270 项测试全部通过。
- 完整生产前端构建通过，包括本站主题和新表情模块；构建中的动态/静态导入及插件计时提示不影响成功结果。
- 变更路径 ESLint 命令检查 22 个，其中 legacy JSX `app/javascript/mastodon/features/ui/index.jsx` 被上游配置忽略，其合并内容已人工核对并通过生产编译；Stylelint 19 个、RuboCop 16 个通过，合并 diff 检查通过。
- 本地专用数据库 `mastodon_beta_upstream_20261103_test` 和 Redis 6397 隔离运行登录会话、用户、HTTP 签名、ActivityPub 活动、文本解析、链接预览及对象完整性证明测试，共 303 项全部通过。
- 初次后端验证因原测试 Redis 6385 未运行而失败，改用本任务独立 Redis；随后系统 OpenSSL 3.0.2 不支持 ML-DSA-44，导致上游刚启用的 3 项签名测试失败。仅在测试进程设置 `LD_LIBRARY_PATH=/home/linuxbrew/.linuxbrew/opt/openssl@3/lib`，使用本机现有 OpenSSL 3.6.1 重跑全部 303 项后零失败。没有修改上游测试、跳过这些测试或改变系统默认库。
- 任务专用 Redis 完成后停止。没有连接正式数据库进行写入测试，没有运行部署脚本。

## 线上状态

本次提交并推送 Beta 源码分支，不代表已发布。线上 Beta 继续使用 `bdbb820c403fe7ffa10ea70e5b4903e4fef9e0c7` 对应镜像；正式站 4.7 Web、三组消费者、Streaming 与配置均未调整。后续上线需要按共享数据发布流程进行镜像与隔离环境验收。

后续范围：用户随后要求把正式站「表情包分类栏易用性更新」一并部署到 Beta，已在该上游合并之上另作适配，见 `docs/EMOJI-CATEGORIES.md`；最初仅包含上游合并的 22fc1ffbb5 镜像不作为生产候选。
