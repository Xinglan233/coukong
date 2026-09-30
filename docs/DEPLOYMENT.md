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

## 本轮媒体服务（尚未云验收）

代码新增四个 Vercel Node 入口：POST `/api/media/upload` 获取限定路径/大小/类型的私有上传授权；POST `/api/media/finish` 净化图像并激活不可变源图/显示图；GET `/api/media/read` 在 Worker 验证公开发布引用或管理权限后回读显示图；POST `/api/media/cleanup` 在管理员确认后清理失败/过期且未引用上传。不能用静态构建预览代替这些入口。

Vercel 后端分别配置 ACTIVITY_API_URL（对应 Worker 根地址，不含/api/v1）和 BLOB_STORE_ID（对应独立私有 store），不带 VITE_ 前缀，不暴露 OIDC token。Production 只连 production；Preview/Development 只连 staging。Node 使用运行时 OIDC，Worker 配置 VERCEL_OIDC_ISSUER、VERCEL_OIDC_AUDIENCE、VERCEL_OIDC_SUBJECT，并验证 RS256/JWKS、有效期与精确 iss/aud/sub。实际值从当前组织/项目官方配置核对，不凭猜测填写或记录 JWT。生产只允许当前项目 production 的单一 subject，staging 仅允许该项目明确 preview 与 development 两个 subject，不使用环境通配符。

每环境256MiB应用预算保守计入未完成预留和残留临时图，独立于账户1GB平台额度。首次部署必须测试媒体授权、非法/伪MIME/动画拒绝、另一浏览器公开回读、草稿拒读、OIDC跨环境拒绝、失效清理和数据＋图片隔离恢复；当前仍待云端实际验证。无需开通R2或付费资源。
