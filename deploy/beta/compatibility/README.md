# 4.7 / 5.0 只读兼容性复核

这些工具用于核对已有基础适配，不会将 beta 接入正式数据库，也不是双版本共库上线验收。

- `audit-production.py`：读取正式镜像来源与工作目录，用 `BEGIN READ ONLY` 查询迁移、密钥覆盖和新表状态，只输出计数及源码文件摘要，不输出密钥、密码或账号标识。适用于当前 4.7 正式站基线。
- `probe_legacy_on_snapshot.rb`：必须运行于 `mastodon_beta` 且开启 `NOFAN_SNAPSHOT_MODE`。在只读事务中检查用户、密钥、TOTP 和旧模型查询，事务结束后回滚。新账号密钥生成只在未保存的模型上调用，绝不创建账号或重新生成已有账号密钥。
- `run-legacy-probe.py`：在服务器启动临时容器，使用正式站当前镜像 ID、beta 环境文件、beta 内部网络和快照隔离 initializer。正式站容器及数据库不参与测试运行。退出后容器删除。

复现时先把 Ruby 探针复制到服务器 `/tmp/probe-47-on-50-snapshot.rb`，再运行 `run-legacy-probe.py`。不应把正式站数据库连接串或正式媒体桶写入测试环境。快照隔离 initializer 自带域名、数据库名和 beta 桶断言。

2026-10-26 的诊断结果：账号与已有加密数据可读，未知偏好键的序列化保留正确；旧版在删掉旧密钥列的 schema 上生成新账号密钥时报 `NameError`，FASP 能力查询报 `PG::UndefinedColumn`，新偏好访问报 `UserSettings::KeyError`，且没有两个新增 worker。报告这些预期的不兼容点时，诊断程序正常退出；这不代表共库写入检查通过。

后续应在单独演练环境验证兼容迁移、旧 Web 与新 Web 的双向写入、统一 5.0 消费者、设置缓存失效、身份验证和回退。不要对正在供用户试用的 beta 副本随意写入演练账号或修改其 schema。
