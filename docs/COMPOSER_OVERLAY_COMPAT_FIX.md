# 发帖菜单、确认按钮与表情浮层兼容修复

## 反馈与复现

2026-10-27 用户反馈 Windows Edge / Chrome 下发帖菜单仅改变按钮颜色、语言菜单使编辑区内容上移、确认按钮悬停后消失，以及表情面板下半部分被遮挡。用户尚未提供具体浏览器版本；不能仅根据浏览器名称认定其内核为最新版。

在独立本地数据库 `mastodon_5_adaptation` 中，用实际 Chromium 109.0.5414.46 复现了同类缺陷。当前 Chromium 和测试机 Windows Edge 对原发布镜像的基础菜单检查正常。未修改生产用户的帖子、资料或偏好。

- 原生 Popover API 不可用时，菜单仍在编辑器内部渲染。编辑器的 containment 和 overflow 会使本应按视口定位的菜单产生二次偏移并被裁剪：900px 高视口中，语言菜单顶部到达 914px，格式菜单到达 1354px。搜索框自动聚焦还可能滚动编辑器内部内容。
- 新按钮的悬停颜色使用 color-mix；不支持该语法时背景变透明，而文字仍为白色，形成“按钮消失”的观感。部分旧确认按钮使用的主题悬停 token 也需要回退。
- 表情根元素单独覆盖为 z-index: 2。没有原生顶层时，面板下半部分落到 z-index: 200 的编辑器之后；窄屏下可以全部被覆盖。
- 另发现表情分类使用 Array.prototype.toSorted，旧内核会抛错；Object.keys 已返回新数组，可直接 sort，且不修改 Redux 中的分类状态。

图中的“是否和关注者和提及的用户分享此内容？”来自上游 PrivateQuoteNotify，属于正常的可见范围提醒：使用关注者可见范围引用时，被引用者和提及用户即使未关注作者也能查看。保留原确认流程、“返回编辑”及“不再显示此消息”。

## 修复边界

支持原生 Popover 的浏览器保留原流程。缺少 showPopover / hidePopover 方法时，不输出未支持的 popover 属性，将原本 inline 的桌面菜单挂到 body，避开编辑器的裁剪和 containing block；移动端仍用原生 BottomSheet。卡片补充有限 z-index 回退，表情面板不再覆盖卡片层级。

深浅主题的品牌色与危险色悬停 token，以及新按钮的通用悬停变量，先提供基本色回退，再由 @supports 启用 color-mix。保留现代浏览器的配色、面板结构、尺寸、最小化及发布行为，不通过关闭 CSP 或禁用文字选择解决问题。

## 验证与复测入口

- TypeScript、相关 ESLint / Stylelint / 格式检查、完整生产前端构建通过。
- 账号切换、BottomSheet、表情状态与搜索共 44 项回归通过。
- 开发预览中，Chromium 109 / 当前 Chromium × Mastodon / X UI / Tangerine × 深浅模式 × 1440 / 390px，共 24 个菜单、表情与悬停检查通过。
- 完整生产构建产物在 Chromium 109、当前 Chromium、Windows Edge、Windows Chrome 下，分别完成三种风味 × 深浅模式 × 桌面/手机的 12 个组合，共 48 个场景通过。额外检查编辑器内部滚动和标题位置不变、表情行能实际接收指针，新旧发布按钮均保持可见。本次不是全站旧浏览器兼容认证。

可复测脚本 `deploy/shared/verify_composer_ui.cjs` 仅允许本机地址，并拦截非本机 HTTP 请求。使用独立预览的登录 storageState；凭据文件不提交，不打印 Cookie 或令牌。示例：

```sh
UI_BASE_URL=http://localhost:3107 \
UI_AUTH_STATE=tmp/preview-auth.json \
UI_BROWSER_LABEL=current \
UI_BROWSER_PATH=/path/to/chrome \
node deploy/shared/verify_composer_ui.cjs
```

每个浏览器检查 12 个组合，包含菜单在视口内且能接收指针、编辑器位置与内部滚动不变、表情行实际可点、新旧发布按钮悬停后保持可见。脚本只在独立预览账号上保存主题和编辑未发布草稿，不发帖。

发布镜像源码固定为 a90036ab943cf4719869b1a4a9404790fddf6184，[构建 40445649118](https://github.com/nofan-xyz/mastodon/actions/runs/40445649118) 的 Rails 与 Streaming 双架构构建及 manifest 合并全部成功。本次只需更新 Rails Web / workers，保留既有 Streaming。上线前要求 5025 文件源码匹配、48 场景验收清单及无待迁移检查；应用回退保留旧镜像和原 Compose，不执行数据库迁移。

## 上线结果

北京时间 2026-10-27 11:52 已部署至 beta.nofan.xyz，版本为 `5.0.0.0-alpha.1+beta-a90036ab943cf4719869b1a4a9404790fddf6184`。最终镜像固定为 `ghcr.io/nofan-xyz/mastodon@sha256:6fe337e0d6dac8116b145cddcab8eca9f73da73f186a79067ad9ee4b15e5862d`。

`update_ui_release.py` 已实际执行：核对 5025 文件、无待迁移检查、更新 5.0 Web 与三组消费者、健康及认证只读验收通过。没有执行数据库迁移，没有更换正式 4.7 Web 或 Streaming；两个入口仍读取相同的真实资料/偏好/主页/通知，密钥和启用的 TOTP 密文可解密。scheduler 消费者一个，未发现新的缺表/列/类/方法错误；已有 retry=55、dead=9999 是历史队列，不清空。

三个公网入口的健康、版本、登录页本站 JS/CSS 和 sw.js 返回正常，ban.fan 仍用本域资源。配置及旧镜像回退目录为 `/home/mastodon/shared-rollout/20261027T035055Z-composer-ui`。UI 写入均在独立演练账号上完成；现有生产身份只做 API 只读验收。

生产构建测试机版本：Windows Edge 156.0.4314.50，Windows Chrome 156.0.8078.47。旧内核复现用 Chromium 109.0.5414.46；收到用户的准确版本后仍可针对其环境补查，不能仅凭名称断言用户与测试机环境完全相同。