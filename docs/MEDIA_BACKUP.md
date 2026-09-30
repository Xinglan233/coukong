# 媒体备份与隔离恢复

地图媒体需要与同一版本的数据库一起备份。数据库 SQL 保存活动、全部历史原包/引用、个人计划和小队数据；媒体备份保存每个已就绪历史资产的净化源图、显示图、大小及 SHA-256。撤回但仍保留私有文件的历史资产也纳入。临时上传、失败资产不是可恢复正式地图；历史版本若引用缺失文件，备份明确失败。

隔离预发布已实际导出一项媒体资产的净化源图与显示图，并核对数据库版本、全部历史引用和文件哈希；该份实际备份的本机隔离恢复通过。云端数据库与媒体的完整隔离恢复仍待演练，不能沿用旧 SQL 恢复或本机恢复证据。对应前端与 Worker 版本见 [发布检查表](RELEASE_CHECKLIST.md)。

## 先保存私密数据库

按 [运维指南](OPERATIONS.md) 的受控 D1 导出步骤保存 SQL，勿打印含私密下载链接的 CLI 原始输出。管理员在这段期间停止活动资料/地图变更。脚本会将 SQL 导入本机内存 SQLite，核对活动 revision/publicRevision、全部历史引用和媒体元数据；版本不一致时停止，重新导出 SQL 后再备份。

使用刚导出的可信 SQL，先按运维指南运行 `scripts/prepare-d1-restore.py`，保留原文件并生成新的恢复顺序文件。备份命令的 `--db-file` 使用准备后的文件，避免前向外键表顺序与预算触发器重复计数。不能用来执行任意来源的 SQL。SQL 上限为128 MiB；大于上限明确停止，不截断。该校验只在本机内存数据库执行，不改云端 D1。

## 受控分块导出

沿用已批准的精确预览部署临时链接；不给脚本新 CLI 登录、长期 Blob token 或第三个 store。临时访问文件只有 `{"url":"已批准的精确预览临时链接"}`；已有管理员会话单独存纯文本文件。两者及 SQL 都设600权限，存于仓库外私密目录。临时链接授予预览访问，管理员 Bearer 另行约束本活动备份，Vercel 后台运行时 OIDC 再约束 Worker 的可信访问。

```sh
node --import tsx scripts/media-backup.ts \
  --access-file /受控私密目录/preview-access.json \
  --session-file /受控私密目录/admin-session.txt \
  --db-file /受控私密目录/staging.sql \
  --event 需要备份的活动ID \
  --out /受控私密目录/一个尚不存在的备份目录
```

脚本只报告完成状态、文件数和数据库哈希，不打印授权链接、Cookie、会话或 Blob URL。访问 Cookie 只保存在这次请求上下文内存中。备份目录700，所有文件600；拒绝保存到仓库内，不加入公开 Git。

Node `GET /api/media/backup` 的索引和文件响应均最多1 MiB。Worker 要求管理员会话及当前 Node OIDC 双重验证；只允许此活动的 ready 或仍保留文件的 revoked 历史资产，固定路径由数据库生成。没有公开源图读取接口，也不接受 JSON 任意下载 URL。索引最多50个资产、10000条历史引用，超过数量或1 MiB响应上限明确拒绝，不能截断后写完成。

Blob SDK 发送 `Range`，只有返回准确的 `Content-Range` 时才按区间读取。若存储忽略 Range，Node 完整读取并校验最多12 MiB净化源图或3 MiB显示图，再返回1 MiB片。最大源图12片会产生约144 MiB源读取，最大显示图3片约9 MiB读取；不能把分块响应限制当成免费流量保证。manifest记录 rangeReads/fullReads；演练后以实际结果判断流量。详见 [官方 SDK get() headers](https://vercel.com/docs/vercel-blob/using-blob-sdk)。

产物包含 `database.sql`、`manifest.json`、每资产的 `.source.png/jpg/webp` 与 `.display.webp` 和 `COMPLETE`。每片和整文件均校验 SHA-256，SQL对应的历史引用逐条核对，结束时再检查远端索引未变化。没有 `COMPLETE` 的目录只算失败中间产物；保留原文件，修复或用新的输出目录重做。

## 在同一 staging store 演练恢复

只对明确命名的虚构演练活动执行。不要复制真实生产图、覆盖原活动/原图，或向当前生产库导入 SQL。

1. 从私密备份中读 SQL、manifest及两类文件，复核文件大小和SHA-256。SQL恢复验证沿用已有隔离 D1 流程；原始 SQL 不包含图片，恢复后不能单凭 ready 判定地图可用。
2. 在 staging 管理员后台新建一个不同 ID 的隔离活动，先保存草稿。使用现有地图上传入口上传备份 `.source.png/jpg/webp`；实际文件选择时按 manifest 的 PNG/JPEG/WebP 类型使用合适扩展名。上传生成全新的 event/asset 路径，保留原图和原历史资产。
3. 净化流程再次编码源图，尤其 JPEG 的字节哈希可能变化。恢复新包必须采用新上传结果的 assetKey、SHA-256、sizeBytes、宽高，不能声称新文件与旧哈希相同。私密备份保留原始哈希作为来源证据。
4. 从 SQL 的 `event_versions.event_json` 按 revision 升序准备原历史包，将 event.id 改为隔离活动 ID；各地图/assetManifest改为对应新上传资产的真实结果。按现有 JSON 导入/活动保存流程逐版导入，空间变化仍遵守地图版本复核。版本号可从新活动重新计数，另保存原 revision→新 revision 和原 assetId→新 assetId 对照，不能称复制了原版本号或原用户凭据。
5. 先按管理员身份打开新草稿地图，再发布这一命名的演练活动，用独立普通身份真正读取显示图、地点坐标及路线/分钟安排。另一次备份验证新历史引用与新文件一致。备份中的原 `.display.webp` 必须保留并校哈希；正常上传会重新生成显示图，这种演练验证业务恢复，不声称重建原 Blob 路径或显示图编码完全相同。
6. 记录原备份哈希、SQL恢复结果、ID/版本对照、新图读取/权限与历史引用结果。若当前256 MiB应用预算不足以并存新旧媒体，停止；不自动删除旧 ready 图、不启用付费、不新建 store。清理只按 [失败上传流程](OPERATIONS.md) 处理允许的孤立临时资产。

上述普通上传/导入恢复使用同一 staging store 的全新活动及资产路径。全库 SQL 可用于受控隔离数据库的完整恢复；个人记录凭据、旧小队等不能靠修改公开活动 JSON 自动迁给新活动。两种验证的范围分别记录，不用重建一个地图活动替代全库私人数据恢复证明。
