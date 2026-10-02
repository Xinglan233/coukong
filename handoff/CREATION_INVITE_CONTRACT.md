# 单次建队文字码接入合同

本文件描述新增后端及待接入界面的准确约定。界面按指定Figma V18接入真实API；本地、预发布与生产验收分别记录，不互相替代。

## 需求与边界

- 码是长文字 token，不是短数字、二维码或默认链接。使用已有 `newToken()` 生成32个随机字节，编码为64个小写十六进制字符。
- 管理员为**一个已发布的公开活动**生成码。默认24小时，允许1–168整数小时；固定只能创建一队。
- 不把省略活动当成任意活动权限，不提供全站无限建队码。
- 新码不能管理小队、加入小队、读取私人日程、创建私人活动或登录后台。成员仍使用原小队邀请。
- 原站点创建码仅作应急兼容，现有私人活动及其合法访问者建队流程保留。没有将新码扩为私人活动权限。
- 生产未签发实际码、未应用新迁移。界面复用真实导出的Figma V18源文件，不带入原型假响应。

## API

基础路径 `/api/v1`；成功 `{data:...}`，失败沿用 `{error:{code,message}}`。

### POST /admin/creation-invites

使用已登录管理员会话 Bearer。请求字段：

```ts
{token: string, operationId: string, eventId: string, ttlHours?: number}
```

客户端在请求**之前**生成并妥善暂存 token 和 operationId，首次响应丢失时用完全相同请求重试。服务端仅保存哈希，**响应不会返回 token**；复制按钮使用本次客户端生成的值。重新读列表无法找回明文，应撤销后重新生成。不要使用管理员密码、管理恢复码、个人恢复码或邀请 token 代替生成的新码。

同管理员会话+operationId+同内容重试返回同记录；同操作改内容409。超过每会话30次/分钟返回429；无效生成请求也计数。全库最多100个未使用、未撤销、未过期的码，历史最多10000条，达到后明确拒绝，不默默扩容或清除消费记录。

响应类型见 [共享合同](../shared/creation-invites.ts)：`id/eventId/eventTitle/maxUses/usedCount/status/createdAt/expiresAt/usedGroupId/revision`。不含哈希或原始码。状态为 `available/used/revoked/expired`。

### GET /admin/creation-invites

仅管理员。返回安全元数据数组；`?limit=50&offset=0`，limit范围1–100，offset范围0–10000。默认50条按生成时间倒序；可用 `eventId` 按当前活动筛选，界面读取本活动最近100条。

### DELETE /admin/creation-invites/:id

仅管理员，请求 `{operationId,expectedRevision}`。未使用码可撤销；并发消费与撤销只有一个成功。已使用返回409，已经存在的小队不受影响。相同撤销请求可安全重试，改内容409。响应为更新后的安全元数据。

### POST /groups

沿用已有字段 `creationCode`，填上长文字码，另带 `sourceEventId`（绑定活动）、`sourceEventRevision`（页面版本）、`managerToken/inviteToken/operationId/title?`。不需要新的URL或分享协议。

活动版本错误409；码错误、活动不符、已撤销、过期或已用403。已用、撤销、过期分别返回 `CREATION_INVITE_USED/CREATION_INVITE_REVOKED/CREATION_INVITE_EXPIRED`，错误码持有者不能借此获取管理权限。失败保留输入、草稿及操作材料，不显示成功。成功消耗一次；用同管理token、同operationId和完全相同请求重试只回读原小队，即使码随后过期，也不会多建队。operationId本身不能读取或找回凭据。

同一INSERT的数据库触发器完成消费；消费异常会使整条SQL回滚。不存在CAS零行后继续无条件写入或JS抛错试图撤销已提交数据。删除小队不恢复码的可用状态。

## 部署门禁

- 新增迁移 [0008_creation_invites.sql](../worker/migrations/0008_creation_invites.sql)，旧迁移未修改。
- 新后端 `/ready` 实际读取码表；缺迁移不能显示就绪。
- 先备份再应用到隔离测试环境，核对迁移与源码版本。生产迁移、发布、真实码签发尚未执行，需走当前发布门禁。
- 灰度回滚代码保留新增表/列，不执行DROP或回退数据迁移。原站点码仍可在允许的环境维持应急兼容。
- token不放日志、Git、截图、URL查询参数、公开交接包或聊天；列表不展示数据库内部哈希。

隔离本地D1已验证：SQL导出经现有 `scripts/prepare-d1-restore.py` 准备后，以有界语句事务恢复到空库，外键、码状态及访客预算一致；已消费码仍不能再建队，原请求可安全回读，尚可用码的消费触发器正常。此证据不代表本轮0008已经云迁移或云恢复。

## 界面与验收范围

管理员生成/复制/状态/撤销与队长粘贴创建，按V18内联表单和Sheet接真实API；请求前保存幂等材料，复制/分享失败不会假报成功，离开pending创建页不会被晚到响应拉回。浏览器、云端和真实设备的结果须按实际提交记录。创建成功不自动复制管理恢复码；小队邀请与建队码是两个独立权限。

界面源依据：`handoff/references/figma-team-v18/src/`保留未改官方导出。实现仅修正源稿类型语法、窄屏输入收缩、确认标题及与真实权限不符的示例文案；邀请码没有虚构有效期或队长审批步骤。复制明文只使用当前生成值，成功后删除本机待签发材料，历史列表无法恢复明文。
