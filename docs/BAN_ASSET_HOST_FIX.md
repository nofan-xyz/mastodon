# ban.fan 静态资源跨域回归

2026-10-26 共享数据发布时，部署生成器为 4.7 Web 新增 CDN_HOST=https://nofan.xyz。ban.fan 继续使用原有反代，但页面中的脚本和 CSS 因此转为跨域绝对地址。ES 模块与带 crossorigin 的样式请求受 CORS 校验；nofan.xyz 静态响应没有允许 ban.fan 的响应头，导致浏览器阻止整个前端资源图。

恢复方案：仅将 4.7 Web 的 CDN_HOST 显式设为空，覆盖任何旧环境值，使静态资源回到 /packs/... 相对地址。ban.fan 加载 ban.fan 的资源，nofan.xyz 加载 nofan.xyz 的资源；beta 的独立资源地址保持不变。未放宽 CORS/CSP，未修改 canonical 身份、数据库或媒体配置。

19:59 旧 Web 重建并健康，原 Compose 备份至当前发布计划的 before-ban-assets-compose.override.yml。同步修正 prepare_production.py，fix_ban_assets.py 保留本次修复操作。以后回退 Compose 时需保留 CDN_HOST 为空，避免恢复带问题的旧配置。

Windows Edge 使用全新上下文验证三个域名登录页：密码框可见，收到的 /packs/ 样式和脚本无 4xx/5xx、无跨域资源地址、无资源请求失败；ban.fan 本次加载 32 个资源。Cloudflare 统计 beacon 仍被 CSP 阻止，与此次应用资源 CORS 问题不同。ban.fan 页面可见，但等待 DOMContentLoaded 一度超时，不能把它描述为浏览器控制台完全无错误或已验证真实账号登录全过程。
