# 2026-10-27 上游更新与共库发布验收

本次固定上游 `08941b303f2ba297ada70c3e646d600916403666`，应用源码合并提交 `b7bdcba68320de523bbd6c763129586f89926145`。仍为 5.0 alpha 开发版本，不是稳定版。

完整 Ruby 4.0.8 应用镜像由 [CI 40368451603](https://github.com/nofan-xyz/mastodon/actions/runs/40368451603) 构建，amd64/arm64 及 manifest 合并通过。固定镜像：

```
ghcr.io/nofan-xyz/mastodon@sha256:fc3b0ed459196defa19a129ec4c61f33dcaccbe57fdf51acc7d69a4c6c86052f
```

## 发布前演练

在 `/home/mastodon-shared-rehearsal` 使用独立 PostgreSQL/Redis、专用 beta 桶及演练对象前缀；禁用联邦外发、邮件和周期调度。4.7 Web 使用原兼容镜像，新 5.0 Web 与消费者使用上面的完整镜像，没有向 Ruby 4.0.7 旧容器覆盖新依赖。

- 镜像内 5024 份源码/配置/依赖锁文件与本次提交逐文件匹配。
- 新迁移 `20261013133732_create_admin_server_checks` 执行成功。迁移前后 1335 个演练用户的密码摘要、签名密钥、旧密钥及 FASP 镜像字段不变；仅新增预期版本。
- 两入口密码与 TOTP 登录、重放限制、共享登录限流、OAuth 身份与规范域名通过。
- 跨版本关注、发帖/编辑/删除、幂等、收藏、转发、通知及认证 WebSocket 分发通过。
- 上传媒体、旧端读取新上传、新端读取旧头像、对象公开读取通过；测试对象位于演练前缀。
- 两版各自创建纯文本/Markdown/HTML，共六种富文本场景通过，含非 ASCII URL、格式保留和脚本过滤。
- 站点设置、旧端陈旧实例写入不覆盖新端设置、并发偏好写入、FASP 双向兼容、WebAuthn RP/来源和消费者队列检查通过。

以上写入均使用演练账号。生产验收只读已有授权资料、偏好、主页与通知，不使用真实用户密码，不创建正式测试帖子。

## 操作入口

`deploy/shared/stage_upstream_rehearsal.py` 与 `verify_upstream_rehearsal.rb` 用于本次演练镜像和迁移身份核验；`verify_upstream_text.cjs` 补充富文本 HTTP 检查。`deploy_upstream_release.py` 要求本次演练验收清单及已完成的生产备份，固定更新 5.0 Web 和三组消费者，保留 4.7 Web、Streaming 与媒体配置。

本次新增迁移仅扩展健康检查表。失败时恢复旧应用镜像，保留扩展表和新写入；不自动恢复旧数据库覆盖正式数据。生产身份摘要同时检查密码、本地签名密钥及旧密钥，检测到不一致时停止并人工核查并发的正常账号修改。
## 实际镜像 UI 与上线验收

Windows Edge 通过独立 HTTPS 转发至演练的回环端口，验证 Mastodon / X UI / Tangerine × 深浅模式 × 1440 / 390px 共 12 个场景，主题保存与账号列表打开/关闭均通过，手机切换按钮至少 44×44px；没有浏览器 JS 异常。WebSocket 在浏览器演练中禁用，认证 WebSocket 分发由内部 HTTP/Streaming 套件单独验证。

测试代理最初的 Cookie 转发及手机弹层选择器不适配已修正后重跑通过，没有据此更改应用代码。手机账号列表采用原生 BottomSheet，不能沿用桌面 Popover 外壳类名查找。更广的本地构建检查仍为 72 个标题/滚动场景及 240 个下拉主题组合，见 UPGRADE_5.md。

北京时间 2026-10-27 01:55:55，生产健康检查表迁移耗时约 0.095 秒；01:57 部署与认证只读验收通过。正式密码、本地签名密钥和旧密钥摘要不变；现有 TOTP 密文可解密，WebAuthn RP 与 beta 来源正确。

01:57 后队列检查：三组消费者健康，scheduler 消费者仅一个，新兼容错误为零；已有 retry=85、dead=9999 属于历史队列，未清空。beta 公网版本为 `5.0.0.0-alpha.1+beta-b7bdcba68320de523bbd6c763129586f89926145`，正式站和 ban.fan 仍为 `4.7.3.3+shared47-1d03b99d8412785da33b127eb72336d0898045bc`。三个入口健康及 sw.js 返回 200，登录页所引用的本站 JS/CSS 均成功读取；ban.fan 本站资源没有指向 nofan.xyz。

生产备份与发布记录目录：`/home/mastodon/shared-rollout/20261026T172616Z`，包含 `backup.done`、约 7.1 GiB 的一致性数据库备份和 `upstream-release/` 下的原/新 Compose、身份核验、验收与最终镜像信息。备份目录已检查，可回退到上一应用镜像；本次备份未再完整恢复一次，不应把目录检查等同完整恢复证明。

独立演练服务全部停止，卷与检查结果保留。临时浏览器凭据副本、TLS 测试证书/私钥和 SSH 隧道已清理；正式环境继续使用原密钥和 S3 桶，不增加付费服务。