# 同野·游

同野·游是活动中的个人计划与同行工具。选一场活动，收藏想去的地点，安排自己的时间，也和朋友查看共同空闲。

[打开同野·游](https://meet.tongye.ink) · [REDLAND 2026](https://meet.tongye.ink/events/redland-2026) · [使用帮助](https://meet.tongye.ink/help/) · [文档中心](docs/README.md)

## 使用

- **个人计划**：无需加入小队即可收藏地点、记录安排和整理路线。收藏、日程、路线分别保存。
- **同行**：队长创建小队并发出邀请；每位队员填写、提交自己的时间，再查看共同空闲。
- **活动资料**：管理员维护活动、场次、地点和地图，支持网页编辑与 JSON 导入、预览、发布。
- **现场准备**：保存恢复链接，下载活动资料和所选地图；离线编辑保留本机草稿，联网后再保存。

时间精确到分钟，默认快捷步长15分钟，可切5/10/30分钟。`13:07–13:52` 不取整。选择场次只记录个人计划，不替用户完成官方预约。

REDLAND 已提供全场地图、87条地点目录和998条参考场次。场次来自第三方整理，A02、C04的实际时段仍缺；地点尚未定位，也没有经过核对的可走路网。12:30入场已确认，闭馆时间未确认。

## 本地开发

需要 Node.js 22–26、npm 和 Python 3。安装锁文件依赖后启动前端与真实本地 Worker/D1：

```sh
npm ci
npm run dev:all
```

本地配置参见 [.env.example](.env.example) 和 [worker/.dev.vars.example](worker/.dev.vars.example)。只启动前端用 `npm run dev`。

```sh
npm run verify
npm run test:e2e
```

## 文档

- 用户：[新手上路](docs/GETTING_STARTED.md)、[队长指南](docs/ORGANIZER_GUIDE.md)、[地图](docs/MAP_GUIDE.md)、[路线](docs/ROUTING.md)。
- 管理员：[管理员指南](docs/ADMIN_GUIDE.md)、[活动 JSON](docs/EVENT_JSON_FORMAT.md)。
- 开发：[架构](docs/ARCHITECTURE.md)、[API](docs/API.md)、[日期时间](docs/DATETIME.md)、[测试](docs/TESTING.md)。
- 维护：[部署](docs/DEPLOYMENT.md)、[运维与回滚](docs/OPERATIONS.md)、[媒体备份](docs/MEDIA_BACKUP.md)、[发布记录](docs/RELEASE_CHECKLIST.md)。
- 数据：[隐私](docs/PRIVACY.md)、[安全](SECURITY.md)、[变更记录](CHANGELOG.md)。

## 数据与运行边界

前端使用 Vite、React 和 TypeScript；Vercel 提供网页与图片处理，Cloudflare Worker/D1 保存在线记录，私有 Blob 保存地图。生产与测试环境隔离。仅使用免费计划，不自动升级；Vercel Hobby 限个人非商业用途。

本机草稿与云端保存分别显示。恢复链接具有对应权限，需单独保管；清除本机资料与删除云端记录是不同操作。云端不是端到端加密。

正式入口为 `meet.tongye.ink`，`coukong.vercel.app` 保留兼容。两个域名的本机身份和缓存不共享，换入口时用本人恢复链接找回身份。当前生产 API 构建为 `bba05f27c87ea676a1b8a870185d7e64f4f7e4e0`；文档部署可以采用更新的前端提交。实际验证范围与待验项见发布记录。
