# 4.7 与 5.0 共用正式数据：兼容性审计

本报告记录 2026-10-26 上线前的源码及只读审计。当时未连接 beta 到正式库、未执行正式迁移；后续兼容补丁和隔离演练已完成，并于当日 15:44 正式切换共库。当前状态见 [SHARED_DEPLOY.md](SHARED_DEPLOY.md)，下文保留审计当时的证据与限制。

## 本次复核结论：已有基础适配可以直接复用

正式站实际 `SOURCE_COMMIT` 为 `0afb546c7d8139688642c80c1cc14d6e17335317`，与本地 `v4.7.3.3` 一致。不能按未做定制的旧版 Mastodon 估算这次互通工作。

| 已有基础 | 源码及线上证据 | 对后续工作的意义 |
| --- | --- | --- |
| 新版 keypairs 存储及本地账号密钥迁移 | 4.7 已有 keypairs 表、加密模型及 `20260702144128` 迁移；提交 `786e86274a` 合并了 keypairs 回移。线上迁移已执行，有 1,410 条本地 keypair 记录，正常使用的本地账号缺失 keypair 数为 0 | 复用现有签名身份与加密密钥，不重新生成账号密钥，不重新从零迁移所有账号 |
| flavour/skin 设置迁移 | `20260827000000` 已在正式库执行；序列修复见 `8eb9bf45ad` | 复用现有偏好存储，补新键与皮肤别名即可 |
| 保留未知个人设置键 | 两版 `UserSettingsSerializer` 无差异，`UserSettings#as_json` 返回原始 hash；实际探针确认旧版能原样保留 5.0 新键 | 不需要重写整个序列化机制，但仍需补新键定义及并发更新处理 |
| 接近的运行基础 | 4.7 / 5.0 分别为 Ruby 4.0.6 / 4.0.7、Rails 8.1.3.1 / 8.1.4、Sidekiq 8.1.6 / 8.1.7 | 可以聚焦业务和存储协议差异，不必按跨代框架替换处理 |

在隔离的 5.0 副本上运行正式 4.7 镜像的只读探针，确认 1,332 个用户可读、1,410 条本地密钥可解密、13 个 TOTP 密文可解密，且未知偏好键会保留。这验证了上述基础适配的实际复用价值，不等于两版共库写入已经兼容。

探针同时复现了真实缺口：5.0 副本已删 `accounts.private_key`，4.7 的新账号密钥初始化仍报 `NameError`；FASP 能力查询报 `PG::UndefinedColumn`；直接读取 `web.theme_color` 报 `UserSettings::KeyError`；旧镜像没有 `MultiMergeIntoOwnHomeWorker` 和 `UpdateAccountReachWorker`。正式库尚无 `fasp_capabilities`、`account_reach_filters` 两张新表，FASP provider 数为 0；这减少了现有 FASP 数据转换量，但不能免除读写协议适配。

正式库还有 1 条本地账号的旧 `private_key` 非空记录。其存在不代表需要重做全部密钥迁移；在说明其用途及确认回退策略前，共存迁移应保留旧字段，不能直接删除。源码、模型和任务补丁完成后，再在独立演练库做双向写入与回退测试。

## 目标与已核对基线

- nofan.xyz：保留 4.7 界面，当前公网版本 4.7.3.3。
- beta.nofan.xyz：使用 5.0 界面，当前应用提交 47d6d67d70a35b152fe3100e1fbb4a3d13970a5f，上游固定 559688e153ce3a50b26e327bfe488743da99f3dc。
- 两个入口最终操作同一套正式账号、帖子、关注、通知、资料、站点设置和媒体，而不是定期复制或双库同步。
- 检查基于本地 v4.7.3.3 tag 与已部署 beta 源码，以及正式站非敏感配置。尚未完成双版本共库运行实验，不能将本报告视为已通过上线验收。

## 建议目标架构

同一个逻辑 Mastodon 实例提供两个 Web 入口：4.7 兼容补丁版和 5.0 beta。共用生产 PostgreSQL、必要的 Redis 时间线及通知通道、媒体对象存储、既有加密与签名身份；站点设置采用跨版本一致的失效策略。后台任务必须采用一套已验证的兼容消费者方案，计划任务只由一套实例负责。

