# 发布检查与证据

## 当前生产

- 正式入口：[meet.tongye.ink](https://meet.tongye.ink)。兼容入口：[coukong.vercel.app](https://coukong.vercel.app)。
- 活动：[REDLAND 2026](https://meet.tongye.ink/events/redland-2026)。
- 功能与 API 构建：`bba05f27c87ea676a1b8a870185d7e64f4f7e4e0`，2026-10-02 UTC 发布。
- 前端纯文档部署可使用更新提交；API 构建保持上述版本，部署元数据分别核对。
- 生产迁移0001–0008已应用，原小队与成员保留。生产与预发布使用独立D1和私有Blob。

## 自动化证据

| 范围 | 固定源码 | 单元 / 本地D1 / 浏览器 | CI |
| --- | --- | --- | --- |
| 活动、个人计划、地图完整功能发布 | ee1ae573dee26ee7a6f10d779f9480dc3ab7f2ac | 140 / 67 / 90 | [verify](https://github.com/Xinglan233/tongye_meet/actions/runs/37012656315)、[CodeQL](https://github.com/Xinglan233/tongye_meet/actions/runs/37012692964) |
| 正式域名路由与CORS修复 | 3eb6ba969b56ce9541b81749ab6569152f71e60c，合并bba05f2 | 148 / 67 / 90 | [verify](https://github.com/Xinglan233/tongye_meet/actions/runs/37021313547)、[CodeQL](https://github.com/Xinglan233/tongye_meet/actions/runs/37021310226) |

域名修复新增8项测试覆盖精确生产host、未知host留在测试环境、Worker预检与媒体同源检查。浏览器90项来自该固定提交的一次完整CI运行，自动化视口不等于手机真机。

## 生产实际核验

- [x] 两个公开入口的 `/api/v1/ready` 均200，返回同一bba完整构建标识和真实数据库就绪。
- [x] 两个入口的公开活动列表内容一致，正式入口没有读取测试活动。
- [x] REDLAND公开显示图200，实际字节与发布元数据SHA-256一致。
- [x] 正式HTTPS origin写入预检204；HTTP活动入口308到HTTPS，保留路径和查询参数。
- [x] 正常已登录Safari完成REDLAND资料导入、JPEG净化上传、绑定和发布，实际活动与地图可打开。
- [x] 数据库发布前与REDLAND发布后导出；发布后SQL在本机隔离恢复、外键和业务资料核对通过。
- [x] 公开浏览器通过“保存后更新”加载PWA新版界面，无清空网站数据；该记录属于已执行更新验证，不替代所有设备冷启动。

REDLAND公开资料为41个活动、998个场次、87个未定位地点、1张地图、0条路网。公开显示图核验不等于净化源图的完整媒体备份。

## 隔离环境证据

已执行管理员媒体发布、独立个人保存、队长及两队员分钟填写、权限拒绝、SQL云端隔离恢复、媒体新路径恢复和历史引用备份。证据对应各自的隔离部署，不能替代当前生产的完整三角色演练。

## 待验与资料缺口

- [ ] 当前生产版本三个独立浏览器身份的完整创建、填写、修改链路。
- [ ] 当前生产净化源图与显示图的完整受控媒体备份；需维护者提供合法受控管理员会话文件。
- [ ] 中国大陆手机、微信、现场弱网、真机PWA冷启动与恢复。
- [ ] 最大复杂图片、全部媒体云端拒绝矩阵、Workers真实CPU/内存及现场同WiFi规模。
- [ ] REDLAND闭馆、A02/C04时段、真实地点坐标与确认通道。

软件功能状态见 [功能状态](ACTIVITY_P0_STATUS.md)，测试命令见 [测试](TESTING.md)。每次发布记录前端提交、Worker构建、部署ID、备份校验和及实际核验范围；私人备份路径和恢复入口通过安全方式交付，不放公开文档。
