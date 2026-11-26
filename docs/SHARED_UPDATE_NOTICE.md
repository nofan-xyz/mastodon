# 正式站显示 alpha.2 紧急更新的原因与处理

2026-10-30核对：正式Web仍为4.7.4.0+shared47-a6004bb2ea，beta和后台仍为5.0.0.0-alpha.2+beta-bdbb820c40，实际升级没有回退。software_updates表只有一条version=5.0.0-alpha.2、urgent=true、type=patch的记录。4.7 SoftwareUpdate.pending?按当前4.7.4.0比较，结果true；5.0同一条记录则pending=false、outdated=true。主站首页critical_updates_pending、后台菜单和更新列表均从同一张表判断，因此将旧beta提醒显示成主站紧急补丁。

由5.0 Sidekiq执行的更新检查每30分钟一次，升级重启后不是立即刷新提示。清理旧记录前，官方update-check接口对4.7.4、4.7.4.0、5.0.0-alpha.2、5.0.0.0-alpha.2均返回updatesAvailable=[]，没有当前真实待更新条目；因此本条故障确认是遗留记录+跨版本共表展示，不将四段版本上报格式推测为本次触发原因。

本次先将该条元数据备份到/home/mastodon/shared-rollout/20261029T161111Z-update-notice-cleanup/before.json，再在事务中仅删除与beta实际规范版本完全相同的5.0.0-alpha.2记录。执行前保护：正式数据库名、NOFAN_SHARED_DATA=true、实际运行规范版本等于指定版本、最多一条且outdated?为true。after.json记录removed=1、pending=[]、urgent_pending=false、check_enabled=true。没有清空整个表，没有改紧急标记，没有关安全更新检查或触发管理员邮件，没有改账号/内容/媒体数据。已经打开的旧页面仍需刷新才能重载提示状态。

升级验收应额外检查两版SoftwareUpdate.pending_to_a和urgent_pending?，不仅检查API版本号；如存在刚安装版本的旧记录，先备份，再只清理已确认安装的精确版本，保留未来真实更新。不要直接关闭UPDATE_CHECK_URL、过滤所有5.x更新或在正式4.7中运行5.0更新检查并发送邮件。

后续改造需分别处理正式/测试通道的更新结果、清理和版本比较。目前软件更新表仍未按通道隔离，本次只是清理已安装版本的遗留条目，不能宣称已完成双版本更新机制的长期适配。四段自定义版本参与预发行比较也需要单独回归，不能只改一个可视化提示。
