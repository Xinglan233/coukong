# 同野·游完整交接

这是可转交给下一位执行者的接手说明。当前为**功能开发中的检查点交接**，来源基线为 `8599bd190529d3ac7e952bf32f6a444aaa9cdf28`；本轮增量与证据在第10节列明。当前源码以本文件所在提交的 `git rev-parse HEAD` 为准，不据此宣称已上线。需求原文、版本和测试范围分别列明，不要求用户重新讲一遍。

## 1. 先读什么，什么优先

完整附件入口是 [handoff/README.md](../handoff/README.md)，文件清单和哈希见 [原始需求索引](../handoff/SOURCE_INDEX.md)。先读 [最新决定](../handoff/requirements/latest-decisions.md)，再完整阅读原19文件执行包、700行活动升级和视觉专项，不以本文概要替代原文。

最新决定：**继续补齐功能，后续界面以用户2026-10-01 16:52指定Figma Make（fileKey `HVEkdtjmMHYBIUQ5LT5ynW`）为准，保留其他AI最新界面和用户未提交修改，不自行重设计；禁止使用任何重置卡（已使用0张）；新版未完成验收且未获视觉确认，不发布生产。** 功能开发可继续，不等待审美尝试。用户10月2日晚要朋友实际使用，10月3日为REDLAND场景，时区Asia/Shanghai。

保留同野·游名称、活动优先四入口及既有多人后端。不要新建项目、回退旧凑空、重写鉴权/存储，也不修改同野主站。只参考2dg的公开组织原则，不复制素材或布局。三张原版图只指导灰白青绿、短文案、分组行/Sheet/日切等视觉；图中每日0/5、旧名称、固定日期和朋友分享码机制不得恢复。

## 2. 代码与真实部署

| 项目 | 当前事实 |
| --- | --- |
| 仓库 | https://github.com/Xinglan233/tongye_meet |
| 功能分支 | `feat/activity-maps-personal`，PR #5为draft，不合并发布 |
| 工作目录 | `/tmp/tongye-meet-recovery`；不要回到受阻旧目录覆盖未提交工作 |
| 本轮来源基线 | `8599bd190529d3ac7e952bf32f6a444aaa9cdf28` |
| 当前生产前端 | https://coukong.vercel.app；保留旧origin以保护本机数据 |
| 生产功能/API | `9090be47ed732b5afd5323d20515be1fbb4cb84f` |
| 生产文档前端 | `b29c14a73cacc4d99f248964751e0d4804ba974c`；文档提交不代表新业务上线 |
| 预发布Worker | `tongye-meet-api-staging`，独立D1；运行标识`c265e807-oidc-bound-fetch`，相关修补源码与937对应 |
| 新前端预览 | 正常Vercel登录保护；65a预览READY，8599版本验收单独记录，不复用旧预览证明 |

接手先运行 `git status --short`、`git rev-parse HEAD`、检查当前分支及未提交diff，再查看 [逐项P0状态](ACTIVITY_P0_STATUS.md)。此轮新增私人活动、显式个人/小队关联、路线停留排队和时间判断、活动刷新已有源码与定向测试；仍需整套和云端验收。私人活动管理编辑组件尚未页面接入。不要用初稿覆盖后续工作。main防强推/删除、要求PR和真实verify成功，不绕规则。

`meet.tongye.ink`由用户稍后自行配置，本轮停止DNS/域名操作。无新版生产授权/验收时保持现有站点，不能因换肤覆盖。

## 3. 完成状态与还要做什么

详细矩阵以 [ACTIVITY_P0_STATUS.md](ACTIVITY_P0_STATUS.md) 为准。以下是8599检查点，未将P0缺项降级为P1。

| 能力 | 实际范围 |
| --- | --- |
| 原多人协调 | 管理员/队长/队员、建队邀请、本人填写、共同空闲、成员子集、CAS/幂等、撤销、JSON导入导出、分钟和兼容；原生产已验 |
| 活动优先 | generic/comic_convention、管理员网页表单和JSON、类型/日期状态筛选、搜索、最近活动与最近小队分区；本地已验，新版未生产 |
| 独立个人计划 | 不入队匿名身份、收藏/去过、场次/手动安排、路线、恢复、首次响应丢失与慢保存保护；本地已验，部分实际云端已验 |
| 个人工具 | 缓冲0–120、步长5/10/15/30、严格回导预览到本机草稿、另行在线保存、确认云删除、按活动本机完整清理；本地已验 |
| 地图与媒体 | 私有直传、可信Node图像净化、EXIF清理、资产元数据和引用、OIDC环境隔离、地图显示/标点/路网编辑；真实云PNG上传/读取/新路径恢复已验，最大图与云JPEG/WebP矩阵待验 |
| 地图/地点联动 | 手机地图/列表、仅收藏、共同搜索/选中、公开地点深链接；本地浏览器已验，无私人权限进入链接 |
| 路线 | 固定顺序Dijkstra、人工确认边、单向/关闭/缺路段诚实降级、未知ETA不当0、图像坐标不冒充米；本地已验 |
| 离线 | 一致活动/图数据与所选图片原子保存、版本/更新时间/大小、失败保旧、真实SW离线刷新与草稿/冲突保留；本地已验，真机未验 |
| 数据恢复 | 全量SQL独立云D118表结构/记录回读一致；媒体在staging新活动/新路径业务恢复，独立读图与再次备份一致；不等于原身份迁移或新生产验收 |

