# nofan 定制功能清单

本清单以 nofan v4.7.3.3（`0afb546c7d`）相对上游 v4.7.3 的代码差异为基线，于 2026-10-19 核对。403 个差异文件包含主题、图片、字体、翻译和测试，不代表 403 项功能。5.0 移植进度见 [UPGRADE_5.md](UPGRADE_5.md)。

## 那年今日

- 独立页面 `/on_this_day`、导航入口和首页提示，默认启用，用户可在偏好设置关闭。
- 北京时间 23:00 调度次日快照，账号任务分散至 23:50；00:05 补漏，访问时仍支持按需生成。任务固定目标日期并去重。
- 收录往年同日的公开、不列和仅关注者嘟文，排除私信、转发及非自我回复；展示时重新检查归属、删除和屏蔽条件。
- 全局控制器负责持续轮询、失败退避、跨日清空、旧响应丢弃、返回标签页及网络恢复；pending 时保留入口。
- 代码：`app/lib/on_this_day.rb`、`app/presenters/on_this_day_presenter.rb`、`app/controllers/api/v1/on_this_day_controller.rb`、`app/workers/generate_on_this_day_worker.rb`、`app/workers/scheduler/on_this_day_scheduler.rb`、`app/javascript/mastodon/features/on_this_day/`、`app/javascript/mastodon/reducers/slices/on_this_day.ts`。
- 数据：`on_this_day_records`；配置：`config/sidekiq.yml`、用户 `on_this_day_enabled`。边界与测试入口见 [ON_THIS_DAY.md](ON_THIS_DAY.md)。

## 多账号切换与资料卡

- 同站点同浏览器保存最多 5 个有效登录会话；加密 HttpOnly Cookie 仅保存可撤销会话的引用。
- 头像与昵称进入个人主页，独立箭头切换账号；箭头触屏目标至少 44×44px。桌面悬停显示资料卡，菜单展开时暂停资料卡。
- 切换、添加、移除及退出账号均保留原会话验证；切换前检查未发布草稿，多标签页身份变化触发刷新提示。
- 代码：`app/controllers/auth/accounts_controller.rb`、`app/lib/browser_account_sessions.rb`、`config/initializers/devise.rb`、`app/javascript/mastodon/components/account_switcher.tsx`、`app/javascript/mastodon/utils/account_switch.ts`、`app/javascript/mastodon/components/hover_card_controller.tsx`。
- 普通导航、旧发帖区和登录页均有入口；验收与测试入口见 [ACCOUNT_SWITCHER.md](ACCOUNT_SWITCHER.md)。

## 发帖、富文本与内容展示

- 字数上限 5000，实例 API、前端计数和后端验证必须一致：`app/validators/status_length_validator.rb`。
- 支持 `text/plain`、`text/markdown`、`text/html`；格式选择按钮和用户默认格式设置；编辑、修订历史、定时发布及联邦内容保留相应格式。
- Markdown 使用 Redcarpet，HTML 经白名单清洗；允许的标签也在前端 HTML 配置中同步。
- 代码：`app/lib/advanced_text_formatter.rb`、`app/lib/html_aware_formatter.rb`、`lib/sanitize_ext/sanitize_config.rb`、`app/javascript/config/html-tags.json`、`app/javascript/mastodon/features/compose/components/content_type_button.jsx`、compose actions/reducer、status/source serializers 和 post/update services。
- 数据：`statuses.content_type`、`status_edits.content_type`；用户 `default_content_type`、`show_content_type_choice`。
- 验证：formatter/sanitize、status API/source、post service、scheduled worker、ActivityPub note serializer 以及发帖系统测试。
- 已进入上游的历史幂等提交、中文输入候选修复应保留上游行为，不能只凭旧提交清单重复覆盖。

## 中文搜索与可视化筛选

- Elasticsearch 的 statuses/public_statuses 索引使用中文单字和 bigram，查询分析器独立；纯 CJK 长词适当放宽命中数量，短词及混合词保持严格匹配。
- 筛选栏支持时间段、自定义日期、搜索范围、作者、媒体/内容条件及移除筛选；日期边界适配上游 before/after 的排他语义。
- 代码：`app/chewy/statuses_index.rb`、`app/chewy/public_statuses_index.rb`、`app/lib/search_query_transformer.rb`、`app/javascript/mastodon/features/search/components/search_filter_bar.tsx`、`app/javascript/mastodon/features/search/utils/search_query.ts`。
- 验证：`spec/lib/search_query_transformer_spec.rb`、`spec/services/statuses_search_service_spec.rb` 的 ES 用例，以及 `search_query.test.ts`。
- 索引侧分析器变化才需要全量重建；不能把每次应用升级都当作重建索引的理由。

