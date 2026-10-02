# 运维、备份与回滚

## 免费限制

核查日期 2026-09-30 UTC。Workers Free 每账户 100,000 请求/日，UTC 00 重置，每请求 10ms CPU、128MB；请求耗尽错误 1027，CPU 超限 1102，见 [Workers 官方限制](https://developers.cloudflare.com/workers/platform/limits/)。

D1 Free 每日 500 万读行、10 万写行，总 5GB，最多 10 库、单库 500MB；每 Worker 调用最多 50 查询、SQL 最多 100 绑定参数/100KB、行/BLOB 2MB、单查询 30 秒、Time Travel 7 天，见 [D1 价格](https://developers.cloudflare.com/d1/platform/pricing/) 和 [D1 限制](https://developers.cloudflare.com/d1/platform/limits/)。扫描行算读、索引更新增加写。自 2026-09-01 日额度强制执行，超额 Binding 和 REST 查询均失败至 UTC 午夜，数据保留，见 [官方变更](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/)。

Vercel Hobby 限个人非商业用途，见 [官方公平使用规则](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage)。这些规则不是当前实现已测满足 10ms CPU 的证明；998 场次、185548 字节候选包的云端导入/导出已通过，但最大 512KiB/1000 场次、10ms CPU 指标和预期规模仍需专门实测。不得为超额自动付费。

## 受控备份与隔离恢复

活动 JSON、个人导出、本机草稿和数据库备份用途不同。D1 全量 SQL 含私人信息和凭据哈希，存受控路径，不提交 GitHub、不放 public/dist。更新重要活动与迁移前备份。

生产使用 `tongye-meet-production` / `worker/wrangler.production.jsonc`；预发布使用 `tongye-meet-staging` / `worker/wrangler.staging.jsonc`。本次已执行云端导出、隔离恢复与 API deepEqual；生产初始和预发布上线前 SQL 备份以权限 600 保存在受控位置，路径由交付者单独提供。

```sh
umask 077
TONGYE_BACKUP_DIR="/请替换为仓库外的私密备份目录"
mkdir -p "$TONGYE_BACKUP_DIR"
npx wrangler d1 export tongye-meet-production --remote --output "$TONGYE_BACKUP_DIR/production.sql" --config worker/wrangler.production.jsonc > "$TONGYE_BACKUP_DIR/production-export.log" 2>&1
npx wrangler d1 export tongye-meet-staging --remote --output "$TONGYE_BACKUP_DIR/staging.sql" --config worker/wrangler.staging.jsonc > "$TONGYE_BACKUP_DIR/staging-export.log" 2>&1
```

运行前填写仓库与公开构建之外的受控目录，目录权限700，SQL和日志权限600。CLI可能输出一小时有效的私密数据库下载链接，所以stdout/stderr必须重定向至该目录；不要直接显示、上传或分享原始日志。对外只报告脱敏状态、退出码和文件大小。导出会短暂阻塞数据库请求，选低流量时执行，失败先确认状态再重试。导出后检查权限与完整性。

恢复最短步骤：创建全新隔离 D1 → 复制 staging 配置为临时恢复配置并填写新 database_id/name → `wrangler d1 execute <新隔离库名> --remote --file <受控SQL文件> --config <恢复配置>` → 绑定独立 Worker → 检查 ready、三身份回读及活动导出 deepEqual。禁止把恢复 SQL 直接导入当前生产库。保留结束码与脱敏证据；只生成文件不算恢复通过。演练资源后续清理由持有人确认，免费 Time Travel 仅补充。

使用 Python 3 准备受控的 Wrangler SQL 导出，保留原文件：

```sh
python3 scripts/prepare-d1-restore.py "$PRIVATE_EXPORT_SQL" "$PRIVATE_RESTORE_SQL"
```

此命令先建全部表、再导入数据、最后恢复索引与触发器，避免前向外键引用和重新触发审计/预算计数。大的内联文本会在临时辅助表中无损拼接，单条SQL控制在80KiB以内，再一次插入原记录；辅助表在导入结束前移除。原JSON、行和原备份不截断、不覆盖。仅用于可信数据库导出；输出必须是新路径，文件权限600。将准备后的 SQL 用于隔离 D1 导入与媒体备份的 `--db-file`。导入后仍需检查外键、预算计数和业务回读，不能关闭云端外键校验。[D1 外键与隐式事务规则](https://developers.cloudflare.com/d1/sql-api/foreign-keys/)。


## 故障

线上配额/Worker/超时或 HTML 错页时停止密集重试，显示暂不可用、最后获取时间，保留本机草稿。联网后主动重试，版本变化先复核。前端 origin 变更会使原 IndexedDB 与凭据不自动跟随，新入口启用前提示保存恢复链接/导出。

管理员看 Cloudflare D1 行读写、存储和 Worker 请求/CPU指标，排查按小队索引查询，避免全表与多组件重复轮询。活动前完成预发布恢复、三身份、实际手机与国内网络演练，确认真实活动资料。当前手动删除/清理，不承诺自动保留期限。

## 回滚

当前功能提交以实际生产部署的Git元数据和 `/api/v1/ready` 构建标识为准；纯文档提交可与Worker源码提交不同，必须记录两者及源码树关系。2026-10-02活动升级前稳定Worker源码为 `9090be47ed732b5afd5323d20515be1fbb4cb84f`，版本ID `818f337c-c334-4145-9d47-44406d62ff80`；更早b801版本会带回其已知缺陷，不默认作为首选。先保存当前数据备份与部署 ID；Vercel 项目 tongye-meet 选择已验证旧 deployment 恢复到公开别名 coukong.vercel.app。Worker 使用 `wrangler rollback <已验证版本ID> --config worker/wrangler.production.jsonc` 回滚，版本 ID 从实际部署历史选取，必须检查其 Schema 兼容性。已应用迁移不回改、不盲目降级数据库。需要数据回退时先备份当前库并恢复旧 SQL 到新隔离库验证，然后由持有人决定切换绑定；旧数据库保留。旧版 localStorage 原文和 Git baseline.bundle 是迁移依据，不能恢复云端未备份数据。

[发布检查](RELEASE_CHECKLIST.md) 必须注明备份路径、演练结果、旧部署和恢复版本，不能在公开记录里写私人链接或秘密。

本轮实际回滚点（仅需要回滚时执行；这不是数据库降级）：

```sh
# 先在现有项目部署列表确认当前上一个生产部署，再填写其ID
TONGYE_ROLLBACK_DEPLOYMENT="dpl_请替换为当前上一生产部署ID"
npx vercel rollback "$TONGYE_ROLLBACK_DEPLOYMENT" --scope xinglan233s-projects --non-interactive
# 另从Worker实际版本历史确认Schema兼容的稳定版本；按故障范围选择是否执行
TONGYE_ROLLBACK_WORKER_VERSION="请替换为已核实Worker版本ID"
npx wrangler rollback "$TONGYE_ROLLBACK_WORKER_VERSION" --config worker/wrangler.production.jsonc
```

前端直接回滚目标必须从现有项目部署列表确认，不固定某次发布ID。Hobby只允许直接回滚到前一个生产部署，见 [官方CLI说明](https://vercel.com/docs/cli/rollback)；每次操作先核对项目部署列表。更早b801前端部署 `dpl_3FT8Y15H4F3ZVnPpT1VZZqnvYXhU` 仍保留，但如果免费计划拒绝直接回滚，则用b801源码经正常恢复分支、PR和CI重新发布，不升级付费。Worker与前端按故障范围选择并核验，单独回滚文档无需回滚Worker。恢复到旧9090会暂时失去新增活动、个人计划与媒体功能，但不能删掉新D1表、私人活动或已保存计划；回滚前先确认私人活动不会被旧版公开。CLI需要相应账户登录；不要为失败扩权。回滚之后核对公开站点和 `/api/v1/ready`；旧版本会重新带回其已知界面与模板下架缺陷，数据库及个人草稿不因代码回滚而删除。

## 本轮媒体预算与失败清理（云端待验）

每环境256MiB保守应用预算，生产与staging独立；两个环境共512MiB不是账户1GB额度保证。其他store、直接平台操作、流量和操作配额仍可消耗账户额度。未完成、失败和已过期上传保留预留；ready计净化源图、显示图及可能未删临时原图，额度数值不等于实际平台精确用量。

管理员进入地图编辑“图片空间与失败上传”→“查看图片空间”，需要时点“清理失败上传”并明确确认不可恢复。对应 POST `/api/media/cleanup`，管理员 Bearer 与 `{eventId,confirmDelete:true}` 必需。候选仅pending/processing/failed且上传期限过后再等待15分钟，所有当前/历史活动引用和ready资产排除，每次最多5项、每资产最多20对象。Node仅删除严格资产前缀内对象并再次确认目录为空，Worker再检查仍未引用后标revoked、释放预留；途中失败保留预算，可重试，不承诺自动每日清理。

数据库SQL不含Blob图片。媒体恢复应同时保存净化源图、显示图、文件SHA-256、资产状态与所有历史引用，再导入全新隔离store/数据库并实际回读；单独SQL恢复证明不能沿用为新媒体恢复证据。旧ready图和历史版本不可为省额度擅自删除。c265前端加修补Worker已完成隔离云新路径媒体恢复与再次备份，证据与最新代码云端验收分开；最新完整前后端和最大媒体矩阵仍待验。

## 个人计划应用预算（本轮分支，云端待验）

通过 `GET /api/v1/limits` 核对部署实际限额，不凭文档猜运行配置。单份plan最大1536KiB；全部访客共用128MiB逻辑UTF-8预算，另按每记录1KiB保守计入元数据。该应用门禁与D1物理容量、索引、页空间及平台日读写额度不同，不能承诺物理数据库始终低于128MiB。

幂等回执24小时、每人最多64条，仅保留紧凑版本元数据，不留私人计划历史。过期旧操作返回IDEMPOTENCY_EXPIRED，已被后续保存替代返回OPERATION_SUPERSEDED；均为409，应回读比较再创建新操作。413 PERSONAL_PLAN_TOO_LARGE要求缩减本人计划；507 STORAGE_BUDGET_EXCEEDED要求保留草稿后重试或清理不用的本人记录。不要为预算失败自动升级，也不要代替用户删除仍在使用的计划。备份和隔离恢复须另行实际验证，新门禁的本地测试不作为云端恢复证据。
