# 同野·游

同野·游（原凑空）：围绕一场活动，安排自己的行程，也安排与朋友同行的时间。保留 Vite / React / TypeScript，在线回复由 Cloudflare Worker + D1 持久化；本机草稿与已提交回复分别显示。

## 当前发布状态

生产入口：[打开游](https://coukong.vercel.app)。API：[数据库就绪](https://tongye-meet-api.xinglan233.workers.dev/api/v1/ready)。Vercel 项目名是 `tongye-meet`，沿用已有公开别名 `coukong.vercel.app`。

2026-09-30 发布对应功能合并提交 `9090be47ed732b5afd5323d20515be1fbb4cb84f`，PR #2 已合并；前端功能源码与 Worker 就绪标识对应此功能版本，源码树与已验收提交 `7a9ab0a` 等价；后续纯文档发布可有不同前端部署提交，不改变 Worker 构建标识。已完成本地测试、真实云端多人读写、分钟往返与备份隔离恢复；真机、微信、中国大陆现场网络和 Worker CPU 尚未验证。详细证据与剩余门禁见 [发布检查表](docs/RELEASE_CHECKLIST.md)。

## 本轮活动与地图升级

正在实施“选活动 → 逛展/活动 → 计划 → 同行 → 我的”。公开浏览与个人收藏计划不以加入小队为前提；现有多人分钟协调保留。本轮新增能力尚未完成生产验收，当前地址的稳定多人版本不能当作地图升级已经上线。地图持久媒体资源待核验/必要审批，真实 REDLAND 地图与通道资料不足；GPS 和自托管适配未实现。

[地图与标点](docs/MAP_GUIDE.md)、[路线限制](docs/ROUTING.md)、[部署决策](docs/DEPLOYMENT_DECISION.md) 说明准备与边界。

## 开始使用

收到邀请请读 [新手上路](docs/GETTING_STARTED.md)，发起人请读 [发起人指南](docs/ORGANIZER_GUIDE.md)。部署后的站内 `/help/` 和 `/help/event-json/` 不要求 GitHub 账号。[文档中心](docs/README.md) 包含管理员、开发和运维说明。

本地安装锁文件依赖后启动：

```sh
npm ci
npm run dev:all
```

仅前端用 `npm run dev`。发布前运行 `npm run verify` 和 `npm run test:e2e`。本地开发使用真实本地 D1；公开配置参见 [.env.example](.env.example)，免费资源配置见 [部署指南](docs/DEPLOYMENT.md)。不要将管理员凭据放进前端环境变量。

## 数据与边界

分钟精度独立于 5/10/15/30 分钟选择步长，默认 15 分钟。`13:07–13:52` 保持原值。活动统一使用活动时区，DST 过渡日拒绝，详见 [日期时间](docs/DATETIME.md)。选择公共场次只是记录计划，不代表官方预约。

草稿仅在本机；提交成功后其他成员才可看安全结果。恢复链接等效于对应权限，请单独保存。云端并非端到端加密，见 [隐私说明](docs/PRIVACY.md)。本机清除和云端删除是不同操作。

只用免费资源，不自动升级。Workers / D1 配额与 Vercel Hobby 个人非商业用途限制见 [运维说明](docs/OPERATIONS.md)。REDLAND 示例的 09:00–21:00 待确认，场次为空，不是官方活动安排。OCR 保留为本地辅助功能，不保证识别任意海报。
