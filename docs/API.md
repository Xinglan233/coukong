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

## DTO 与提交

共享合同为 [types.ts](../shared/types.ts)。ParticipantResponse 包含 name、presence（每日 intervals）、busy（id/date/start/end/title/source 及可选 location/note/sessionId）、bufferMinutes。成员第一次 revision 为 0；提交使用当前成员 revision 和小队 scheduleRevision。服务端 UTC 时间不可用页面当前时间代替。

MemberSummary 仅 id/name/status/revision/confirmedScheduleRevision/updatedAt/submittedAt；结果增加安全 availability。发起人不能调用他人私人回复接口。GroupDTO 是小队及 EventPackage 快照；event.id 是外部资料标识，不是权限依据。

操作 ID 要在请求前持久保存，并以同内容/同主体重试；不能凭 operationId 获取秘密。相同操作 ID 不同内容拒绝。CAS 失败 409，保留草稿；从属写入也必须以同 CAS 成功条件约束。时间配置变化返回复核冲突，不覆盖新配置。

错误码包括 INVALID_EVENT_PACKAGE、INVALID_TIME_RANGE、UNSUPPORTED_TIMEZONE_DATE、VERSION_CONFLICT、RECONFIRM_REQUIRED、INVALID_CAPABILITY、FORBIDDEN、GROUP_CLOSED、LIMIT_EXCEEDED、SERVICE_UNAVAILABLE。校验错误含中文字段路径，不回显 SQL/凭据。创建/无效认证按来源限制，合法成员写操作按主体限制；同 Wi-Fi 必须多身份实测。创建20次/分钟/来源、无效队凭据30次/分钟/来源、管理员登录10次/分钟/来源、成员写60次/分钟/主体。具体实现测试见 [测试](TESTING.md)。

当前列表限制不是完整游标分页；若超过单次返回上限需要补分页，不宣传无限模板列表。API 路由和前端入口均须经 [发布检查](RELEASE_CHECKLIST.md) 验收。
