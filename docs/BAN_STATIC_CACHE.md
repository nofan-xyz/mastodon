# ban.fan 静态缓存与零采购线路对照

2026-10-26 用户要求：预算有限，先做静态资源缓存并寻找可对照线路，有实际测速证据再决定迁移。本轮未购买任何实例、CDN 或付费监控，没有迁移站点。

## 已上线缓存

服务器 43.135.112.37，nginx 1.24。源文件在 deploy/banfan/。全局配置 /etc/nginx/conf.d/00-banfan-static-cache.conf，站点 snippet /etc/nginx/snippets/banfan-static-cache.conf。原 443 与临时 8443 均引用该 snippet；8443 到期关闭不影响 443 的缓存。

只缓存 /packs/ 内带构建哈希的 js/css/woff/woff2/ttf/otf/wasm，GET/HEAD，成功状态 200。公共资源回源去除 Cookie 和 Authorization，缓存键保留 URI 与查询串。遵守源站 Cache-Control、Vary、Set-Cookie、private/no-store；不强制忽略这些响应头。启用并发填充锁、再验证与源站故障时的旧文件回退。缓存磁盘上限 2GB、索引 16MB、不活跃 30 天回收。剩余磁盘约 41GB，本次缓存占用约 2.9MB。

登录页、API、个人数据、媒体、/sw.js 和 source map 不匹配此 location。日志 /var/log/nginx/ban.fan.static-cache.log，响应头 X-BanFan-Static-Cache 标示 MISS/HIT；不记录凭据或查询串。

部署前备份 /var/backups/banfan/20261026T132744Z-static-cache，manifest.json 记录原配置文件映射。回退命令（服务器上以 root 执行）：

    python3 /var/backups/banfan/20261026T132744Z-static-cache/rollback.py

它恢复仍存在的原站点配置、删除两个缓存配置文件，nginx -t 通过后重载；若临时 8443 已到期移除，不会重建它。不会递归删除缓存目录或修改其他站点。首次部署曾因 conf.d 加载顺序导致 log_format 未定义，nginx -t 阻止上线并自动恢复；修正为 00- 前缀后测试和重载通过。

## 验证与效果

- 同一公共 JS 的首次请求 MISS、第二次 HIT，携带非敏感模拟 Cookie/Authorization 的请求也命中公共资源，解压后的内容 SHA256 与源站一致。
- /auth/sign_in、/api/v2/instance、/sw.js、source map 均无缓存状态头；不存在的 hashed JS 连续两次 MISS，不缓存错误页。
- 预热 187 个实际首屏相关资源，全部成功。外部浏览器真实收到 190–195 次本地 HIT。
- 同一测试电脑、全新 Edge 上下文，默认协议：443/h2 冷启动约 108 秒、再次访问约 23 秒；8443/http1.1 冷启动约 38 秒、再次访问约 9 秒。此前相近测试为 443 约 107 秒、8443 约 48 秒，不能据此宣称缓存显著提升了 443 的首屏速度。
- h2 冷启动中部分模块请求出现 ERR_HTTP2_PROTOCOL_ERROR，页面最终渲染；nginx 错误日志未出现本次新的服务端错误。http1.1 未见应用资源网络错误。未登录公开时间线仍可能返回既有 422，需要登录的接口不属于缓存范围。
- 缓存 HIT 记录中 upstream_time 为 -，但若干文件 request_time 仍达 30–50 秒，说明即使不回源，客户端连接/传输仍慢。缓存减少源站请求，不代表线路问题已解决。

时间使用每 5 秒检查页面正文渲染的近似值，不是精确 FCP，受网络波动影响。没有使用真实用户密码验证登录或执行用户数据写入。

## 免费线路候选与初测

来源：xTom 官方 https://xtom.com/looking-glass/，DMIT 官方 LG https://lg.dmit.sh/?server=lax-pro。候选是免费测试节点，不是已购买实例；xTom LG 不能等同于 SaltyFish 某款套餐的全部实际路由。

| 测试节点 | 官网当次显示 IPv4 | 当前电脑直连 ICMP 5 包 | 备注 |
| --- | --- | --- | --- |
| 现有 ban.fan | 43.135.112.37 | 4/5 返回，均值 230ms | 一次超时，样本不足以认定长期丢包率 |
| xTom Amsterdam Premium | 78.142.195.215 | 5/5 返回，均值 153ms | https://ams-premium.lg.xtom.com/ |
| xTom Frankfurt Premium | 45.80.188.66 | 5/5 返回，均值 147ms | https://fra-premium.lg.xtom.com/ |
| DMIT Los Angeles Pro | 179.255.100.100 | 5/5 返回，均值 132ms | https://lg.dmit.sh/?server=lax-pro |

Windows curl --noproxy '*' 初步 TLS/HTTP 探测：xTom 两个 IPv4 LG 返回 403（约 0.7 秒），DMIT LG 控制页返回 200（约 1 秒）。HTTP 控制页的结果不能当作下载速度，也不能证明带宽或实际套餐可用性。浏览器正常代理路径访问 LG 时出口不同，不能用该路径的速度充当大陆直连证据。下载测速遇到人机验证，未绕过验证，未获得可信下载吞吐或实际应用首屏对照。

后续无需先买机器：让受影响用户在各自电信、联通、移动网络下，用官方免费节点直连测晚高峰的小文件、下载及丢包；取得结果后再决定是否有必要采购。当前保持现有服务器和域名。

临时 HTTP/1.1 测试入口仍按既有 timer 于北京时间 2026-10-26 22:27:19 自动关闭；云安全组 8443 规则需用户在控制台另行删除。