本轮已补：未公开日常活动、不入队独立计划、邀请活动上下文、持久个人↔小队关联、逐队显式同步、停留/排队编辑和窗口检查、60秒/隐藏停止/退避刷新；定向浏览器通过，未云部署。仍需补/验：私人活动管理编辑组件挂载并实走、最新完整浏览器、1000点前端/最大媒体与Worker实际CPU性能；同一最新前端+Worker的管理员→队长→队员完整云链路；真机/微信/中国大陆网络和现场离线。正在补的实现须追加失败、边界、权限和数据不丢回归。

完整集合提议可按700行MD允许的公开地点链接明确降级，不能显示假全员确认。GPS、跨图自动路线、自由顺路优化、SSO、自托管新适配、实时位置分享和3D为未实现P1；它们不阻塞P0，不显示可用承诺。

## 4. 不允许UI改写的合同

1. 存储、JSON、手填和算法1分钟；默认快捷15，可切5/10/15/30。`13:07–13:52`不能取整。区间左闭右开，24:00仅结束；跨日缓冲、多段可参与、活动时区及DST门禁保留。
2. 活动`revision`、`scheduleRevision`、`spatialRevision`与个人`revision`分离。更新带expectedRevision及适用双版本。冲突409保留草稿，不覆盖服务器；CAS零行不是SQL错误，从属写入必须有相同成功条件。
3. 按提交快照/编辑generation有条件清草稿。网络前先hydrate本地；刷新/切活动不能覆盖dirty；活动DTO和availability版本不一致不得输出混合结果。未保存Sheet另存草稿，不能产生幽灵记录。
4. 收藏、安排、路线三个独立状态。取消收藏不删日程、加入路线不自动预约，路线重算不改固定场次。共同空闲选中未确认者不能被忽略，空回复不自动全天有空。
5. 管理、邀请、个人、成员、管理员凭据各自作用域分离；高熵能力先本机持久再发创建请求，服务端只留哈希。fragment读取后移除，API Bearer，不把token放query、日志、截图或导出。
6. 普通人/队长只能看到允许的名字、状态、忙闲投影；本人标题、地点、备注、收藏和路线不自动公开。管理员会话不能冒充个人。API校验归属，不能靠隐藏按钮或CSS保密。
7. 操作ID绑定主体/目标，响应丢失安全重试，同ID改内容409。个人回执24小时/64条紧凑元数据，过期/被替代要求回读比较，不盲重放；共享访客逻辑预算128MiB保留管理余量，不无限写历史计划。
8. 地图严格匹配当前manifest哈希/大小/MIME/尺寸及map revision。换图必须升版并校对POI/graph，旧DTO不能获取新底图画旧坐标；在线和离线同样严选身份。
9. 图像左上归一化x/y、宽高比与留白变换统一。地点显式连接人工确认路网，不用最近点穿墙，不把直线称导航。未知时间/位置不能当0或“赶得上”。
10. 源图/衍生图独立存储及元数据，先上传→可信校验→引用发布。数据和媒体不伪装成同一事务；失败保旧，清理仅明确确认的过期未引用失败资产，历史ready引用不擅删。
11. 私人API no-store，不进公开CacheStorage；离线快照和凭据不是加密保险箱、端到端加密或异地备份。退出本机与删除云端不同；删除产品内明确确认，不自动清生产。
12. 旧`coukong`键、分享/备份兼容保留；解压受真实输出/分配上限和可终止Worker约束，全部入口统一。旧朋友只静态快照，不自动冒名成员；没有旧数据不展示迁移负担。