## 表情包、分组与预览

- 后台表情包与分区管理：分组、排序、翻译名称、图标、刷新及发布。
- 用户可以选择表情包、排序、显示编号、恢复默认，并搜索表情；API 根据选择返回列表。
- 帖子中的自定义表情支持鼠标悬停或触屏放大预览。
- 代码：`app/models/wxw/`、`app/controllers/admin/emoji_packs_controller.rb`、`app/controllers/admin/emoji_sections_controller.rb`、`app/controllers/settings/preferences/emoji_packs_controller.rb`、`app/controllers/api/v1/wxw_custom_emojis_controller.rb`、`config/routes/wxw_custom_emojis.rb`、`app/javascript/wxw_custom_emojis.ts`、`app/javascript/mastodon/utils/custom_emoji_preview.ts`。
- 数据：`wxw` 表情相关表；用户 `wxw_emoji.picks/order/numbered`；API 测试：`spec/requests/api/v1/custom_emojis_spec.rb`。

## 主题与样式

实际主题入口以 `app/javascript/flavours/*/theme.yml` 和 `app/javascript/skins/*/*` 为准，不能只看 `config/themes.yml`。

| Flavour | Skin |
| --- | --- |
| mastodon-ui | default、fanfou_classic、space_fanfou、vermilion_seal、graphite、sakura |
| bird-ui | mastodon-bird-ui-auto、sakura |
| tangerine-ui | tangerine、cherry、granite、lagoon、purple |

- 当前共有 3 个 flavour、13 个 skin，均复用主前端脚本。旧文档“已移除 Tangerine UI”的描述与本次基线代码不符。
- 三套饭否类主题之外，还有 Bird UI、Tangerine、樱花和 Graphite，以及多种主题下的账号菜单、那年今日、移动导航和个人主页样式。
- 运行时：`app/lib/themes.rb`、`app/helpers/theme_helper.rb`、`app/helpers/settings_helper.rb`、appearance 页面、`app/models/user_settings.rb`。
- 构建：`config/vite/plugin-nofan-themes.mts`、`vite.config.mts`；样式：`app/javascript/styles/`；字体及品牌图片：`app/javascript/fonts/`、`app/javascript/images/`。
- 用户和站点主题设置为 `flavour`/`skin`；已有迁移从旧 `theme` 迁入，升级不能忽略现有选择。深浅模式、系统模式和高对比度需要分别验证。
- 验证：theme helper、Themes、user settings、CSP 测试，加所有主题的生产构建及浏览器验收。

## 访客入口、品牌与页脚

- 未登录访问根路径跳到 `/overview`；登录后默认进入 `/home`。
- `/overview` 静态页由线上 nginx 提供，不能仅凭本仓库宣称已验证其配置。
- 自定义 Logo、品牌文字/图标、字体、Donate/Roadmap 等页脚入口及部分媒体图标。
- 代码：`app/controllers/home_controller.rb`、`app/controllers/auth/sessions_controller.rb`、`app/helpers/branding_helper.rb`、`app/javascript/mastodon/features/ui/components/link_footer.tsx`、对应图片与样式。
- 验证：登录/匿名访问系统测试，以及公开页面、帖子直达、手机导航和页脚链接。

## 工程与发布

- 保留四段式 fork 版本号、来源 tag/commit；正式版与预发布状态必须区分。
- 镜像发布到 nofan 的 GHCR 和 Docker Hub，Rails 与 Streaming 分别构建；release workflow 支持指定 tag 手动触发。
- 工作流还有 nightly、PR、安全构建和 fork 条件定制，合并时需要逐个保留正确仓库目标。
- 相关文件：`.github/workflows/`、`Dockerfile`、`lib/mastodon/version.rb`、`.husky/pre-commit`、`.gitignore`。
- 发布验收：测试/构建、tag 与源码一致、镜像来源一致、服务健康、公开版本/API、资源文件，另加本版本数据库迁移及回滚演练。
