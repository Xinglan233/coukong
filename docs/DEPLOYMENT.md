# 免费部署指南

使用现有 Vercel 前端与 Cloudflare Workers Free / D1 Free。不要创建付费计划、购买域名或自动升级。Vercel Hobby 只限个人非商业使用；部署者先核验账户计划和实际用途。浏览器已登录不等于 CLI 已获授权，OAuth 持久授权由账号持有人完成。

## 本地

```sh
npm ci
npm run dev:all
```

创建 `worker/.dev.vars`，按 [示例](../worker/.dev.vars.example) 填本地测试创建码和管理员根凭据。不要提交它。前端 `.env.local` 的 VITE_API_URL 指向本地 Worker `http://127.0.0.1:8787`，可参照 [.env.example](../.env.example)。`npm run db:migrate:local` 应用本地迁移后启动真实本地 D1；`dev:all` 的自动迁移行为以脚本为准。

## 先隔离预发布

1. 通过官方 Wrangler 登录由本人确认授权，确认 Workers Free 与 D1 Free；没有权限不要跳到别的机器规避。
2. 在 Cloudflare 建立独立预发布数据库，记录返回 database_id。版本控制里的全零 database_id 仅本地占位，不可直接生产部署。为预发布/生产分别保存配置与不同数据库绑定，勿让 Vercel 预览默认写生产。
3. 从迁移前快照备份再运行下列命令；数据库名应替换为已绑定的明确环境名称。

```sh
npx wrangler d1 create coukong-staging --config worker/wrangler.jsonc
npx wrangler d1 migrations apply coukong-staging --remote --config worker/wrangler.jsonc
npx wrangler secret put CREATION_CODE --config worker/wrangler.jsonc
npx wrangler secret put ADMIN_ROOT_SECRET --config worker/wrangler.jsonc
npx wrangler deploy --config worker/wrangler.jsonc
```

create 返回后先更新隔离配置的 name / database_name / database_id；上述后续命令必须使用该配置，不能误用本地占位配置。Secrets 交互输入，真实值不入文件和公开命令。配置 CREATION_MODE=invite，ALLOWED_ORIGINS 为确切预发布 origin 列表，BUILD_VERSION 为实际提交号；不允许 `*.vercel.app` 泛匹配。

4. Vercel 导入已有 GitHub 仓库/项目，Vite 构建输出 dist。Production 与 Preview 的 VITE_API_URL 分别指向对应 Worker。此变量只有公开 API 根地址，不包含 `/api/v1`，Secret 不能用 VITE_ 前缀。SPA rewrite 保留 `/help/`、JSON 下载和静态资源；深链接刷新必须实测。
5. 查询 `/api/v1/health` 与 `/api/v1/ready`，然后三个隔离身份真实创建、加入、提交、读取和权限测试。导出 D1 并在隔离库恢复，按 [运维](OPERATIONS.md) 核对，再完成手机/现场网络验收。

## 生产

保留旧 Vercel deployment ID、原提交和旧数据导出；备份生产 D1，应用已验证的版本化迁移，设置生产精确 origin 和 BUILD_VERSION。通过预发布门禁后部署；生产只读核验版本、ready、首页、深链接、帮助和三个示例下载。需要写入演练时只用明确测试小队并记录清理。

最终记录实际前端/API URL、提交、部署 ID、迁移版本和证据于 [检查表](RELEASE_CHECKLIST.md)。目前本文是配置步骤，不证明任何云资源已创建或本版本已上线。用户需要的动作仅包括官方授权、确认免费计划/用途、安全初始化 Secrets、REDLAND 资料确认与真机/国内网络测试。
