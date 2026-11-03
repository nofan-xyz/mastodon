# 旧 beta 页面通知弹窗加载失败

2026-10-29 用户截图仍为 8c3aaaf494 页面，出现 bundle_modal_error。不是通知 API 的错误提示，也不能单凭此图判断关注请求未送达。

从旧镜像 66c5c31c… 的 Vite manifest 递归核对关注请求和通知设置模块的72个依赖，确认五个文件404：ImmutablePropTypes-BP3mfoh_.js、follow_requests-CtW-4uYe.js、hooks-BljM5mIv.js、policy_controls-DNYv_QvN.js、setting_toggle-Br0GCJj3.js。模块入口本身200不能代表可加载，验证需覆盖整个静态依赖图。

已从固定旧镜像恢复不可变资源至 /var/www/nofan-beta-asset-history/packs，beta nginx仅为 /packs/ 增加历史资源查找，未命中仍回源当前3106。不改变当前应用、数据库、账号、通知偏好、正式站或 ban.fan。nginx -t通过并平滑reload，修复后原72文件全部200且类型正确，三入口健康/版本/登录页本站JS/CSS/sw.js通过。尚未在用户登录态实际点击弹窗，不把资源回读当作浏览器交互验收。

首次备份 /home/mastodon/shared-rollout/20261029T040929Z-legacy-assets/before-nginx.conf。回退时恢复该文件到 /etc/nginx/conf.d/nofan-beta.conf，nginx -t 后平滑reload；历史文件可保留，不需回退应用/数据库。

新增 retain_beta_assets.py --image <固定digest>；更新前保存当前beta资源，再替换应用。update_application_release.py和update_compose_interactions.py已加前置步骤，缺脚本或资源冲突直接停止发布。部署时需将helper放在更新脚本同目录。保留原hashed文件，不覆盖同名内容不同的运行时资源；不归档 .vite 清单或 sourcemap，后者可能同名但随构建源路径变化。本次将旧版和当前版均纳入保留，脚本在已有nginx规则下重复运行不会重复插入规则。暂不自动清理历史资源，后续按保留周期单独处理。

原先发现的关注请求数量只初始化、断线轮询不补刷问题仍待受影响账号与刷新结果确认，本次没有擅自修改普通通知过滤偏好或声称所有关注提示问题都解决。请用户刷新至8fbd95dfcf后复查 /follow_requests 与通知页。
