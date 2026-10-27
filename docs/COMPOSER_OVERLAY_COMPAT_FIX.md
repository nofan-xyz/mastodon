# 发帖菜单、确认按钮与表情浮层兼容修复

## 反馈与复现

2026-10-27 用户反馈 Windows Edge / Chrome 下发帖菜单仅改变按钮颜色、语言菜单使编辑区内容上移、确认按钮悬停后消失，以及表情面板下半部分被遮挡。用户尚未提供具体浏览器版本；不能仅根据浏览器名称认定其内核为最新版。

在独立本地数据库 `mastodon_5_adaptation` 中，用实际 Chromium 109.0.5414.46 复现了同类缺陷。当前 Chromium 和 Windows Edge 对原发布镜像的基础菜单检查正常。未修改生产用户的帖子、资料或偏好。

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
- 生产构建产物及 Windows Edge 的最终矩阵、上线结果随后记录。本次不是全站旧浏览器兼容认证。

可复测脚本 `deploy/shared/verify_composer_ui.cjs` 仅允许本机地址，并拦截非本机 HTTP 请求。使用独立预览的登录 storageState；凭据文件不提交，不打印 Cookie 或令牌。示例：

```sh
UI_BASE_URL=http://localhost:3107 \
UI_AUTH_STATE=tmp/preview-auth.json \
UI_BROWSER_LABEL=current \
UI_BROWSER_PATH=/path/to/chrome \
node deploy/shared/verify_composer_ui.cjs
```

每个浏览器检查 12 个组合，包含菜单在视口内且能接收指针、编辑器位置与内部滚动不变、表情行实际可点、新旧发布按钮悬停后保持可见。脚本只在独立预览账号上保存主题和编辑未发布草稿，不发帖。