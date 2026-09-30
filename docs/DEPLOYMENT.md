# 免费部署指南

使用现有 Vercel 前端与 Cloudflare Workers Free / D1 Free。不要创建付费计划、购买域名或自动升级。Vercel Hobby 只限个人非商业使用；部署者先核验账户计划和实际用途。浏览器已登录不等于 CLI 已获授权，OAuth 持久授权由账号持有人完成。

## 本地

```sh
npm ci
npm run dev:all
```

创建 `worker/.dev.vars`，按 [示例](../worker/.dev.vars.example) 填本地测试创建码和管理员根凭据。不要提交它。前端 `.env.local` 的 VITE_API_URL 指向本地 Worker `http://127.0.0.1:8787`，可参照 [.env.example](../.env.example)。`npm run db:migrate:local` 应用本地迁移后启动真实本地 D1；`dev:all` 的自动迁移行为以脚本为准。

## 已部署资源与环境隔离

生产前端为 [coukong.vercel.app](https://coukong.vercel.app)，Vercel 项目 `tongye-meet`。生产 Worker `tongye-meet-api`，D1 `tongye-meet-production`，配置 [wrangler.production.jsonc](../worker/wrangler.production.jsonc)。预发布 Worker `tongye-meet-api-staging`、D1 `tongye-meet-staging`，配置 [wrangler.staging.jsonc](../worker/wrangler.staging.jsonc)。两库独立，不允许预览写生产。

生产前端使用同源 `/api/v1`，由 Vercel rewrite 代理到生产 Worker；只有 `coukong.vercel.app` 及配置中的明确生产项目别名匹配生产代理，其余预览请求代理到 staging。见 [vercel.json](../vercel.json)。生产公开前端不要设置指向 staging 的 VITE_API_URL；同源模式留空。直接跨域开发时才填对应 Worker 根地址，不加 `/api/v1`。

生产 CORS 仅列明确生产 origin；预发布仅列明确开发和预发布 origin，不泛匹配 `*.vercel.app`。新增预览入口需在 staging 加确切 origin；不要为方便测试扩大生产 CORS。创建保护仍为 invite，Secrets 在各 Worker 分别配置。

## 维护部署步骤

1. 确认免费账户与用途、CLI 授权及目标配置。浏览器登录不能代替 CLI 授权，新增持久权限由本人确认。
2. 按 [运维说明](OPERATIONS.md) 导出当前目标数据库到受控目录，再应用版本化迁移。已应用迁移不回改。
3. 必要 Secret 更新通过交互输入完成，不写公开文件：

```sh
npx wrangler secret put CREATION_CODE --config worker/wrangler.staging.jsonc
npx wrangler secret put ADMIN_ROOT_SECRET --config worker/wrangler.staging.jsonc
npx wrangler d1 migrations apply tongye-meet-staging --remote --config worker/wrangler.staging.jsonc
npx wrangler deploy --config worker/wrangler.staging.jsonc
```

4. 用待发布提交部署预发布，BUILD_VERSION 使用实际完整 SHA。运行 verify、浏览器与三身份云端写入回读，完成备份隔离恢复，再核验真机和现场网络。
5. 生产重复备份与迁移，使用 production 配置；`npm run db:migrate:remote`、`npm run worker:deploy` 的具体目标先核对 package.json。Worker BUILD_VERSION 与 Vercel 生产部署必须对应同一提交。
6. 生产只读核验 `/api/v1/health`、`/api/v1/ready`、首页、深链接、帮助与三个下载。写入演练限明确测试小队，记录并清理。

首次搭建其他环境时，先 `wrangler d1 create` 建独立免费库，填写返回的 database_id 和该环境 Worker 名，再迁移和配置 Secrets；本地全零 ID 不可作为远程部署配置。

## 当前发布与待验

本次生产前端和 API 均对应 `b80193d8ed30404f181917796919382b5efd890c`；生产三身份 UI、分钟往返、候选包云端导入及隔离恢复已验证。真机、微信、中国大陆现场网络、CPU 指标和官方活动资料确认仍待完成，见 [发布检查表](RELEASE_CHECKLIST.md)。私密管理/成员恢复入口另行安全保存，不能放公开文档。
