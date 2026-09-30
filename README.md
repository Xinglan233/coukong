# 游

游（原凑空）：一个人发起，大家填时间，一起找到能碰面的空档。保留 Vite / React / TypeScript，在线回复由 Cloudflare Worker + D1 持久化；本机草稿与已提交回复分别显示。

## 当前发布状态

通用版正在本地实施与验收。尚无本版本已验证的生产地址；旧部署只是回滚基线。最终提交、测试结果、真实地址及缺口以 [发布检查表](docs/RELEASE_CHECKLIST.md) 为准。构建通过不等于多人上线通过。

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
