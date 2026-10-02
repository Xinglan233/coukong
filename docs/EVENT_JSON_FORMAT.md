# 活动 JSON 格式

下表说明兼容v1（UTF-8，最大512KiB）；v2见文末。不接受注释、尾逗号、重复对象键、未知字段或远程 Schema。活动包只含活动资料，不能授予权限，也不能混入成员回复。结构与业务由前后端共享校验器再次验证。

## root

| 字段 | 类型 | 必填 | 限制 |
| --- | --- | --- | --- |
| kind | string | 是 | const="coukong.event" |
| schemaVersion | integer | 是 | const=1 |
| event | object | 是 | event |
| meta | object | 否 | meta |

## event

| 字段 | 类型 | 必填 | 限制 |
| --- | --- | --- | --- |
| id | string | 是 | pattern="^[a-z0-9][a-z0-9_-]{0,63}$" |
| title | string | 是 | minLength=1; maxLength=100 |
| description | string | 否 | maxLength=5000 |
| timezone | string | 是 | minLength=1; maxLength=100 |
| startDate | string | 是 | pattern="^\\d{4}-\\d{2}-\\d{2}$"; format="date" |
| endDate | string | 是 | pattern="^\\d{4}-\\d{2}-\\d{2}$"; format="date" |
| location | string | 否 | maxLength=200 |
| defaultBufferMinutes | integer | 是 | minimum=0; maximum=120 |
| defaultMinSlotMinutes | integer | 是 | minimum=1; maximum=240 |
| defaultSelectionStepMinutes | integer | 是 | enum=[5, 10, 15, 30] |
| days | array | 是 | minItems=1; maxItems=31; items=day |
| activities | array | 是 | maxItems=1000; items=activity |

## day

| 字段 | 类型 | 必填 | 限制 |
| --- | --- | --- | --- |
| date | string | 是 | pattern="^\\d{4}-\\d{2}-\\d{2}$"; format="date" |
| openIntervals | array | 是 | maxItems=24; items=interval |

## interval

| 字段 | 类型 | 必填 | 限制 |
| --- | --- | --- | --- |
| start | string | 是 | pattern="^(?:[01]\\d\|2[0-3]):[0-5]\\d$" |
| end | string | 是 | pattern="^(?:(?:[01]\\d\|2[0-3]):[0-5]\\d\|24:00)$" |

## activity

| 字段 | 类型 | 必填 | 限制 |
| --- | --- | --- | --- |
| id | string | 是 | pattern="^[a-z0-9][a-z0-9_-]{0,63}$" |
| title | string | 是 | minLength=1; maxLength=100 |
| description | string | 否 | maxLength=5000 |
| location | string | 否 | maxLength=200 |
| tags | array | 否 | maxItems=10; uniqueItems=true; items=string |
| sessions | array | 是 | minItems=1; maxItems=1000; items=session |

## session

| 字段 | 类型 | 必填 | 限制 |
| --- | --- | --- | --- |
| id | string | 是 | pattern="^[a-z0-9][a-z0-9_-]{0,63}$" |
| date | string | 是 | pattern="^\\d{4}-\\d{2}-\\d{2}$"; format="date" |
| start | string | 是 | pattern="^(?:[01]\\d\|2[0-3]):[0-5]\\d$" |
| end | string | 是 | pattern="^(?:(?:[01]\\d\|2[0-3]):[0-5]\\d\|24:00)$" |
| location | string | 否 | maxLength=200 |

## meta

| 字段 | 类型 | 必填 | 限制 |
| --- | --- | --- | --- |
| isExample | boolean | 否 |  |
| sourceNote | string | 否 | maxLength=1000 |

## 业务规则与默认值

必填字段不会由导入器悄悄补齐。普通创建 UI 默认 Asia/Shanghai、缓冲 0、最短 30、步长 15；展会可用缓冲 10，导入以包中的合法值为准。title 去首尾空格后不为空；标签不能空白、重复。id 为稳定外部标识，不是服务器权限。

