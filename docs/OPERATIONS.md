# 运维、备份与回滚

## 免费限制

核查日期 2026-09-30 UTC。Workers Free 每账户 100,000 请求/日，UTC 00 重置，每请求 10ms CPU、128MB；请求耗尽错误 1027，CPU 超限 1102，见 [Workers 官方限制](https://developers.cloudflare.com/workers/platform/limits/)。

D1 Free 每日 500 万读行、10 万写行，总 5GB，最多 10 库、单库 500MB；每 Worker 调用最多 50 查询、SQL 最多 100 绑定参数/100KB、行/BLOB 2MB、单查询 30 秒、Time Travel 7 天，见 [D1 价格](https://developers.cloudflare.com/d1/platform/pricing/) 和 [D1 限制](https://developers.cloudflare.com/d1/platform/limits/)。扫描行算读、索引更新增加写。自 2026-09-01 日额度强制执行，超额 Binding 和 REST 查询均失败至 UTC 午夜，数据保留，见 [官方变更](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/)。

Vercel Hobby 限个人非商业用途，见 [官方公平使用规则](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage)。这些规则不是当前实现已测满足 10ms CPU 的证明；998 场次、185548 字节候选包的云端导入/导出已通过，但最大 512KiB/1000 场次、10ms CPU 指标和预期规模仍需专门实测。不得为超额自动付费。

## 受控备份与隔离恢复

活动 JSON、个人导出、本机草稿和数据库备份用途不同。D1 全量 SQL 含私人信息和凭据哈希，存受控路径，不提交 GitHub、不放 public/dist。更新重要活动与迁移前备份。

生产使用 `tongye-meet-production` / `worker/wrangler.production.jsonc`；预发布使用 `tongye-meet-staging` / `worker/wrangler.staging.jsonc`。本次已执行云端导出、隔离恢复与 API deepEqual；生产初始和预发布上线前 SQL 备份以权限 600 保存在受控位置，路径由交付者单独提供。

```sh
npx wrangler d1 export tongye-meet-production --remote --output ./private-backups/production.sql --config worker/wrangler.production.jsonc
npx wrangler d1 export tongye-meet-staging --remote --output ./private-backups/staging.sql --config worker/wrangler.staging.jsonc
```

运行前在仓库与公开构建之外选受控工作目录建立 private-backups，目录权限 700、导出权限 600；示意相对路径不表示仓库可提交目录。导出后再次检查权限与完整性。

恢复最短步骤：创建全新隔离 D1 → 复制 staging 配置为临时恢复配置并填写新 database_id/name → `wrangler d1 execute <新隔离库名> --remote --file <受控SQL文件> --config <恢复配置>` → 绑定独立 Worker → 检查 ready、三身份回读及活动导出 deepEqual。禁止把恢复 SQL 直接导入当前生产库。保留结束码与脱敏证据；只生成文件不算恢复通过。演练资源后续清理由持有人确认，免费 Time Travel 仅补充。

## 故障

线上配额/Worker/超时或 HTML 错页时停止密集重试，显示暂不可用、最后获取时间，保留本机草稿。联网后主动重试，版本变化先复核。前端 origin 变更会使原 IndexedDB 与凭据不自动跟随，新入口启用前提示保存恢复链接/导出。

管理员看 Cloudflare D1 行读写、存储和 Worker 请求/CPU指标，排查按小队索引查询，避免全表与多组件重复轮询。活动前完成预发布恢复、三身份、实际手机与国内网络演练，确认真实活动资料。当前手动删除/清理，不承诺自动保留期限。

## 回滚

当前生产基线为合并提交 `b80193d8ed30404f181917796919382b5efd890c`。先保存当前数据备份与部署 ID；Vercel 项目 tongye-meet 选择已验证旧 deployment 恢复到公开别名 coukong.vercel.app。Worker 使用 `wrangler rollback <已验证版本ID> --config worker/wrangler.production.jsonc` 回滚，版本 ID 从实际部署历史选取，必须检查其 Schema 兼容性。已应用迁移不回改、不盲目降级数据库。需要数据回退时先备份当前库并恢复旧 SQL 到新隔离库验证，然后由持有人决定切换绑定；旧数据库保留。旧版 localStorage 原文和 Git baseline.bundle 是迁移依据，不能恢复云端未备份数据。

[发布检查](RELEASE_CHECKLIST.md) 必须注明备份路径、演练结果、旧部署和恢复版本，不能在公开记录里写私人链接或秘密。
