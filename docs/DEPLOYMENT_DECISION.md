# 部署决策

## 当前架构

保留Vite、React和TypeScript。Vercel部署前端并运行薄Node媒体入口；Cloudflare Worker处理权限与业务API，D1持久保存活动、个人计划和小队回复；两个私有Blob分别保存生产和测试地图。本机IndexedDB保存草稿与离线快照。

前端与Worker共用DTO、校验和分钟纯函数。图片直传私有隔离位置，Node可信处理成功后才提交引用；数据库与媒体不是同一事务，版本与引用分别核对。

## 环境和费用

生产与测试使用独立D1、Worker、私有Blob和精确OIDC subject。预览不写生产，不采用跨环境双写。每环境媒体应用预算256MiB，两个环境共512MiB；平台流量、操作和其他存储仍需独立观察。

仅使用免费计划，不自动升级。Vercel Hobby限个人非商业用途，配额见 [运维说明](OPERATIONS.md)。R2未启用，不为免费额度开通可能自动计费的订阅。

正式入口 `meet.tongye.ink`，旧入口 `coukong.vercel.app` 保留。不同域名的本机身份与缓存互相独立，换入口用本人恢复链接。

## 未提供的部署方式

自托管、GPS自动定位和跨图自动导航属于后续范围。当前没有可验收的Docker或独立服务器版本；使用现有托管服务无需购买服务器。

配置与维护步骤见 [部署指南](DEPLOYMENT.md)，实际发布证据见 [发布记录](RELEASE_CHECKLIST.md)。