本次源码对照未发现 5.0 删除原有 4.7 worker 文件，已有 worker 的 `perform` 签名也未出现差异。因此优先演练「4.7 Web + 5.0 Web + 统一 5.0 workers/scheduler」：减少在 4.7 中回移后台消费者的范围。源码签名一致仅是候选方案的依据，仍需验证实际旧任务载荷、新旧模型调用、重试和唯一锁；4.7 Web 自身用到的新类或设置方法仍要按调用路径补齐。

两端 canonical LOCAL_DOMAIN / WEB_DOMAIN 均保持 nofan.xyz。beta 是附加访问入口，不把正式账号变成 @user@beta.nofan.xyz。需适配 beta 浏览器页面的 host、重定向、表单及 CSP；联邦对象、WebFinger、邮件链接维持正式身份。不要整体改写 API 返回的所有 nofan.xyz 地址。

## 已确认的改动项

### 1. 数据库迁移与账号签名

版本间有 14 个迁移文件差异：13 个新增迁移，另有 1 个已存在的历史迁移文件改动。不能为了对齐源码重跑历史迁移。新增迁移既有增加表/列，也有删除字段。

- 5.0 的 post-migration 删除 accounts.private_key；4.7 的 Account.ensure_keys!、generate_keys 和 Keypair.from_legacy_account 仍引用它。
- 4.7 已经回移 keypairs 数据与主要读写逻辑；剩余工作是处理旧字段引用。共存期应保留该列，或先清理 4.7 的残余引用并验证回退。不能让未打补丁的 4.7 直接运行在删除该列后的库上。
- 增加 account_reach_filters、审核订阅/建议表、action_category 等结构前，要逐项确认默认值、约束和新模型的调用路径。不能直接让 beta 自动执行所有标准迁移。
- 正式切换前制定兼容迁移集、执行顺序、旧镜像回退条件和备份恢复演练；schema_migrations 记录也应纳入管理。

相关文件：app/models/account.rb、app/models/keypair.rb、db/post_migrate/20261016161747_remove_private_key_from_accounts.rb、db/migrate/。

### 2. FASP 的数据模型

5.0 将 fasp_providers.capabilities JSONB 字段搬到 fasp_capabilities 表。4.7 的能力查询、表单写入和回调仍使用旧字段。

可行改造方向是给 4.7 兼容版回移新的 FASP 模型与相关服务/表单，先保留旧列，统一两端读写语义；如果要求回退至未打补丁的 4.7，还必须有旧列回填或临时双写方案。仅保留旧列而不处理两套写入，会产生两份不一致的能力状态。

相关文件：app/models/fasp/provider.rb、app/models/fasp/capability.rb、app/workers/fasp/、对应后台控制器和表单。

### 3. 后台任务和时间线

5.0 的 User 在 settings 更新后调用 MultiMergeIntoOwnHomeWorker，4.7 没有这个任务类。5.0 还增加 UpdateAccountReachWorker 以及审核订阅、待批准账号提醒调度器。

- 若保留 4.7 消费者，共用任务队列前它必须理解 beta 产生的任务类、参数及其依赖的模型/FeedManager 方法；否则可能出现反序列化或找不到常量错误。优先统一为 5.0 消费者时，则验证 5.0 能完整处理 4.7 Web 投递的现有任务，不必仅为消费而回移所有新 worker。
- 另一种实现是严格路由版本专用队列，但这仍需核对嵌套任务、重试、锁和所有投递入口，不能简单增加第二个默认队列消费者。
- 两端的“显示自己的帖子/转嘟”、首页重建和筛选语义要对齐，避免不同版本轮流改写同一个 Redis 时间线。
- 只启用一套 scheduler，避免重复投递、清理和定时任务。

正式站现有 default/mailers/scheduler/fasp、ingress、push/pull 三组消费者均需要纳入演练，不能只测 web。

### 4. 站点简介与配置缓存

两版 Setting 都以 MD5(default_settings.to_s) 生成设置缓存前缀。实际计算结果：

- 4.7：a1dfb749d0463d64fe8534e245b4ee5d
- 5.0：cea3b7f4b90f3a1773a8f37341bb579c

因此，同库不等于简介和设置立即同步：一端写入只更新自己的缓存键，另一端可能保留旧值。需要统一站点设置缓存协议，或实现跨版本失效通知。一般 Rails 缓存应另行审计，不能为了解决设置缓存而直接让所有版本缓存对象混用。

