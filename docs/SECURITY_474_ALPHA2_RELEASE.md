# Mastodon v4.7.4 / 5.0 alpha.2 安全更新

## 固定来源

正式4.7 Web基于上游v4.7.4 d04059fc80be5cbba6b4dd5a8b94d63ffff09f2c，本站a6004bb2ea9e18140196c8949df6e8cf42925882。beta基于main a0e2cf9c50d331bd8ab24a51150c37d46bf44cc0（5.0.0-alpha.2），合并20个上游提交，本站bdbb820c403fe7ffa10ea70e5b4903e4fef9e0c7。仍为alpha测试版，没有发布为5.0稳定版。两条合并前分支均保留backup-before-474/alpha2-20261029。

官方发布说明：https://github.com/mastodon/mastodon/releases/tag/v4.7.4 。纳入ActivityPub标识符校验、跨域重定向和Keypair URI来源加固，css_parser等依赖更新；保留本站已使用的Ruby4.0.9及共库依赖。正式Web的SOURCE_TAG改为codex/v4.7.4-shared-data，fork revision归零，显示4.7.4.0+shared47-构建SHA。

beta另外纳入新表情选择器、关注请求按钮、账户编辑样式和新发帖组件重构；保留X UI、Tangerine、账号切换、格式选择、手机私密回复提醒、光标滚动和顶部遮挡修复。旧发帖表单按上游删除，本地功能迁移到form/components，OnThisDay异步入口迁移到TS。header合并接纳上游栏边框并保留8px圆角、不透明顶部遮挡。

正式Web创建远端账号的旧private_key=nil赋值与共库ignored_columns冲突，已删除该无效写入，仍使用Keypair；登录挑战测试沿用本站既有/home跳转，不改变挑战逻辑。新emojiRoot的z-index:2会压低body portal，已删除这项覆盖，复用MenuCard统一层级，修复Chromium109表情不能点击的回归。

## 验证与限制

4.7：4113前端测试、TypeScript、143安全/登录Ruby示例、相关RuboCop、双架构完整镜像构建。5.0：4268前端测试、TypeScript、相关ESLint/Stylelint、完整生产前端构建，109安全Ruby示例零失败（其中1项ML-DSA-44 RFC签名为上游pending）。最后一份beta修改只涉及emoji SCSS，JS和后端与0fc30594eb相同。

Windows Edge：18个手机私密回复布局、12个菜单/emoji/按钮悬停、12个账号切换/内容警告、72个主题顶部滚动场景。Chromium109：12个菜单/emoji/按钮场景，修复前表情命中断言失败，修复后通过。44px点击目标测量允许浮点误差0.01px；Tangerine实际宽43.999984741px，并非缩小目标。

WebKit18个布局断言通过，但外观设置页导航产生JSON Unexpected EOF，旧8f构建在相同环境同样复现，不能声称WebKit全套无错误通过，也没有真机iPhone/Vivaldi验收。此项作为已知对照限制保留，不隐藏日志。此前悬浮卡controller源码未变，完整JS套件包含其回归，不把旧16个夹具重新计为本次新浏览器结果。Streaming源码与package/yarn锁均未变，因此保留原Streaming镜像，不需要以重建的标签替换相同源码。

隔离最终镜像按4803/5002文件清单核对来源、依赖和SOURCE_COMMIT；不连接正式库写入测试。HTTP验收涵盖密码/TOTP/重放/共享限流、跨版本关注/发帖/编辑/删除/幂等/喜欢/书签/转发、资料/偏好、通知/认证WebSocket、媒体/头像和三种文本格式安全过滤。额外验证4.7.4发起关注请求，两版读取待审核列表及follow_request通知、alpha.2批准，恢复测试账号原锁定和关注关系。

## 部署状态

北京时间2026-10-29 23:46完成切换，正式站与ban.fan为4.7.4.0+shared47-a6004bb2ea…，beta为5.0.0.0-alpha.2+beta-bdbb820c40…。最终正式镜像 ghcr.io/nofan-xyz/mastodon@sha256:4ec64b192bf2dc27c491d953983789e7104f27dcf34709318971bd8169f37766；beta Web/三组消费者 ghcr.io/nofan-xyz/mastodon@sha256:cd29d3990cfdb26945c7f41e29e563b81cee85c7b5b5a6357f3131c954c39d42。

[正式构建40897591390](https://github.com/nofan-xyz/mastodon/actions/runs/40897591390) 与 [beta构建40902226002](https://github.com/nofan-xyz/mastodon/actions/runs/40902226002) 双架构与manifest成功。中间未完成适配的构建未上线。最终镜像演练与关注请求补测通过，生产已有OAuth身份在两Web认证只读验收通过；资料/偏好/主页/通知一致，签名密钥与TOTP可解密，WebAuthn规范域名保持nofan.xyz。9个服务健康，一个scheduler消费者，发布观察期内无新增缺表/缺列/类或方法兼容错误，联邦新动态持续入库。历史retry/dead没有清空，不能称所有失败任务为零。

新数据库备份 `/home/mastodon/shared-rollout/20261029T151347Z/production.dump`，约22.16GiB，自定义归档不压缩，pg_dump一致性快照完成，pg_restore --list目录验证通过；没有声称本次执行了完整恢复演练。最初压缩备份太慢而终止，partial文件保留但不作为可用备份。配置/旧镜像回退目录 `/home/mastodon/shared-rollout/20261029T154430Z-security-release`，current-security-update指向此处。验收失败部署器自动恢复旧应用/配置并保留实时数据；人工回退也不应恢复旧数据库覆盖新写入。

三个公网入口版本、health、登录页本站JS/CSS与sw.js通过；最终beta发帖、通知设置、关注请求和新表情模块的103个依赖及旧版通知模块72个依赖全部200。ban.fan仍使用自身资源域名。旧标签页所需的历史beta资源继续保留，更新前先运行retain_beta_assets.py；本次未修改ban.fan协议、线路或媒体桶。

本地临时3107预览与本任务6396 Redis已停止，原工作区未提交文档未动。独立演练服务完成验收后停止。没有新增迁移，部署器在运行时检查pending migrations，不执行db:migrate，不覆盖正式库或媒体。保留不可变旧资源与应用/配置回退，不回退实时数据。
