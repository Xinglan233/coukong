# 运维、备份与回滚

## 免费限制

核查日期 2026-09-30 UTC。Workers Free 每账户 100,000 请求/日，UTC 00 重置，每请求 10ms CPU、128MB；请求耗尽错误 1027，CPU 超限 1102，见 [Workers 官方限制](https://developers.cloudflare.com/workers/platform/limits/)。

D1 Free 每日 500 万读行、10 万写行，总 5GB，最多 10 库、单库 500MB；每 Worker 调用最多 50 查询、SQL 最多 100 绑定参数/100KB、行/BLOB 2MB、单查询 30 秒、Time Travel 7 天，见 [D1 价格](https://developers.cloudflare.com/d1/platform/pricing/) 和 [D1 限制](https://developers.cloudflare.com/d1/platform/limits/)。扫描行算读、索引更新增加写。自 2026-09-01 日额度强制执行，超额 Binding 和 REST 查询均失败至 UTC 午夜，数据保留，见 [官方变更](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/)。

Vercel Hobby 限个人非商业用途，见 [官方公平使用规则](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage)。这些规则不是当前实现已测满足 10ms CPU 的证明；最大 512KiB/1000 场次和预期规模仍需部署实测。不得为超额自动付费。

## 受控备份与隔离恢复

活动 JSON、个人导出、本机草稿和数据库备份用途不同。D1 全量 SQL 含私人信息和凭据哈希，存受控路径，不提交 GitHub、不放 public/dist。更新重要活动与迁移前备份。

```sh
npx wrangler d1 export coukong-production --remote --output /受控本地目录/coukong-backup.sql --config worker/production.jsonc
npx wrangler d1 create coukong-restore-drill --config worker/restore.jsonc
npx wrangler d1 execute coukong-restore-drill --remote --file /受控本地目录/coukong-backup.sql --config worker/restore.jsonc
```

上面 production.jsonc/restore.jsonc 是部署者需从本地配置复制建立的隔离配置名称，不是仓库默认现成文件。先写入新库准确 ID，再恢复；绝不能导入当前生产库。备份覆盖是否完整以 Wrangler 导出提示为准。对恢复库运行 ready、三身份回读、记录条数/版本/活动导出比对，保留结束码和证据；只生成文件不算恢复通过。演练完成由持有人确认删除独立演练资源。免费 Time Travel 只作补充。

## 故障

线上配额/Worker/超时或 HTML 错页时停止密集重试，显示暂不可用、最后获取时间，保留本机草稿。联网后主动重试，版本变化先复核。前端 origin 变更会使原 IndexedDB 与凭据不自动跟随，新入口启用前提示保存恢复链接/导出。

管理员看 Cloudflare D1 行读写、存储和 Worker 请求/CPU指标，排查按小队索引查询，避免全表与多组件重复轮询。活动前完成预发布恢复、三身份、实际手机与国内网络演练，确认真实活动资料。当前手动删除/清理，不承诺自动保留期限。

## 回滚

记录部署提交、Worker 版本与迁移版本。前端恢复到旧 Vercel deployment；Worker 回滚到已验证版本，必须检查其 Schema 兼容性。已应用迁移不回改、不盲目降级数据库。需要数据回退时先备份当前库并恢复旧 SQL 到新隔离库验证，然后由持有人决定切换绑定；旧数据库保留。旧版 localStorage 原文和 Git baseline.bundle 是迁移依据，不能恢复云端未备份数据。

[发布检查](RELEASE_CHECKLIST.md) 必须注明备份路径、演练结果、旧部署和恢复版本，不能在公开记录里写私人链接或秘密。
