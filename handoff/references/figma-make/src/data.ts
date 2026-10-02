// 所有内容均为【示例数据】，不代表任何真实活动或官方场次
export type EventKind = "convention" | "activity"
export type Ev = {
  id: string
  name: string
  kind: EventKind
  dates: string[]
  place: string
  city: string
  hasMap: boolean
  private?: boolean
  tag: string
}
export const EVENTS: Ev[] = [
  {
    id: "e1",
    name: "示例·春日同人展 S01",
    kind: "convention",
    dates: ["10-18", "10-19"],
    place: "示例会展中心 2 号馆",
    city: "上海",
    hasMap: true,
    tag: "同人展",
  },
  {
    id: "e2",
    name: "示例·城市徒步日",
    kind: "activity",
    dates: ["10-25"],
    place: "示例滨江步道",
    city: "杭州",
    hasMap: true,
    tag: "户外活动",
  },
  {
    id: "e3",
    name: "示例·独立游戏市集",
    kind: "convention",
    dates: ["11-08", "11-09"],
    place: "示例创意园 B 区",
    city: "广州",
    hasMap: false,
    tag: "市集",
  },
  {
    id: "e4",
    name: "示例·社团内部茶会",
    kind: "activity",
    dates: ["11-15"],
    place: "地点仅成员可见",
    city: "成都",
    hasMap: false,
    private: true,
    tag: "私密",
  },
]

export type Booth = {
  id: string
  code: string
  name: string
  circle: string
  desc: string
  x: number
  y: number
  hall: string
  sessions: {
    id: string
    title: string
    date: string
    start: number
    end: number
  }[]
}
const m = (h: number, mi: number) => h * 60 + mi
export const BOOTHS: Booth[] = [
  {
    id: "b1",
    code: "A-03",
    name: "示例社团「青苔」",
    circle: "原创插画",
    desc: "示例：明信片与小画册，现场限量手绘签。",
    x: 18,
    y: 22,
    hall: "A 区",
    sessions: [
      {
        id: "s1",
        title: "示例·现场手绘签",
        date: "10-18",
        start: m(13, 7),
        end: m(13, 52),
      },
    ],
  },
  {
    id: "b2",
    code: "A-11",
    name: "示例社团「北纬」",
    circle: "摄影集",
    desc: "示例：城市夜景摄影集与胶片周边。",
    x: 42,
    y: 20,
    hall: "A 区",
    sessions: [],
  },
  {
    id: "b3",
    code: "B-06",
    name: "示例社团「纸飞机」",
    circle: "手作",
    desc: "示例：手工书签、纸艺与拼贴本。",
    x: 70,
    y: 28,
    hall: "B 区",
    sessions: [
      {
        id: "s2",
        title: "示例·纸艺体验",
        date: "10-18",
        start: m(14, 30),
        end: m(15, 15),
      },
    ],
  },
  {
    id: "b4",
    code: "B-21",
    name: "示例社团「慢车」",
    circle: "小说本",
    desc: "示例：短篇合集与试读本。",
    x: 80,
    y: 58,
    hall: "B 区",
    sessions: [],
  },
  {
    id: "b5",
    code: "C-02",
    name: "示例舞台区",
    circle: "舞台",
    desc: "示例：舞台节目时间以现场公告为准。",
    x: 30,
    y: 70,
    hall: "C 区",
    sessions: [
      {
        id: "s3",
        title: "示例·乐队演出",
        date: "10-18",
        start: m(15, 40),
        end: m(16, 25),
      },
      {
        id: "s4",
        title: "示例·闭幕交流",
        date: "10-19",
        start: m(16, 0),
        end: m(16, 45),
      },
    ],
  },
  {
    id: "b6",
    code: "C-14",
    name: "示例社团「方糖」",
    circle: "桌游",
    desc: "示例：原创桌游试玩，每局约 20 分钟。",
    x: 55,
    y: 78,
    hall: "C 区",
    sessions: [],
  },
]

export const fmt = (t: number) =>
  `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`
export const parse = (s: string) => {
  const r = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
  if (!r) return null
  const h = +r[1],
    mi = +r[2]
  return h < 24 && mi < 60 ? h * 60 + mi : null
}

export type SyncStatus = "local" | "pending" | "submitted" | "unconfirmed" | "review"
export const STATUS: Record<SyncStatus, {
  label: string
  tone: "neutral" | "warn" | "teal" | "danger"
}> = {
  local: { label: "已本地保存", tone: "neutral" },
  pending: { label: "待联网", tone: "warn" },
  submitted: { label: "已提交", tone: "teal" },
  unconfirmed: { label: "未确认", tone: "warn" },
  review: { label: "需复核", tone: "danger" },
}
export type Item = {
  id: string
  title: string
  boothId?: string
  date: string
  start: number
  end: number
  place: string
  status: SyncStatus
  shared: boolean
}