站点简介、规则等可通过共享 settings 数据实现一致；nginx 托管的静态欢迎页、主题文件、站点图标文件、环境变量和反代配置不全部属于数据库，需要单独对齐。4.7 的自定义 CSS 也不能无条件应用到 5.0 的新 DOM。

相关文件：app/models/setting.rb、config/settings.yml、app/helpers/theme_helper.rb。

### 5. 个人偏好和主题

UserSettings 保留原始 JSON，不能简单断言 4.7 保存时一定删除所有 5.0 键；但读取或直接设置未注册键会抛 KeyError。

- 4.7 兼容版需要理解需要共用的新增偏好，例如 web.theme_color、display_own_posts、display_own_boosts、default_spoiler_field。
- 两端保存要保留未知键，并验证并发修改不会覆盖另一端的新值；必要时对 JSON 更新增加合并/并发控制。
- 太空饭否与饭否经典映射、Bird UI 与 X UI 标识保留、默认值和控件可用范围需要对齐。共享选择不意味着旧 UI 必须支持所有新布局效果。

相关文件：app/models/user_settings.rb、app/lib/user_settings_serializer.rb、app/models/concerns/user/has_settings.rb、app/lib/themes.rb。

### 6. 登录、账号切换和安全密钥

- 使用同一 users 数据后可使用同一账号密码，解密 2FA 等数据仍要求匹配原有 Active Record encryption 密钥。跨节点生成的重置/确认链接和 token 也需统一安全配置。
- 不能用 beta 当前随机生成的密钥代替正式站现有密钥；正式账号签名 keypairs 也不能重新生成。
- Cookie 当前是 host-only；账号互通不等于两域免重复登录。可先保留独立会话，避免扩大 Cookie 到所有子域；需要免重复登录时再做受控跳转。
- 当前 WebAuthn 只允许 canonical web_domain 的单个 origin；beta 需要受控加入允许的 origin，并显式确认 RP ID 与既有 nofan.xyz 凭据兼容。
- 验证普通登录、2FA、安全密钥、停用/未批准账号、切换账号、撤销会话、密码重置和 CSRF。

相关文件：config/initializers/1_hosts.rb、session_store.rb、webauthn.rb、app/controllers/auth/、app/controllers/concerns/reauth_concern.rb。

### 7. 媒体、实时服务和联邦出口

正式站已启用 S3，beta 已切换独立 `beta-nofan-box` 桶并导入数据库快照，历史媒体仍在后台复制。互通时需要使用同一套正式对象存储路径和既有媒体 URL，不能只共享 SQL；不能将 beta 的试验数据未经审查直接回灌正式库。独立快照保留作演练和回退用途。

Streaming 主体源代码在这两份基线间仅有注释修正，可优先验证复用正式站 Streaming。仍要测试认证、WebSocket、Redis 发布订阅及通知。后台联邦投递、搜索索引、邮件及媒体清理保持统一所有权，避免两套调度器重复处理。

## 演练验收与实施顺序

1. 在隔离演练库中加载 4.7 数据与测试媒体，应用兼容迁移，同时运行 4.7 兼容版和 5.0；这是共库演练，不是用快照替代最终互通目标。演练禁用外发联邦及邮件。
2. 验证两端双向发帖/编辑/删除、资料/头像/简介、关注/点赞/收藏/通知、站点设置跨缓存失效、旧偏好保留、2FA/安全密钥、任务消费和单 scheduler。
3. 验证停止 beta 后 4.7 兼容版仍独立工作，旧镜像回退不依赖已删除字段，必要时备份能够恢复。
4. 验证通过后先部署 4.7 兼容补丁和受控迁移，再将 beta 作为正式数据的第二个 Web 入口接入。原 beta 独立数据库先归档，不直接合并测试账号到正式 users/accounts。

此方案意味着 beta 写入会立即影响正式数据，并且需要给正式后端做兼容升级；正式界面可以继续保持 4.7。

官方参考：

- https://docs.joinmastodon.org/admin/config/#local_domain
- https://docs.joinmastodon.org/admin/config/#web_domain
- https://docs.joinmastodon.org/admin/scaling/
- https://docs.joinmastodon.org/admin/upgrading/