核心代码：[shared/types.ts](../shared/types.ts)、[activity-contract.ts](../shared/activity-contract.ts)、[event-validation.ts](../shared/event-validation.ts)、[routing.ts](../shared/routing.ts)、[Worker](../worker/src/index.ts)、[活动API](../worker/src/activity.ts)、[个人状态](../src/online/activity/personal-state.ts)、[离线](../src/online/activity/offline.ts)、[图片身份](../src/online/activity/map-asset-identity.ts)。

## 5. API、Schema和样例

基础路径`/api/v1`，成功`{data:...}`、失败`{error:{code,message,fields?}}`。完整 [API说明](API.md) 配合当前Worker和共享类型阅读；接口名不能因换肤再造一套。

- `/events`及`/events/:eventId`：公开活动及资源信息；`/admin/events`仅管理员编辑发布。
- `/events/:eventId/personal`创建独立身份，`/personal/:id`本人GET/PUT/DELETE；链接/个人小队关系接口只由真实代码和回归确认，不凭名字认领。
- `/groups`及成员回复、availability、event-import、source-refresh、invite/rotate：小队作用域。公共活动更新不悄悄覆盖本队快照。
- `/api/media/upload`、`finish`、`read`、`cleanup`、`backup`是Vercel可信Node媒体入口；Worker还核验精确OIDC来源和权限。非任意图片代理。
- [Schema v1](../schemas/event-package.v1.schema.json)、[Schema v2](../schemas/event-package.v2.schema.json)；协议kind仍`coukong.event`。严格未知字段、重复键、日期、ID、关联、资产及版本语义，不远程解引用。
- [v1最小](../examples/event-minimal.json)、[v1分钟](../examples/event-demo.json)、[v2通用](../examples/event-generic.v2.json)、[v2虚构漫展](../examples/convention-demo.v2.json)、[真实配套测试PNG](../examples/assets/convention-demo.png)、[REDLAND待核框架](../examples/redland-2026-template.json)。v2示例为虚构，不能发布成真实REDLAND。
- 活动导出不带成员信息/秘密，个人备份另kind且默认无凭据；JSON不包含地图字节，地图文件单独关联，不能宣称JSON带原图。

实装限制见`GET /api/v1/limits`和共享常量：v1包512KiB/v2包1MiB、31天、1000场次/地点、5图、图源12MiB/24MP、显示长边2048及3MiB；图节点2000/边4000、路线100站、个人plan1536KiB。输入限制已存在不等于最高规模CPU/内存/流量已测。

## 6. 从代码运行与测试

使用当前锁文件，Node支持范围`>=22 <27`，实际运行版本应交付时记录，不为最新而升级。没有云凭据也能启动真实本地Worker/D1。

```sh
npm ci
# 按 .env.example 配置本地VITE_API_URL，按worker/.dev.vars.example准备本地测试值
npm run dev:all
npm run verify
TONGYE_E2E_BASE_URL=http://localhost:5175 npm run test:e2e
```

`dev:all`会应用本地迁移并启动Worker8787与Vite；E2E独立本地D1，明确localhost端口，不能复用旧实例误写staging，更不能对生产批量测试。沙箱网络/进程拒绝不绕过，端口冲突先只读诊断，别杀其他项目。

| 对应版本/范围 | 实际证据 |
| --- | --- |
| 生产9090 | 30单元、9组真实D1、11浏览器及三身份生产UI，分钟往返/权限/恢复/375390；不是新活动版本证据 |
| 65a4ec2 | verify通过含86单元/30本地D1；完整36浏览器一次通过；CI verify/CodeQL/Vercel成功 |
| 8599检查点 | verify通过含88单元/30本地D1，类型/lint/docs/build；11浏览回归和2真实SW回归通过；CI verify/CodeQL/Vercel全部成功。基线完整38项37过/1因管理员登录真实限流失败；测试等待修正后图identity单项过，不能加总冒充整套 |
| 云媒体/恢复 | c265前端+修补Worker；真实PNG直传/净化/激活/读图/备份，以及新路径业务恢复；本机937→真实staging两身份分钟链路另列，不称最新Vercel全部云链路 |

真实截图已有`/tmp/tongye-browse-tools-evidence/`（375/390/430浅深）和`/tmp/tongye-visual-comparison-390/`（同尺寸页面）。它们证明实际构建，不证明用户认可视觉或真机/微信/大陆网络。不复制私密日志进本交接附件；允许的脱敏记录、截图可由用户决定提供。

## 7. 部署、免费边界和秘密交付

实际架构：Vite/React+现有Vercel前端；Worker/D1共同云数据；IndexedDB草稿/能力/离线；两个私有Blob加Vercel Node可信图片处理。无需自有服务器；未实现自托管适配不宣传可用。

