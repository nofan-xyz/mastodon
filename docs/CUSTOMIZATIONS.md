# nofan 分支个性化修改清单

本文件记录 nofan 分支相对上游 Mastodon 的全部自定义修改。新增功能或修改约定时请同步更新本文件。

## 功能新增

### 那年今日（On This Day）

- 侧边导航入口 + 独立页面（`/on_this_day`），回顾往年同一天发布的嘟文。
- 默认开启，用户可在偏好设置中关闭；关闭时 `GET /api/v1/on_this_day/state` 返回 `{ state: 'disabled' }` 而非 403。
- 收录公开 / 不列 / 仅关注者嘟文，排除私信；尊重当前屏蔽与隐藏关系；不含转发，回复仅含自我回复。
- 记录按 UTC+8（Asia/Shanghai）日期划分；每日 23:00 启动次日预生成，将账号任务分散到 23:00–23:50。00:05 补齐当天缺失记录，访问时仍支持按需生成；任务携带固定日期并去重。
- 功能开启时导航在生成期间保持显示；全局统一轮询并在北京时间跨日、返回标签页时刷新，清除昨日数据和过期响应。展示预生成结果时重新过滤已删除或不再符合条件的嘟文。实现与验收说明见 `docs/ON_THIS_DAY.md`。
- 测试：`spec/lib/on_this_day_spec.rb`、`spec/requests/api/v1/on_this_day_spec.rb`。
- 相关代码：`app/lib/on_this_day.rb`、`app/models/on_this_day_record.rb`、`app/controllers/api/v1/on_this_day_controller.rb`、`app/javascript/mastodon/features/on_this_day/`。

### 访客落地页

- 未登录访问 `/` 重定向到 nginx 托管的静态欢迎页 `/overview`；登录成功后统一进入 `/home`。
- 相关代码：`app/controllers/home_controller.rb`、`app/controllers/auth/sessions_controller.rb`。

## 搜索

- Elasticsearch 8.x（线上由 7.10.2 升级至 8.19.15，全新集群 + 全量重建）。
- 中文优化（`app/chewy/statuses_index.rb`、`app/chewy/public_statuses_index.rb`）：
  - 索引侧：`cjk_bigram` 过滤器（`output_unigrams: true`），CJK 单字 + 二元词都入库，保住单字召回。
  - 查询侧：专用 `search_analyzer`（`verbatim_search` / `content_search`，`output_unigrams: false`），中文词组要求子串命中，消除散字噪音。
  - 注意：索引/查询分析器必须保持分离——单字与 bigram 同位时会被 match 查询视为同义词，相邻性约束会失效。
- 连写长词松绑（`app/lib/search_query_transformer.rb`）：纯 CJK 且产生 3+ bigram 的查询词，要求命中 bigram 数 - 1（`minimum_should_match`），完整子串排最前，分写文档也能召回；两字词、英文、混合查询维持严格 AND。
- 分析器变更后生效方式：映射/查询侧改动用 `bin/tootctl search deploy --only statuses public_statuses --only_mapping`（秒级）；索引侧改动需去掉 `--only_mapping` 全量重建这两个索引。
- 测试：`spec/services/statuses_search_service_spec.rb` 中文用例（`:search` 标签，需 ES 环境）。

## 界面与体验

- 嘟文字数上限 500 → 5000（`app/validators/status_length_validator.rb` 的 `MAX_CHARS`，实例 API 同步上报 `max_characters`）。
- 自定义主题三套（`config/themes.yml`）：
  - `fanfou_classic`（饭否经典）：绿色侧栏、浅色渐变背景。
  - `space_fanfou`（太空饭否）：磨砂玻璃侧栏、圆角面板。
  - `vermilion_seal`（朱砂印）。

## 工程与运维

- 版本号采用四段式（`vX.Y.Z.N`），第四段为本分支的递增发布号；发版 = 推送分支 + 同名 tag，CI 构建镜像。
- Docker 镜像推送至 `ghcr.io/nofan-xyz/mastodon` 与 `ghcr.io/nofan-xyz/mastodon-streaming`（`.github/workflows/` 已改为 fork 配置）。
- git pre-commit 钩子已禁用。
- 已移除曾引入的 Tangerine UI 主题。
