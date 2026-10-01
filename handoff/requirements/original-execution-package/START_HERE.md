# 凑空 agent 执行包

## 如何使用

将本目录整体交给能操作 `Xinglan233/coukong` 的 coding agent，要求它先完整阅读 `PROMPT.md`，再实施。也可以只发送 `PROMPT.md`：它包含完整上下文、规范与关键 JSON 示例，不依赖这次聊天。

建议启动消息：

&gt; 请完整阅读附件 PROMPT.md，按其中已确认的需求直接改造 Xinglan233/coukong。不要只做方案或原型。时间选择默认 15 分钟，可切 5 分钟，手填/JSON/算法精确到分钟。先打通真实多人闭环，再完成 JSON 导入、帮助文档、迁移、测试和免费部署；目标在 2026-10-03（Asia/Shanghai）使用前可用。先检查权限，缺少外部凭据时只列必要操作，不伪造部署或测试结果。

## 文件

- `PROMPT.md`：完整执行提示词，包含范围、权限、数据合同、分钟算法、分阶段任务、文档清单和发布测试矩阵。
- `schemas/event-package.v1.schema.json`：活动包结构规范，JSON Schema Draft 2020-12。
- `examples/`：3 个有效示例。
- `fixtures/invalid/`：9 个应被拒绝的错误输入，仅用于测试。
- `fixtures/expected-results.json`：错误样例的预期失败阶段。
- `HANDOFF_CHECKS.md`：本执行包的静态校验记录，不是网站上线验收报告。

## 特别注意

REDLAND 模板没有真实场次。09:00–21:00 是待确认默认值，不是官方数据。不要把测试夹具导入正式活动。

Schema 不能单独验证日期覆盖、重复业务 ID、起止顺序、场次归属与时区业务规则；必须完成 PROMPT.md 定义的前后端一致语义校验。

本执行包没有替用户创建 Cloudflare 账户或部署资源，也没有修改 GitHub 仓库。