日期必须在 1900–2100 年内真实有效，endDate 不早于 startDate，最长 31 天；范围内日期恰好一条，关闭日 openIntervals 为 []。每天开放区间最多 24 段，按升序且不重叠，相邻可合并。IANA 时区有效，DST 过渡日及相邻日期拒绝。interval 左闭右开，end 晚于 start，24:00 仅允许作结束。跨午夜必须拆两日。

最多 1000 活动、整个包总计 1000 场次，每活动至少一场。活动 ID 包内唯一、场次 ID 全包唯一；场次完全落在该日某个开放区间内。不同活动并行场次合法。选择步长不改变手动/JSON 分钟；13:07–13:52 是 45 分钟。

## 复制使用的最小包

```json
{
  "kind": "coukong.event",
  "schemaVersion": 1,
  "event": {
    "id": "weekend-meetup-demo",
    "title": "周末碰面示例",
    "timezone": "Asia/Shanghai",
    "startDate": "2026-10-03",
    "endDate": "2026-10-03",
    "defaultBufferMinutes": 0,
    "defaultMinSlotMinutes": 30,
    "defaultSelectionStepMinutes": 15,
    "days": [
      {
        "date": "2026-10-03",
        "openIntervals": [
          {
            "start": "13:00",
            "end": "20:00"
          }
        ]
      }
    ],
    "activities": []
  },
  "meta": {
    "isExample": true,
    "sourceNote": "格式示例，不是正式活动安排。"
  }
}
```

## 下载与来源

- [最小模板](../examples/event-minimal.json)：不带场次。
- [完整示例](../examples/event-demo.json)：多个开放范围、09:05 与 13:07–13:52 虚构场次。
- [REDLAND 五天框架](../examples/redland-2026-template.json)：2026-10-02 至 10-06；09:00–21:00 只是待确认默认值，暂无官方场次，不得冒充官方数据。
- [机器 Schema](../schemas/event-package.v1.schema.json)：Draft 2020-12，结构检查不能替代业务检查。

## 更新、导出与错误

上传/粘贴 → 校验 → 预览标题、日期、开放、场次数、来源和变更 → 明确确认 → 服务端再次校验、CAS 原子提交 → 回读。event.id 无法越权指定小队。expectedRevision 过期返回 409，须重新预览。整包替换，任一非法则不写入；重复无变化导入不会增生场次。

活动导出可无损回导同版本且无成员、令牌和内部主键。个人备份是另一 kind，旧备份另用兼容入口。时间结构改动保留原回复并要求复核，纯标题说明变化不影响确认。

例如 09:60（非法分钟）、23:30–00:30（同日倒序）、重复场次 id、缺失日期、场次跨午休开放范围、空白标题或未知结构版本都拒绝。错误含稳定码、字段路径和中文说明。重复对象键在解析阶段拒绝，不能后值覆盖前值。九个 [错误夹具](../tests/fixtures/invalid) 仅用于测试，绝不导入正式活动。

## v2与地图替换（本轮分支，云端待验）

v2采用 [v2 Schema](../schemas/event-package.v2.schema.json)，包上限1MiB。通用示例为 [event-generic.v2.json](../examples/event-generic.v2.json)，带地图和通道的 [convention-demo.v2.json](../examples/convention-demo.v2.json) 及其PNG均为自绘虚构测试资料，不能当作REDLAND官方资料。v1仍按原格式验证，不接受v2字段混入v1。

地图内容身份包含assetKey、SHA-256、字节数、MIME、地图与资源宽高。任何一项改变，地图 `revision` 必须递增，不能以相同文件名掩盖替换。已有点位或通道时，替换首轮必须设置 `needsReview:true`，保留旧引用并重新校对；缺少版本递增或复核标记分别拒绝为MAP_REVISION_REQUIRED或MAP_REVIEW_REQUIRED。

先保存新底图，再在校对流程确认点位与通道，完成复核后才能启用。等比例重采样可以保留归一化坐标，但仍必须经过明确保存与重新核对；不得因为比例不变就绕过复核。只有已确认、版本相符的通道用于路线，资料不全时保留站点清单，不把直线当可走路线。
