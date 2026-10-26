# 深色主题原生下拉菜单可读性修复

反馈：外观设置的“风味与皮肤”展开后，深色、青蓝、黄绿等模式出现浅字浅底，部分选项和分组标题无法辨认。

共用 forms.scss 的 select 使用半透明 --color-bg-secondary，原生 popup 在 Windows 下可能把它叠到浅色底上；option 与 optgroup 又沿用浅色文字。4.7 旧 Bird UI 曾有不透明表面补丁，但 5.0 已重写其 UI 层，且 5.0 的 --color-bg-overlay 始终是黑色遮罩，不能直接复用旧变量。

本次仅修改共用 select 样式：选择框、option、optgroup 使用不透明且与正文颜色配对的 --color-bg-primary，文字仍为 --color-text-primary。保留原生 select、分组、键盘和保存流程，没有替换组件，不改宽度、41px 高度、边框、圆角或内边距；语言、时区等同类表单也受益。

验证：Stylelint、git diff --check 与完整生产前端构建通过。用 Windows Edge 156.0.4314.42 加载实际编译的 12 款皮肤 CSS，检查浅/深 × 五主题色 × 普通/高对比度，共 240 组合：选择框、分组和选项背景均不透明，文字对比度 >=4.5:1，选择框保持 41px，原生选择操作正常。深色黄绿和青蓝的展开选项渲染已目视检查。验证使用独立表单夹具与实际 CSS，不修改正式用户设置。

修复源码：d308aed813。镜像构建：[40299087103](https://github.com/nofan-xyz/mastodon/actions/runs/40299087103)。正式部署状态以 SHARED_DEPLOY.md 为准。