生产/测试D1、Worker、Blob严格分离。Production仅`tongye-meet-media-production`，Preview/Development仅`tongye-meet-media-staging`。公开前端配置`VITE_API_URL`会入bundle；管理员根秘密、创建保护、长期服务凭据不入`VITE_*`。Node后端配置`ACTIVITY_API_URL`、`BLOB_STORE_ID`，OIDC iss/aud/sub精确项目/环境，不抽登录token、不复制长期Blob凭据到Cloudflare。

接手者请让用户通过平台Secret/环境面板或正常交互CLI安全提供配置，**不要请求发密码到聊天**，本交接不包含其本机私密文件位置。账户既有授权也不自动允许新增权限范围。

Workers Free100000请求/日、10ms CPU/128MB；D1免费500万读行/10万写行日、5GB总/500MB单库、7天TimeTravel；Blob Hobby1GB存储/10GB传输和操作配额，超额可能停用读取。Vercel Hobby个人非商业。应用预算不是平台剩余额度保证；不自动升级、不R2计费。实际来源和核查日见 [运维](OPERATIONS.md)，最高CPU还未证明。

正常维护命令见 [部署](DEPLOYMENT.md)，执行前核实对应环境/完整SHA和备份。旧文档若仍写b801或“媒体恢复未完成”，不能据旧段落推断当前版本；以本交接版本矩阵、逐项P0和实际证据为准，正式转交前需同步这些旧段落。

## 8. 备份、恢复和回滚

备份分类：活动JSON、无凭据个人备份、本机草稿、全量D1 SQL、媒体源/显示图+manifest+历史引用。SQL和权限文件不能提交或放public/dist；本交接不包含它们，也不复制原工具输出。

```sh
umask 077
TONGYE_BACKUP_DIR="/请替换为仓库外受控目录"
mkdir -p "$TONGYE_BACKUP_DIR"
npx wrangler d1 export tongye-meet-staging --remote \
  --config worker/wrangler.staging.jsonc \
  --output "$TONGYE_BACKUP_DIR/staging.sql" \
  > "$TONGYE_BACKUP_DIR/staging-export.log" 2>&1
python3 scripts/prepare-d1-restore.py "$TONGYE_BACKUP_DIR/staging.sql" "$TONGYE_BACKUP_DIR/staging-restore.sql"
```

受控目录700/文件600；导出日志可能带一小时私密下载URL，不回显或外发。准备脚本保留原SQL、调整前向FK顺序/分块并最后恢复触发器，不能截断JSON或关闭校验。只恢复到新隔离D1，逐表/FK/计数/业务回读，不向生产导入。媒体另按 [MEDIA_BACKUP.md](MEDIA_BACKUP.md) 核对净化源和显示图、字节/hash/历史引用及COMPLETE；同store新路径恢复不等于复制原对象路径或原身份。

```sh
# 仅故障回滚时：先查当前上一生产deployment，再填真实ID
TONGYE_ROLLBACK_DEPLOYMENT="dpl_请替换为当前上一生产部署ID"
npx vercel rollback "$TONGYE_ROLLBACK_DEPLOYMENT" --scope xinglan233s-projects --non-interactive
# Worker版本从当前部署历史核实，并确认Schema兼容后才执行
npx wrangler rollback '<已验证Worker版本ID>' --config worker/wrangler.production.jsonc
```

Hobby不能承诺任意旧部署一键回退。更旧源码走恢复分支/PR/CI重新发布；迁移不回改、不盲降数据库。按故障范围分别回前端、Worker，文档回滚不必退API；数据回退先新隔离库验证，再由持有人决定绑定。详见 [OPERATIONS.md](OPERATIONS.md)。

## 9. REDLAND资料与用户最少动作

真实全图已提供2048×1323，12:30入场已确认；官方87目录，第三方41活动/998场候选不是完整官方表。缺A02/C04实际场次、闭馆时刻、已核归一化POI和可走通道；图上重号/异名与多色箭头不能按编号或颜色自动生成路网。原图和候选包的授权Library来源在附件索引中，当前未纳入本机交接文件，不用空框架冒充候选包。

用户仍需要：安全向接手者提供必要项目配置；确认目标摊位/入口位置和至少一段通道、真实场次和来源；在大陆手机/微信提前实际访问与离线准备、保存恢复入口；确认新版可视页面后再发布。普通工程选择和已授权免费操作不反复问。无库存、不造真实数据、不再绕受限小红书笔记。

## 10. 给下一位的开始指令

