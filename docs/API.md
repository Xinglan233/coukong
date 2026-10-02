# API 合同

基础路径 `/api/v1`。成功 `{data: ...}`；失败 `{error:{code,message,fields?}}`，fields 是 `{path,message}` 数组。所有凭据通过 `Authorization: Bearer`，不能放 query。CORS 仅精确允许配置的 origin；私密响应 `private, no-store`。

| 方法与资源 | 权限/行为 |
| --- | --- |
| GET /health | 进程与 BUILD_VERSION，不代表 DB 就绪 |
| GET /ready | 实际 D1 查询，失败返回服务不可用 |
| POST /groups | 创建码、operationId、managerToken、inviteToken、eventPackage |
| GET /groups/:groupId | 本队 invite/member/manager，GroupDTO |
| PATCH /groups/:groupId | manager，expectedRevision 与 status（open/closed/archived） |
| POST /groups/:groupId/join | invite，operationId、memberToken、name |
| GET /groups/:groupId/members | 本队读取，MemberSummary 列表 |
| GET /groups/:groupId/members/:memberId/response | 仅该成员完整私人回复 |
| PUT /groups/:groupId/members/:memberId/response | 仅本人，operationId、expectedRevision、scheduleRevision、response |
| GET /groups/:groupId/availability | 安全 availability 投影、状态、版本/更新时间 |
| DELETE /groups/:groupId/members/:memberId | 本人或 manager，撤销权限 |
| POST /groups/:groupId/event-import/preview | manager，raw 或 eventPackage，预览无写入 |
| POST /groups/:groupId/event-import/commit | manager，operationId、expectedRevision、raw 或 eventPackage |
| GET /groups/:groupId/event-export | 本队读取，标准活动包，无成员或 token |
| POST /groups/:groupId/invite/rotate | manager，operationId、inviteToken、expectedRevision，旧邀请失效 |
| DELETE /groups/:groupId | manager，{confirm:groupId,expectedRevision}，CAS删除 |
| GET /templates | 每个模板只取最新版本，再筛选已发布状态并去重；最多 50 条，不列私人小队 |
| POST /admin/session | rootSecret、客户端高熵 sessionToken，1 小时会话 |
| DELETE /admin/session | 当前管理员会话，撤销 |
| GET /admin/templates | 管理会话，每个模板的最新版本列表；历史内容保留 |
| POST /admin/templates | 管理会话，eventPackage/raw、expectedRevision、published，新不可变内容版本并切换最新公开状态 |
| PATCH /admin/templates/:id/:revision | 管理会话，published 发布/下架 |
| GET /admin/audit | 管理会话，最近100条脱敏操作，不含凭据/私密正文 |
| GET /admin/groups | 管理会话，必要元数据，不含私人回复 |
| PATCH /admin/groups/:groupId | 管理会话，closed/archived 停用 |
| POST /admin/creation-invites | 管理会话，客户端随机token、operationId、公开eventId、可选ttlHours；单次建队码 |
| GET /admin/creation-invites | 管理会话，安全状态列表，可按eventId筛选，limit/offset分页，不含码和哈希 |
| DELETE /admin/creation-invites/:id | 管理会话，operationId、expectedRevision；撤销未使用码 |

单次建队文字码属于待生产发布增量；V18候选界面已接入真实接口并在隔离预发布验证，不能将候选成功当生产上线。码默认24小时、固定一队、绑定一个已发布公开活动；通过原 `POST /groups` 的 `creationCode` 字段提交。数据库仅保存哈希；客户端在请求前生成并暂存码和操作ID，服务端不会重放码明文。完整接入与边界见仓库 `handoff/CREATION_INVITE_CONTRACT.md`。原站点创建码及私人活动创建保持兼容。

## DTO 与提交

共享合同为 [types.ts](../shared/types.ts)。ParticipantResponse 包含 name、presence（每日 intervals）、busy（id/date/start/end/title/source 及可选 location/note/sessionId）、bufferMinutes。成员第一次 revision 为 0；提交使用当前成员 revision 和小队 scheduleRevision。服务端 UTC 时间不可用页面当前时间代替。

MemberSummary 仅 id/name/status/revision/confirmedScheduleRevision/updatedAt/submittedAt；结果增加安全 availability。发起人不能调用他人私人回复接口。GroupDTO 是小队及 EventPackage 快照；event.id 是外部资料标识，不是权限依据。

操作 ID 要在请求前持久保存，并以同内容/同主体重试；不能凭 operationId 获取秘密。相同操作 ID 不同内容拒绝。CAS 失败 409，保留草稿；从属写入也必须以同 CAS 成功条件约束。时间配置变化返回复核冲突，不覆盖新配置。

