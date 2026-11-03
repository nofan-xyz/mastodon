# 登录后媒体加载失败：Service Worker 缓存修复

2026-10-26，beta 从独立快照切到正式共库后，用户反馈：登录后头像、表情、站点标志等全部不显示，强制刷新后恢复。

## 原因与复现

公网 `/sw.js` 命中 Cloudflare 旧缓存，响应为 `public, max-age=604800`，携带旧 Content-Security-Policy：connect-src 没有媒体域名。当前登录页和源站新 Worker 响应均已允许 `https://media.nofan.xyz/nofan-box/`，因此两者并非同一个策略。

Service Worker 会拦截所有图片，再通过 fetch 请求；此时请求受 Worker 自己的 connect-src 约束，即使页面允许该图片也会失败。真实 Chromium 访问 beta：同一媒体表情在 Worker 接管前加载成功、接管后失败、用浏览器强制刷新等价的 Worker 绕过并重新导航后再次成功。头像组件遇错会移除 img 并保留占位，故网络恢复后不会自行出现。

问题不在图片文件缺失或需要重新同步媒体。先前的单纯 URL/HTTP 检查无法覆盖 Worker 中的浏览器安全策略。

## 修复

- Worker 脚本 URL 加入当前发布版本，绕过已存在的固定 URL CDN 缓存；注册使用 updateViaCache=none。
- 新 Worker 安装后立即接管，应用在挂载头像和媒体前等待替换激活，避免第一次登录就被旧 Worker 拦截；安装失败或超时不会无限阻塞 UI。
- 跨域媒体由浏览器按页面策略正常请求，不再交给 Worker fetch。保留原生 HTTP 缓存及同源资源的 Worker 缓存，没有放宽 CSP。
- Worker 不再把错误响应当作成功资源缓存，也不再直接使用旧的错误缓存。
- Rails 静态服务及两域名 nginx 的 `/sw.js` 均返回 no-store；其他带内容 hash 的资源仍保持原缓存策略。

## 验证

17 项 Worker 缓存/更新专项前端测试、3 项静态文件请求测试、TypeScript、ESLint、RuboCop 和生产前端构建通过。实际构建 Worker 在隔离 HTTPS 浏览器中验证：复现旧 Worker 阻断、旧受控标签页中自动激活替换、替换后跨域图片恢复、三轮登录页/主页导航无需刷新。该三轮是页面导航验证，没有使用正式用户密码登录。

16:40 已部署源码 e89c5c38dc9b67b03f0a12f2f16ecb1b6099087e，镜像 sha256:e736342d74cd43d3409a81d160f7b284c8d68c88b764072bd5cbabe8a60f3c61。公网验收通过：在同一真实 beta 浏览器中，旧 Worker 接管后图片失败，新版按版本注册的 Worker 自动替换后图片成功，随后三次普通刷新均成功，无需 Worker 绕过。新 Worker 响应 no-store，Cloudflare 为 BYPASS。新开页面、普通刷新或重新登录加载新版即可，不要求每次强制刷新；已打开的旧页面尚未加载新脚本前，仍可能继续使用旧 Worker。
