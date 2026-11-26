# 回复编辑器遮挡与候选列表修复

## 范围与原因

本次延续 2026-10-28 用户截图排查，修复 4.7/5.0 的资料悬浮卡与账号候选问题，以及 5.0 手机隐私提醒挤压编辑区的问题。固定上游仍为 `68f6e597ee`，没有再次合并上游。

- 资料卡：鼠标在昵称上等待或卡片已经显示时，编辑器获得焦点、输入、IME compositionstart 都没有取消等待或关闭卡片。两版都存在。
- 英文回复：两版 token 识别均把 `@alice hello` 当作一个两词账号搜索，中文正文不走同一匹配。账号 handle 现在在空白处结束；正常 `@账号`、全角 `＠`、表情和话题补全保留。
- 延迟结果：清空时原来只中断正在运行的部分请求，没有取消节流尾调用，也没有可靠地丢弃旧结果。现在账号、话题和表情请求都以递增代次和当前 controller 关联，清空取消尾调用；旧请求完成不会覆盖新 controller，迟到结果不能恢复候选框。
- 5.0 短屏：隐私提醒原本在可滚动编辑区之外，软键盘缩小 visualViewport 后编辑区可能接近零高。提醒移入同一滚动区，保留原文和 aria-describedby，不修改可见范围；ResizeObserver 在编辑区缩小时只调整内部滚动，保持当前输入框可见，不移动页面或标题。
- 5.0 正常候选：定位镜像原先没有计入回复预览和警告字段前置内容的偏移，滚动后会误判候选位置移出视野。现在用输入框相对滚动容器的实际偏移定位；不支持原生 Popover 的内核改用 body portal，避免裁剪。

## 固定源码与镜像

- 4.7 源码：`83690efb1bcc8ffd23e2f63205872ab58a86e174`，分支 `codex/v4.7.3.3-compose-fix`，基于线上共享数据兼容源码 `1d03b99d84`，没有使用原工作区的未提交文档。
- 5.0 源码：`8fbd95dfcff01dc7aebd2577900814c31967ce2f`，包含初次交互修复、键盘缩小时位置调整、候选定位修复三个应用提交。
- 4.7 镜像：`ghcr.io/nofan-xyz/mastodon@sha256:fe7bc0cd3e4b051febc97cd08f80e22b91933c6dc1fbf868928d4a4259bfc9c9`。
- 5.0 镜像：`ghcr.io/nofan-xyz/mastodon@sha256:0dceae2319bc9a3dd0f7bfe9ab2738674c9dfa11c51786c52355e624bcbfb227`。
- [4.7 构建 40724458010](https://github.com/nofan-xyz/mastodon/actions/runs/40724458010)、[5.0 构建 40720932379](https://github.com/nofan-xyz/mastodon/actions/runs/40720932379) 双架构与 manifest 合并均成功。中间应用构建未上线。

## 本地验证

两版 TypeScript、相关 ESLint/格式检查及完整生产前端构建通过，5.0 所改 SCSS 的 Stylelint 通过。

- 4.7 完整前端：32 文件、4113 项通过；5.0：41 文件、4268 项通过。新增覆盖候选清空后的返回、节流尾调用取消、响应乱序、新请求仍可取消、表情/话题迟到响应，以及焦点、输入法和普通浏览悬浮。4.7 额外覆盖原 Axios 的请求失败与取消分支，最终构建纳入这两项回归。
- 5.0 后一轮并发构建时 HTML 大输入性能用例超过既有 200ms 阈值；减少测试 worker 后整套 4268 项通过，未改阈值。4.7 首次用 node_modules 符号链接运行时测试环境找不到 fake-indexeddb，独立 immutable 安装后整套通过，未改应用处理这个环境问题。
- Edge / Chrome × 两版实际 HoverCardController + Popover 的隔离浏览器夹具，共16场景通过。只替换资料展示内容，没有用生产用户资料。
- Edge 156.0.4314.50、WebKit 27.2、Chromium 109.0.5414.46 加载本次完整5.0生产前端，共54个手机加锁回复布局：Mastodon / X UI / Tangerine × 深浅 × 280/320/360px可视高度。检查输入框完整可见、草稿保留、隐私提醒仍在滚动区可读、英文正文不查询账号、正常候选可点击选入、延迟结果不会重开。
- 手机检查使用独立 `mastodon_5_adaptation` 中的 Alice/Bob 测试账号与专用私密帖子，保存主题和未发布草稿；无正式发帖或偏好修改。WebKit 为 Linux 自动化环境，视觉高度变化为模拟软键盘，不能声称已经实际操作用户的 iPhone / Vivaldi。

`deploy/shared/verify_private_reply_ui.cjs` 固定使用 localhost:3107，并拦截非本机请求；依赖本地受保护的登录 storageState 和私密测试 fixture，不能指向公网。`update_compose_interactions.py` 要求双版本固定镜像、源码清单、验收记录及旧镜像匹配，备份并只更新 Web/Web-beta/三组5.0消费者，无迁移，Streaming保持原值，验收失败恢复旧配置和镜像，保留正式数据。

## 上线与回退

北京时间 2026-10-29 00:35 完成上线。4.7 Web（nofan.xyz / ban.fan）更新为 83690efb1b，5.0 Web 与三组消费者更新为 8fbd95dfcf。Streaming、数据库、S3 和正式账号配置保持原值，没有执行迁移。

最终镜像逐文件核验：4.7 共4797文件、5.0共5027文件，SOURCE_COMMIT 与上表一致。隔离演练通过共享身份、密码/TOTP/登录限流、跨版本关注/发帖/编辑/删除/幂等/喜欢/收藏/转发、通知、WebSocket、媒体/头像和三种文本格式回归。

上线认证只读验收通过：同一正式 OAuth 身份在两 Web 读取相同资料、偏好、主页和通知；既有签名密钥/TOTP可解密。9个服务健康，scheduler消费者一个。11:51复查未发现此次上线以来新增的缺表/缺列/类或方法兼容错误，联邦新动态继续入库；历史retry/dead不代表零。

三个入口公网版本、health、登录页本站JS/CSS及sw.js正常；ban.fan资源使用自身域名，未回归跨域问题。第一次公网探测早于容器启动完成，曾返回502；服务健康后重新检查全部通过。

配置和旧镜像备份：`/home/mastodon/shared-rollout/20261028T163318Z-compose-interactions`，`current-compose-update`指向该目录。失败时部署器恢复旧配置/应用镜像并保留实时数据；人工回退也仅恢复该目录的before-compose.override.yml并重建五个应用角色，不恢复旧数据库，不更换Streaming。

本地临时3107/3260预览及本任务的6385 Redis已停止，保留独立演练结果。浏览器验证为自动化环境，实际iPhone/Vivaldi仍需用户复测。
