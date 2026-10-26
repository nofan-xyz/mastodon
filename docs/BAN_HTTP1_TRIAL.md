# ban.fan HTTP/1.1 独立端口对照

2026-10-26 用户授权以独立端口验证 HTTP/1.1。nginx 1.24 的旧 listen http2 参数由共用监听套接字决定，443 同时承载 ban.fan、stats.ban.fan 和 jiangxin-e-chain.nofan.xyz；仅删除 ban.fan 的 http2 参数并不生效。首次尝试已完整回退，原 ban.fan 配置 SHA256 为 91d76c1d95cbaae9d29220c8c2a6810148f6639bfaee56c3d77f94dbdf67c438，与备份一致。

测试入口 https://ban.fan:8443/public/local，配置 /etc/nginx/conf.d/banfan-http1-trial.conf。复制原有 TLS、反代与 WebSocket 配置，仅调整监听端口、X-Forwarded-Host 的端口及重定向目标。仍使用原站服务及真实数据。没有修改原 443、账号、数据库或其他站点。

原配置与试验配置备份目录 /var/backups/banfan/20261026T122630Z-port8443-trial；回退脚本为该目录下 rollback.sh，移除试验配置并重载 nginx，随后删除本次添加的 UFW TCP 8443 放行规则。systemd 的 banfan-http1-trial-cleanup.timer 定于北京时间 2026-10-26 22:27:19 执行回退。云端安全组由用户另行临时放行，回退脚本没有云控制台权限，不能代删云端规则。

验证：nginx -t 通过；ALPN 显示 8443 为 http/1.1、原 443 为 h2。云安全组放行后，从外部服务器请求登录页返回 HTTP/1.1 200。全新 Windows Edge 使用默认协议配置：8443 首次公开页面渲染约 48 秒，再打开约 8 秒，资源协议均为 http/1.1。登录页密码框可见、实例 API 返回 200、canonical domain 仍为 nofan.xyz；无页面 JavaScript 异常、无应用资源 HTTP 错误、无跨域 packs 地址。Cloudflare 统计 beacon 仍被既有 CSP 拦截。没有使用真实用户密码验证登录、发帖或认证 WebSocket。

对照使用每 5 秒检测正文渲染的方式，数字是近似时间，不是精确的 First Contentful Paint。不同端口、连接和测试时间可能受线路波动影响；结果支持继续观察，不能单凭此认定 nginx HTTP/2 有实现缺陷。

随后同机新上下文复测原 443，默认 h2 的首次页面渲染约 107 秒；本轮 8443 的 HTTP/1.1 约 48 秒。保留独立端口供用户继续对照，不据此切换其他站点协议。