> 在现有tongye_meet功能分支增量接手。先完整阅读docs/HANDOFF.md、handoff/requirements/latest-decisions.md及其索引的全部原文，逐张看三张原版图。先保护当前diff并核对真实SHA、测试与环境。完整P0继续补齐，已测权限/CAS/一分钟/独立收藏安排路线/离线不能回退；UI任务只统一既有公共组件与原图风格，不重写业务。先本地和隔离测试，以对应最新SHA记录证据；生产保持原版直到功能验收及用户视觉确认。不购买、不扩权、不发秘密、不联系第三方、不使用重置卡，不生成第三临时grant。把缺资料和未验证清楚列出，不让用户重新讲要求。

本交接初稿需在功能完成时更新为最终准确SHA、未提交差异、最新整套测试/CI、部署版本映射和完整状态；现在不能把初稿当全部交付完成。

## 10. 本轮功能检查点

新增迁移0007仅隔离本地应用，不能向旧staging API测试私人活动并声称通过。私人创建保护、双独立能力、资源读取/导出/owner更新、本队快照、共享预算和旧Worker回滚不公开均有9项新增真实D1测试；最近完整D1为39项，最新融合门禁尚需重跑。

新增普通界面回归三项通过：私人创建→13:07–13:52→建队关联→明确同步提交→第二身份邀请进入活动→刷新/导出；停留排队校验→窗口判断→显式加入才产生忙碌；真实D1取消后自动刷新→隐藏停止→离开停止→dirty草稿恢复。管理编辑组件3项单元通过，尚未挂载入口。当前融合类型/lint、105单元、39真实本地D1、24文档/129本地链接/5示例/9错误夹具以及构建已通过；最新完整浏览器尚未运行，不把三项定向加总当整套通过。

最大规模实测脚本与原始聚合证据见[性能说明](../tests/performance/README.md)。820320字节包、5天千点千场次/2000节点4000边、50人500安排完整保留，本地105请求全部200、497共同区间。Node CPU与本地墙钟不能证明Workers Free 10ms/128MB；1000点浏览器、最大图片和最新全云三角色仍待验。

官方额度只读显示本周100%。重置卡使用0张，最新撤销已经记录，无运行或待触发consume。本阶段只保存安全检查点，接手前读取git status及检查点日志，不能用昨夜旧许可兑换。交接原文及三图已独立保存，正式转交仍须更新最终提交、最新测试和未完成项。

## 11. 2026-10-01恢复检查点

接续基线 `ddcba4d9a703cd88e94f40ef6a8ddb4519e805a1` 已包含其他AI的五次界面提交。用户两处未提交修改均保留，未合并进本轮功能提交。最新Figma设计与覆盖规则见 `handoff/requirements/latest-decisions.md`。正常Mac会话已实际查看原型活动选择页；当前MCP仅返回源码/图片资源链接，未读取源码正文，不据此宣称设计已接入。

本轮修复站内P0记录指向非公开HANDOFF的坏链接，开发交接仍不发布为站内帮助。文档门禁校验真实文件，空目录不能冒充有效目标。完整浏览器回归使用 `TONGYE_E2E_API_PORT` 与 `TONGYE_E2E_BASE_URL` 指定独立端口，全新临时D1，不复用现有开发实例或生产。最新实际结果以本轮测试日志和提交记录为准，尚未完成Figma接入或新版生产发布。

## 2026-10-01 恢复后的实际证据

- 工作树基线 `ddcba4d9a703cd88e94f40ef6a8ddb4519e805a1`，用户两份未提交样式/时间轴修改已独立保护，本轮提交不包含它们。
- 当前聚合 `npm run verify` 实际通过：105单元、39真实本地D1集成，以及类型、lint、文档和构建。使用 `TONGYE_E2E_API_PORT=8795 TONGYE_E2E_BASE_URL=http://localhost:5175 npm run test:e2e` 保留已有开发端口，本轮新增入口前一次完整41浏览器通过；新增入口后最新一次完整42/42通过，耗时5.8分钟。
- staging实际应用0007，Worker构建标识ddcba4d，版本 `0dc05c53-c581-4ca6-931c-266d68f422ff`。8项隔离API演练通过；不等同于最新前端保护预览的云UI通过。数据库导出和测试凭据仅留用户Mac私密目录，不进入交接包。
- Figma官方导出原文、哈希与接口接线约束见 `handoff/FIGMA_REFERENCE.md`。当前仅实际看过活动选择页与源码视图；界面还未完整适配或逐屏验收。
- 新接私人资料管理入口只复用已有组件/API，不改变公开可见性、小队快照、身份或保存语义。
- 生产仍旧版本，未合并PR5。0张重置卡，兑换禁止。