错误码包括 INVALID_EVENT_PACKAGE、INVALID_TIME_RANGE、UNSUPPORTED_TIMEZONE_DATE、VERSION_CONFLICT、RECONFIRM_REQUIRED、INVALID_CAPABILITY、FORBIDDEN、GROUP_CLOSED、LIMIT_EXCEEDED、SERVICE_UNAVAILABLE。校验错误含中文字段路径，不回显 SQL/凭据。创建/无效认证按来源限制，合法成员写操作按主体限制；同 Wi-Fi 必须多身份实测。创建20次/分钟/来源、无效队凭据30次/分钟/来源、管理员登录10次/分钟/来源、成员写60次/分钟/主体。具体实现测试见 [测试](TESTING.md)。

当前列表限制不是完整游标分页；若超过单次返回上限需要补分页，不宣传无限模板列表。API 路由和前端入口均须经 [发布检查](RELEASE_CHECKLIST.md) 验收。

## 个人计划与公开限额（本轮分支，云端待验）

`GET /api/v1/limits` 无需私密凭据，返回共享 `ACTIVITY_LIMITS` 的真实配置。个人创建为 `POST /api/v1/events/:eventId/personal`；本人 Bearer 凭据用于 `GET/PUT/DELETE /api/v1/events/:eventId/personal/:id`。PUT 同时检查 `expectedRevision`、`scheduleRevision`、`spatialRevision`，带预先保存的 `operationId`，不会以活动 ID 授予个人权限。

个人 `plan` 的 JSON UTF-8 上限为1536KiB。全部访客记录共用128MiB应用逻辑预算，按UTF-8数据和每记录1KiB保守元数据计量；这不是D1物理占用或剩余免费容量保证。每人最多64条幂等回执，保留24小时；回执仅保留摘要、版本和时间等紧凑元数据，不保留私人计划历史副本。

| 状态与错误码 | 客户端处理 |
| --- | --- |
| 409 OPERATION_SUPERSEDED | 该提交曾成功，但已被后续修改替代；回读当前计划并比较草稿，不重放旧成功内容 |
| 409 IDEMPOTENCY_EXPIRED | 回执已到期或被清理；回读并核对后创建新操作，不盲目重用旧ID |
| 413 PERSONAL_PLAN_TOO_LARGE | 减少备注或记录，保留本机草稿后重新保存 |
| 507 STORAGE_BUDGET_EXCEEDED | 共享预算已满；保留草稿，稍后重试或删除不用的本人记录，不自动付费 |

相同操作ID携带不同请求内容仍返回409 VERSION_CONFLICT。活动空间版本变化也须核对后重新保存。上述合同由本地代码与测试落实；不能据此宣称新模块已通过云端或现场验收。

## 私人日常活动与个人关联（0007迁移，本地分支）

`POST /private-events` 需创建码、operationId、客户端预先保存的独立ownerToken和personalToken、name、eventPackage/raw；原子建立未公开的通用活动及本人个人记录。返回`{activity,personal}`，两种权限分离，不凭名字认领。私人活动不进入公开列表或管理员公共活动列表，public_revision始终NULL，旧Worker回滚后也不能公开它。

私人`GET /events/:id`及`GET /events/:id/event-export`只允许该活动owner、个人或有效来源小队能力。 `GET /events/:id/owner`为恢复管理入口的只读校验，只允许此私人活动的owner，返回同一ActivityDTO；个人、小队或公开活动访问能力不能通过此校验。恢复链接只有认证成功后才替换本机原入口，失败保留原记录。`PATCH /events/:id`仅owner，带expectedRevision、operationId和完整活动包，时间变化保留个人旧计划并要求复核；旧小队快照不变。私人活动仍受创建保护、限流及共享128MiB预算，不能公开地图扩展。

从私人活动建队时，`POST /groups`另带sourceEventId、sourceEventRevision与sourceEventToken；服务端验证真实来源权限。来源能力只用于该请求，不写URL，返回GroupDTO含sourceVisibility。公开来源活动仍由管理员维护；私人队长编辑本队快照不会改原私人活动。

`POST /events/:eventId/personal/:id/link`需本人Bearer及memberId/memberToken；同时证明个人和本队员身份，且小队必须同活动。GET `.../links`只列本人关系；DELETE `.../links`带memberId取消本人关系。关联不共享收藏或路线，不提交任何回复。UI“同步本人计划到此小队”只在用户确认后替换本队本机草稿；仍需另点“提交”，可以逐队操作。

0007目前仅隔离本地D1应用，新云端迁移和最新前后端完整链路尚未执行，不把本节当上线声明。
