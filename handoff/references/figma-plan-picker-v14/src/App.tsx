import { useMemo, useState } from "react"
import {
  BOOTHS,
  EVENTS,
  STATUS,
  fmt,
  parse,
  type Booth,
  type Ev,
  type Item,
  type SyncStatus,
} from "./data"
import { Badge, Btn, Empty, Group, I, Row, Sample, Seg, Toggle } from "./ui"

type Tab = "explore" | "plan" | "team" | "me"

type BoothSheetState = {
  t: "booth"
  id: string
}

type TimeSheetState = {
  t: "time"
  id: string
}

type PresenceSheetState = {
  t: "presence"
  date: string
}

type AddScheduleSheetState = {
  t: "add_schedule"
  date: string
}

type NewTimeSheetState = {
  t: "new_time"
  title: string
  place: string
  date: string
  start?: number
  end?: number
  boothId?: string
}

type AddScheduleBoothItem = {
  t: "booth"
  b: Booth
}

type AddScheduleSessionItem = {
  t: "session"
  b: Booth
  s: Booth["sessions"][number]
}

type AddScheduleItem = AddScheduleBoothItem | AddScheduleSessionItem

type TimeDraft = {
  title: string
  s: string
  e: string
  place: string
}

type Sheet = BoothSheetState | TimeSheetState | PresenceSheetState | AddScheduleSheetState | NewTimeSheetState | {
  t: "switch"
} | { t: "invite" } | null

type Team = {
  name: string
  leader: boolean
  code: string
}

type TimeSlot = {
  id: string
  s: number
  e: number
}
type PresenceState = {
  state: "unknown" | "absent" | "present"
  slots: TimeSlot[]
  sync: "draft" | "confirmed" | "review"
}

type EventStore = {
  saved: Set<string>
  items: Item[]
  route: string[]
  done: Set<string>
  team: Team | null
  presence: Record<string, PresenceState>
}

const SEED: Item[] = [
  {
    id: "i1",
    title: "示例·现场手绘签",
    boothId: "b1",
    date: "10-18",
    start: 13 * 60 + 7,
    end: 13 * 60 + 52,
    place: "A-03",
    status: "submitted",
    shared: true,
  },
  {
    id: "i2",
    title: "示例·纸艺体验",
    boothId: "b3",
    date: "10-18",
    start: 13 * 60 + 40,
    end: 14 * 60 + 25,
    place: "B-06",
    status: "local",
    shared: false,
  },
  {
    id: "i3",
    title: "和朋友碰面",
    date: "10-18",
    start: 15 * 60,
    end: 15 * 60 + 15,
    place: "2 号馆东门",
    status: "pending",
    shared: false,
  },
]

const INIT_STORE: EventStore = {
  saved: new Set(["b1", "b5"]),
  items: SEED,
  route: ["b1", "b3", "b5"],
  done: new Set(["b1"]),
  team: null,
  presence: {
    "10-18": {
      state: "present",
      slots: [{ id: "ps1", s: 13 * 60 + 7, e: 13 * 60 + 52 }],
      sync: "review",
    },
  },
}

export default function App() {
  const [dark, setDark] = useState(false)
  const [screen, setScreen] = useState<"select" | "space" | "admin">("select")
  const [evId, setEvId] = useState("e1")
  const [stores, setStores] = useState<Record<string, EventStore>>({
    e1: INIT_STORE,
  })
  const ev = EVENTS.find((e) => e.id === evId)!

  const getStore = (id: string) =>
    stores[id] || {
      saved: new Set(),
      items: [],
      route: [],
      done: new Set(),
      team: null,
      presence: {},
    }
  const updateStore = (id: string, patch: Partial<EventStore>) =>
    setStores((s) => ({ ...s, [id]: { ...getStore(id), ...patch } }))

  return (
    <div className={`${dark ? "dark" : ""} font-sans`}>
      <div className="flex min-h-screen justify-center bg-[#dfe2e6] antialiased dark:bg-[#0b0b0c] sm:items-center sm:py-8">
        <div className="relative flex h-[100dvh] w-full max-w-[402px] flex-col overflow-hidden bg-bg text-ink sm:h-[860px] sm:rounded-[44px] sm:ring-1 sm:ring-black/10">
          {screen === "select" && (
            <EventSelect
              onPick={(id) => {
                setEvId(id)
                setScreen("space")
              }}
              onAdmin={() => setScreen("admin")}
            />
          )}
          {screen === "space" && (
            <Space
              ev={ev}
              store={getStore(ev.id)}
              update={(p) => updateStore(ev.id, p)}
              setEv={setEvId}
              dark={dark}
              setDark={setDark}
              onExit={() => setScreen("select")}
              onAdmin={() => setScreen("admin")}
            />
          )}
          {screen === "admin" && (
            <Admin onBack={() => setScreen(evId ? "space" : "select")} />
          )}
        </div>
      </div>
    </div>
  )
}

/* ───────── 活动选择 ───────── */
function EventSelect({
  onPick,
  onAdmin,
}: {
  onPick: (id: string) => void
  onAdmin: () => void
}) {
  const [q, setQ] = useState("")
  const [f, setF] = useState<"all" | "convention" | "activity">("all")
  const [code, setCode] = useState("")
  const [codeState, setCodeState] = useState<"idle" | "bad" | "ok">("idle")
  const list = EVENTS.filter(
    (e) =>
      !e.private &&
      (f === "all" || e.kind === f) &&
      (e.name + e.city + e.place).includes(q),
  )
  return (
    <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-10 pt-14">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-medium tracking-wide text-teal">
          同野·游
        </span>
      </div>
      <h1 className="mb-5 text-[32px] font-bold tracking-tight">选择活动</h1>
      <label className="mb-3 flex h-10 items-center gap-2 rounded-xl bg-ink/[0.06] px-3 text-ink3">
        <I n="search" s={17} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索活动、城市或场馆"
          className="flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink3"
        />
      </label>
      <div className="mb-5">
        <Seg
          value={f}
          onChange={setF}
          options={[
            { v: "all", l: "全部" },
            { v: "convention", l: "展会" },
            { v: "activity", l: "活动" },
          ]}
        />
      </div>

      {list.length === 0 ? (
        <Empty
          icon="search"
          title="没有匹配的活动"
          sub="换个关键词，或清除筛选再试。"
          action={
            <Btn
              kind="tinted"
              onClick={() => {
                setQ("")
                setF("all")
              }}
            >
              清除筛选
            </Btn>
          }
        />
      ) : (
        <div className="space-y-3">
          {list.map((e) => (
            <button
              key={e.id}
              onClick={() => onPick(e.id)}
              className="group flex w-full items-stretch gap-4 rounded-2xl bg-surface p-4 text-left shadow-sm ring-1 ring-black/5 transition-all active:scale-[0.98] hover:shadow-md dark:ring-white/5"
            >
              <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-surface2">
                <span className="text-[11px] text-ink3">
                  {e.dates[0].slice(0, 2)}月
                </span>
                <span className="tnum text-[22px] font-semibold leading-none">
                  {e.dates[0].slice(3)}
                </span>
                {e.dates.length > 1 && (
                  <span className="tnum mt-0.5 text-[10px] text-ink3">
                    –{e.dates.at(-1)!.slice(3)}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-1.5">
                  <Badge tone={e.kind === "convention" ? "teal" : "neutral"}>
                    {e.tag}
                  </Badge>
                  <Sample />
                </div>
                <p className="truncate text-[16px] font-semibold">{e.name}</p>
                <p className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-ink2">
                  <I n="pin" s={13} />
                  {e.city} · {e.place}
                </p>
                {!e.hasMap && (
                  <p className="mt-1 text-[12px] text-warn">地图尚未发布</p>
                )}
              </div>
              <I n="chev" s={18} className="self-center text-ink3" />
            </button>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Group
          title="私密活动"
          footer="输入组织者提供的邀请码。示例：可输入 TONGYE 体验。"
        >
          <div className="flex items-center gap-2 px-4 py-2.5 transition-colors focus-within:bg-ink/[0.03]">
            <I n="lock" s={18} className="text-ink3" />
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase())
                setCodeState("idle")
              }}
              placeholder="邀请码"
              className="tnum flex-1 bg-transparent text-[16px] tracking-widest outline-none placeholder:tracking-normal placeholder:text-ink3"
            />
            <button
              disabled={!code}
              onClick={() =>
                code === "TONGYE" ? onPick("e4") : setCodeState("bad")
              }
              className="text-[15px] font-semibold text-teal transition-opacity hover:opacity-80 active:opacity-60 disabled:text-ink3"
            >
              进入
            </button>
          </div>
          {codeState === "bad" && (
            <p className="px-4 py-2 text-[13px] text-danger">
              邀请码无效或已过期，请向组织者确认。
            </p>
          )}
        </Group>
      </div>
    </div>
  )
}

/* ───────── 活动空间 ───────── */
function Space({
  ev,
  store,
  update,
  setEv,
  dark,
  setDark,
  onExit,
  onAdmin,
}: {
  ev: Ev
  store: EventStore
  update: (p: Partial<EventStore>) => void
  setEv: (id: string) => void
  dark: boolean
  setDark: (v: boolean) => void
  onExit: () => void
  onAdmin: () => void
}) {
  const [tab, setTab] = useState<Tab>("explore")
  const [sheet, setSheet] = useState<Sheet>(null)
  const { saved, items, route, done, team, presence } = store
  const [offline, setOffline] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, TimeDraft>>({})
  const [toast, setToast] = useState("")
  const flash = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(""), 1800)
  }

  const updatePresence = (date: string, patch: Partial<PresenceState>) => {
    const p = presence[date] || { state: "unknown", slots: [], sync: "draft" }
    update({ presence: { ...presence, [date]: { ...p, ...patch } } })
  }

  const toggleSaved = (id: string) => {
    const n = new Set(saved)
    n.has(id) ? n.delete(id) : n.add(id)
    flash(n.has(id) ? "已收藏 · 未加入日程或路线" : "已取消收藏")
    update({ saved: n })
  }
  const toggleRoute = (id: string) => {
    const has = route.includes(id)
    flash(has ? "已移出路线" : `已加入路线 · 第 ${route.length + 1} 站`)
    update({ route: has ? route.filter((x) => x !== id) : [...route, id] })
  }
  const addSchedule = (b: Booth, s?: Booth["sessions"][number]) => {
    setDrafts(({ new: _, ...r }) => r)
    setSheet({
      t: "new_time",
      title: s?.title ?? b.name,
      boothId: b.id,
      date: s?.date ?? ev.dates[0],
      start: s?.start,
      end: s?.end,
      place: b.code,
    })
  }
  const exploreLabel = ev.kind === "convention" ? "探索" : "活动"

  return (
    <>
      {/* 顶部活动栏 */}
      <header className="glass relative z-20 flex items-center gap-2 px-4 pb-2.5 pt-12 shadow-sm">
        <button
          onClick={onExit}
          aria-label="返回活动列表"
          className="-ml-1 grid size-9 place-items-center rounded-full text-teal transition-colors hover:bg-teal/10 active:bg-teal/20"
        >
          <I n="back" />
        </button>
        <button
          onClick={() => setSheet({ t: "switch" })}
          className="flex min-w-0 flex-1 flex-col items-start"
        >
          <span className="text-[11px] text-ink3">
            当前活动 · {ev.dates.join(" / ")}
          </span>
          <span className="flex max-w-full items-center gap-1 text-[16px] font-semibold">
            <span className="truncate">{ev.name}</span>
            <I n="down" s={14} className="shrink-0 text-ink3" />
          </span>
        </button>
        {offline && (
          <Badge tone="warn" dot>
            离线
          </Badge>
        )}
      </header>

      <main className="no-scrollbar relative flex-1 overflow-y-auto pb-28">
        {offline && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-warnsoft px-3 py-2 text-[13px] text-warn">
            <I n="wifi" s={16} /> 离线模式：改动会先本地保存，联网后再提交。
          </div>
        )}
        {tab === "explore" && (
          <Explore
            ev={ev}
            saved={saved}
            route={route}
            open={(id) => setSheet({ t: "booth", id })}
          />
        )}
        {tab === "plan" && (
          <Plan
            ev={ev}
            items={items}
            setItems={(f) => update({ items: f(items) })}
            saved={saved}
            route={route}
            setRoute={(r) => update({ route: r })}
            done={done}
            setDone={(d) => update({ done: d })}
            open={setSheet}
            team={!!team}
            presence={presence}
          />
        )}
        {tab === "team" && (
          <TeamView
            ev={ev}
            team={team}
            setTeam={(t) => update({ team: t })}
            items={items}
            setItems={(f) => update({ items: f(items) })}
            invite={() => setSheet({ t: "invite" })}
            presence={presence}
            updatePresence={updatePresence}
          />
        )}
        {tab === "me" && (
          <Me
            dark={dark}
            setDark={setDark}
            offline={offline}
            setOffline={setOffline}
            onAdmin={onAdmin}
          />
        )}
      </main>

      {/* 底部导航 */}
      <nav className="glass absolute inset-x-3 bottom-6 z-20 flex h-[64px] items-center rounded-full px-2 shadow-lg">
        {([
          [
            "explore",
            exploreLabel,
            ev.kind === "convention" ? "compass" : "star",
          ],
          ["plan", "计划", "cal"],
          ["team", "同行", "people"],
          ["me", "我的", "user"],
        ] as const).map(([k, l, ic]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex h-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-full transition-all active:scale-[0.95] ${
              tab === k
                ? "bg-teal text-white shadow-sm"
                : "text-ink2 hover:bg-ink/[0.04]"
            }`}
          >
            <I n={ic} s={22} />
            <span className="text-[10px] font-semibold">{l}</span>
          </button>
        ))}
      </nav>

      {toast && (
        <div className="glass anim-fade absolute left-1/2 top-16 z-40 -translate-x-1/2 whitespace-nowrap rounded-full px-5 py-2.5 text-[14px] font-medium shadow-lg">
          {toast}
        </div>
      )}

      {sheet && (
        <SheetShell
          onClose={() => setSheet(null)}
          title={
            sheet.t === "booth"
              ? ""
              : sheet.t === "time" || sheet.t === "new_time"
                ? "日程时间"
                : sheet.t === "presence"
                  ? `${sheet.date.replace("-", "月")}日 在场时间`
                  : sheet.t === "add_schedule"
                    ? "新增日程安排"
                    : sheet.t === "switch"
                      ? "切换活动"
                      : "邀请成员"
          }
        >
          {sheet.t === "presence" && (
            <PresenceSheet
              date={sheet.date}
              pState={
                presence[sheet.date] || {
                  state: "unknown",
                  slots: [],
                  sync: "draft",
                }
              }
              onSave={(p) => {
                updatePresence(sheet.date, p)
                setSheet(null)
                flash("已保存草稿")
              }}
            />
          )}
          {sheet.t === "booth" && (
            <BoothSheet
              b={BOOTHS.find((b) => b.id === sheet.id)!}
              saved={saved.has(sheet.id)}
              inRoute={route.indexOf(sheet.id)}
              scheduled={items.some((i) => i.boothId === sheet.id)}
              onSave={() => toggleSaved(sheet.id)}
              onRoute={() => toggleRoute(sheet.id)}
              onSchedule={(s) =>
                addSchedule(BOOTHS.find((b) => b.id === sheet.id)!, s)
              }
            />
          )}
          {sheet.t === "time" && (
            <TimeSheet
              item={items.find((i) => i.id === sheet.id)!}
              items={items}
              draft={drafts[sheet.id]}
              setDraft={(d) => setDrafts((x) => ({ ...x, [sheet.id]: d }))}
              onSave={(patch) => {
                update({
                  items: items.map((i) =>
                    i.id === sheet.id
                      ? {
                          ...i,
                          ...patch,
                          status: offline ? "pending" : "local",
                        }
                      : i,
                  ),
                })
                setDrafts(({ [sheet.id]: _, ...r }) => r)
                setSheet(null)
                flash(offline ? "已本地保存 · 待联网" : "已本地保存")
              }}
            />
          )}
          {sheet.t === "add_schedule" && (
            <AddScheduleSheet
              date={sheet.date}
              onPick={(b, s) => {
                setDrafts(({ new: _, ...r }) => r)
                setSheet({
                  t: "new_time",
                  title: s ? s.title : b.name,
                  place: b.code,
                  date: sheet.date,
                  start: s?.start,
                  end: s?.end,
                  boothId: b.id,
                })
              }}
              onCustom={() => {
                setDrafts(({ new: _, ...r }) => r)
                setSheet({
                  t: "new_time",
                  title: "",
                  place: "",
                  date: sheet.date,
                })
              }}
            />
          )}
          {sheet.t === "new_time" && (
            <TimeSheet
              item={{
                id: "new",
                title: sheet.title,
                place: sheet.place,
                date: sheet.date,
                start: sheet.start ?? 0,
                end: sheet.end ?? 0,
                status: "local",
                shared: false,
                boothId: sheet.boothId,
              }}
              items={items}
              draft={
                drafts["new"] ?? {
                  title: sheet.title,
                  s: sheet.start !== undefined ? fmt(sheet.start) : "",
                  e: sheet.end !== undefined ? fmt(sheet.end) : "",
                  place: sheet.place,
                }
              }
              setDraft={(d) => setDrafts((x) => ({ ...x, new: d }))}
              onSave={(patch) => {
                const id = "i" + Date.now()
                update({
                  items: [
                    ...items,
                    {
                      ...patch,
                      id,
                      date: sheet.date,
                      status: offline ? "pending" : "local",
                      shared: false,
                      boothId: sheet.boothId,
                    } as Item,
                  ],
                })
                setDrafts(({ new: _, ...r }) => r)
                setSheet(null)
                flash(offline ? "已本地保存 · 待联网" : "已添加日程")
              }}
            />
          )}
          {sheet.t === "switch" && (
            <div className="space-y-2 pb-4">
              {EVENTS.filter((e) => !e.private || e.id === ev.id).map((e) => (
                <button
                  key={e.id}
                  onClick={() => {
                    setEv(e.id)
                    setSheet(null)
                    setTab("explore")
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left ${
                    e.id === ev.id ? "bg-tealsoft" : "bg-surface2"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">
                      {e.name}
                    </span>
                    <span className="text-[12px] text-ink3">
                      {e.dates.join(" / ")} · {e.city}
                    </span>
                  </span>
                  {e.id === ev.id && <I n="check" className="text-teal" />}
                </button>
              ))}
              <p className="pt-1 text-center text-[12px] text-ink3">
                切换后，各活动的收藏与日程分别保留。
              </p>
            </div>
          )}
          {sheet.t === "invite" && team && (
            <div className="pb-4 text-center">
              <p className="text-[13px] text-ink2">
                分享邀请码或链接，对方加入后需你确认。
              </p>
              <p className="tnum my-5 text-[36px] font-semibold tracking-[0.3em]">
                {team.code}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Btn kind="tinted" onClick={() => flash("邀请链接已复制")}>
                  <I n="link" s={17} />
                  复制链接
                </Btn>
                <Btn onClick={() => flash("已打开分享")}>
                  <I n="share" s={17} />
                  分享
                </Btn>
              </div>
              <p className="mt-3 text-[12px] text-ink3">
                邀请码 24 小时内有效，可在团队设置中重置。
              </p>
            </div>
          )}
        </SheetShell>
      )}
    </>
  )
}

function SheetShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <button
        aria-label="关闭"
        onClick={onClose}
        className="anim-fade absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div
        className="glass anim-sheet relative max-h-[90%] overflow-y-auto rounded-t-[32px] px-5 pb-8 pt-2 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] no-scrollbar"
        style={{
          background: "color-mix(in srgb, var(--surface) 95%, transparent)",
        }}
      >
        <div className="mx-auto mb-4 mt-1 h-1.5 w-12 rounded-full bg-ink/15" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[18px] font-semibold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="grid size-8 place-items-center rounded-full bg-ink/[0.07] text-ink2 transition-colors hover:bg-ink/[0.12] active:bg-ink/[0.18]"
          >
            <I n="close" s={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ───────── 地图 ───────── */
function FloorMap({
  booths,
  saved,
  route,
  onPick,
  selected,
}: {
  booths: Booth[]
  saved: Set<string>
  route: string[]
  onPick: (id: string) => void
  selected?: string
}) {
  return (
    <div className="relative aspect-[4/3.4] overflow-hidden rounded-2xl bg-[#f4f1ea]">
      {/* 示例原图：按主办方配色保留，不做重新着色 */}
      <svg viewBox="0 0 100 85" className="absolute inset-0 size-full">
        <rect
          x="4"
          y="6"
          width="56"
          height="30"
          rx="1.5"
          fill="#cfe3d4"
          stroke="#8fb39a"
          strokeWidth=".4"
        />
        <rect
          x="62"
          y="6"
          width="34"
          height="62"
          rx="1.5"
          fill="#f3d9b8"
          stroke="#c9a175"
          strokeWidth=".4"
        />
        <rect
          x="4"
          y="54"
          width="56"
          height="27"
          rx="1.5"
          fill="#d7d4ec"
          stroke="#9f99c9"
          strokeWidth=".4"
        />
        <rect x="4" y="39" width="56" height="12" fill="#ffffff" opacity=".6" />
        <text x="6" y="11" fontSize="3" fill="#4f7a5c">
          A 区
        </text>
        <text x="64" y="11" fontSize="3" fill="#8a6338">
          B 区
        </text>
        <text x="6" y="59" fontSize="3" fill="#635c99">
          C 区
        </text>
        <text x="6" y="46" fontSize="2.6" fill="#8b8a85">
          公共通道
        </text>
        <rect x="62" y="72" width="16" height="9" fill="#e6e3dc" />
        <text x="64" y="78" fontSize="2.6" fill="#7a776f">
          东门
        </text>
      </svg>
      {booths.map((b) => {
        const ri = route.indexOf(b.id)
        const sel = selected === b.id
        return (
          <button
            key={b.id}
            onClick={() => onPick(b.id)}
            className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110 active:scale-95"
            style={{ left: `${b.x}%`, top: `${b.y}%` }}
            aria-label={b.name}
          >
            <span
              className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold shadow-sm transition-colors ${
                sel
                  ? "border-teal bg-teal text-white shadow-md ring-2 ring-teal/20"
                  : "border-black/10 bg-white text-[#222]"
              }`}
            >
              {ri >= 0 && (
                <span
                  className={`grid size-4 place-items-center rounded-full text-[9px] ${
                    sel ? "bg-white text-teal" : "bg-teal text-white"
                  }`}
                >
                  {ri + 1}
                </span>
              )}
              {b.code}
              {saved.has(b.id) && (
                <I
                  n="star"
                  s={10}
                  fill
                  className={sel ? "text-white" : "text-[#d69400]"}
                />
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ───────── 探索 ───────── */
function Explore({
  ev,
  saved,
  route,
  open,
}: {
  ev: Ev
  saved: Set<string>
  route: string[]
  open: (id: string) => void
}) {
  const [mode, setMode] = useState<"map" | "list">("map")
  const [q, setQ] = useState("")
  const [onlySaved, setOnlySaved] = useState(false)
  const [failed, setFailed] = useState(false)
  const list = BOOTHS.filter(
    (b) =>
      (!onlySaved || saved.has(b.id)) &&
      (b.name + b.code + b.circle).includes(q),
  )

  return (
    <div className="px-4 pt-3">
      <div className="mb-3 flex gap-2">
        <label className="flex h-10 flex-1 items-center gap-2 rounded-xl bg-ink/[0.06] px-3 text-ink3">
          <I n="search" s={17} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              ev.kind === "convention" ? "摊位号、社团名" : "搜索活动点"
            }
            className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink3"
          />
        </label>
        <button
          onClick={() => setOnlySaved(!onlySaved)}
          aria-pressed={onlySaved}
          className={`flex h-10 items-center gap-1 rounded-xl px-3 text-[13px] font-medium ${
            onlySaved ? "bg-tealsoft text-teal" : "bg-ink/[0.06] text-ink2"
          }`}
        >
          <I n="star" s={15} fill={onlySaved} />
          收藏
        </button>
      </div>
      <div className="mb-3">
        <Seg
          value={mode}
          onChange={setMode}
          options={[
            { v: "map", l: "地图" },
            {
              v: "list",
              l: ev.kind === "convention" ? "摊位列表" : "活动列表",
            },
          ]}
        />
      </div>

      {mode === "map" &&
        (!ev.hasMap ? (
          <Empty
            icon="map"
            title="主办方尚未发布地图"
            sub="可以先用列表浏览并收藏，地图发布后会自动显示位置。"
            action={
              <>
                <Btn kind="tinted" onClick={() => setMode("list")}>
                  查看列表
                </Btn>
                <Btn kind="plain">发布时提醒我</Btn>
              </>
            }
          />
        ) : failed ? (
          <Empty
            icon="alert"
            title="地图加载失败"
            sub="网络不稳定。已缓存的摊位信息仍可在列表中查看。"
            action={
              <>
                <Btn onClick={() => setFailed(false)}>重试</Btn>
                <Btn kind="plain" onClick={() => setMode("list")}>
                  查看列表
                </Btn>
              </>
            }
          />
        ) : (
          <>
            <FloorMap booths={list} saved={saved} route={route} onPick={open} />
            <div className="mt-2 flex items-center justify-between text-[12px] text-ink3">
              <span>点按摊位查看详情 · 数字为路线顺序</span>
              <button
                onClick={() => setFailed(true)}
                className="underline decoration-dotted"
              >
                模拟加载失败
              </button>
            </div>
          </>
        ))}
      {(mode === "list" || (mode === "map" && ev.hasMap && !failed)) && (
        <div className={mode === "map" ? "mt-5" : ""}>
          {mode === "map" && (
            <h3 className="mb-2 px-1 text-[13px] text-ink2">
              {list.length} 个{onlySaved ? "收藏" : "摊位"}
            </h3>
          )}
          {list.length === 0 ? (
            onlySaved ? (
              <Empty
                icon="star"
                title="还没有收藏"
                sub="在地图或列表中点开摊位，点按「收藏」即可。"
                action={
                  <Btn kind="tinted" onClick={() => setOnlySaved(false)}>
                    浏览全部
                  </Btn>
                }
              />
            ) : (
              <Empty
                icon="search"
                title="没有找到"
                sub="试试摊位号，例如 A-03。"
                action={
                  <Btn kind="tinted" onClick={() => setQ("")}>
                    清除搜索
                  </Btn>
                }
              />
            )
          ) : (
            <div className="overflow-hidden rounded-2xl bg-surface divide-y divide-line">
              {list.map((b) => (
                <button
                  key={b.id}
                  onClick={() => open(b.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface2"
                >
                  <span className="tnum w-11 shrink-0 rounded-lg bg-surface2 py-1.5 text-center text-[12px] font-semibold">
                    {b.code}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[15px] font-medium">
                      <span className="truncate">{b.name}</span>
                      {saved.has(b.id) && (
                        <I
                          n="star"
                          s={13}
                          fill
                          className="shrink-0 text-[#d69400]"
                        />
                      )}
                    </span>
                    <span className="text-[12px] text-ink3">
                      {b.hall} · {b.circle}
                      {b.sessions.length > 0 && ` · ${b.sessions.length} 场`}
                    </span>
                  </span>
                  {route.includes(b.id) && (
                    <Badge tone="teal">第 {route.indexOf(b.id) + 1} 站</Badge>
                  )}
                  <I n="chev" s={16} className="text-ink3" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BoothSheet({
  b,
  saved,
  inRoute,
  scheduled,
  onSave,
  onRoute,
  onSchedule,
}: {
  b: Booth
  saved: boolean
  inRoute: number
  scheduled: boolean
  onSave: () => void
  onRoute: () => void
  onSchedule: (s?: Booth["sessions"][number]) => void
}) {
  return (
    <div>
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-1.5">
          <Badge tone="teal">{b.code}</Badge>
          <Badge>{b.hall}</Badge>
          <Sample />
        </div>
        <h2 className="text-[22px] font-bold tracking-tight">{b.name}</h2>
        <p className="text-[13px] text-ink2">{b.circle}</p>
      </div>
      {/* 三个独立动作 */}
      <div className="mb-5 grid grid-cols-3 gap-2">
        {[
          { l: saved ? "已收藏" : "收藏", ic: "star", on: saved, f: onSave },
          {
            l: scheduled ? "再加一条" : "加入日程",
            ic: "cal",
            on: scheduled,
            f: () => onSchedule(),
          },
          {
            l: inRoute >= 0 ? `路线第 ${inRoute + 1} 站` : "加入路线",
            ic: "route",
            on: inRoute >= 0,
            f: onRoute,
          },
        ].map((a) => (
          <button
            key={a.l}
            onClick={a.f}
            className={`flex flex-col items-center gap-1 rounded-2xl py-3 text-[12px] font-medium transition active:scale-95 ${
              a.on ? "bg-teal text-white" : "bg-surface2 text-ink"
            }`}
          >
            <I n={a.ic} s={20} fill={a.ic === "star" && a.on} />
            {a.l}
          </button>
        ))}
      </div>
      <div className="my-5 overflow-hidden rounded-2xl bg-surface2 divide-y divide-line">
        <div className="flex gap-3 px-4 py-3">
          <I n="pin" s={18} className="text-ink3" />
          <span className="text-[14px]">
            {b.hall} · 摊位 {b.code}
          </span>
        </div>
        <div className="flex gap-3 px-4 py-3">
          <I n="list" s={18} className="text-ink3" />
          <span className="text-[14px] leading-relaxed text-ink2">
            {b.desc}
          </span>
        </div>
      </div>
      <h3 className="mb-2 text-[13px] text-ink2">相关场次</h3>
      {b.sessions.length === 0 ? (
        <p className="rounded-2xl bg-surface2 px-4 py-4 text-[13px] text-ink3">
          暂无公布的场次。
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-surface2 divide-y divide-line">
          {b.sessions.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium">{s.title}</span>
                <span className="tnum text-[12px] text-ink3">
                  {s.date} · {fmt(s.start)}–{fmt(s.end)}
                </span>
              </span>
              <button
                onClick={() => onSchedule(s)}
                className="rounded-full bg-tealsoft px-3 py-1 text-[12px] font-semibold text-teal"
              >
                排入日程
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ───────── 在场时间编辑 ───────── */
function PresenceSheet({
  date,
  pState,
  onSave,
}: {
  date: string
  pState: PresenceState
  onSave: (p: PresenceState) => void
}) {
  const [state, setState] = useState<"absent" | "present">(
    pState.state === "absent" ? "absent" : "present",
  )
  const [draftSlots, setDraftSlots] = useState(() =>
    pState.slots.length
      ? pState.slots.map((s) => ({ id: s.id, s: fmt(s.s), e: fmt(s.e) }))
      : [{ id: "n1", s: "10:00", e: "18:00" }],
  )
  const [step, setStep] = useState(15)

  const setVal = (idx: number, k: "s" | "e", v: string) => {
    const n = [...draftSlots]
    n[idx][k] = v
    setDraftSlots(n)
  }
  const nudge = (idx: number, k: "s" | "e", delta: number) => {
    const v = parse(draftSlots[idx][k])
    if (v !== null) setVal(idx, k, fmt(Math.max(0, Math.min(1439, v + delta))))
  }

  const valid = draftSlots.every(
    (d) =>
      parse(d.s) !== null && parse(d.e) !== null && parse(d.e)! > parse(d.s)!,
  )

  return (
    <div>
      <div className="mb-5">
        <Seg
          value={state}
          onChange={setState}
          options={[
            { v: "present", l: "在场" },
            { v: "absent", l: "不能参加" },
          ]}
        />
      </div>
      {state === "present" ? (
        <div className="mb-4 max-h-[50vh] space-y-4 overflow-y-auto no-scrollbar">
          {draftSlots.map((d, idx) => (
            <div key={d.id} className="rounded-[20px] bg-surface2 p-4">
              <div className="mb-3 flex items-center justify-between text-[13px] text-ink2">
                <span className="font-medium">时段 {idx + 1}</span>
                {draftSlots.length > 1 && (
                  <button
                    onClick={() =>
                      setDraftSlots(draftSlots.filter((_, i) => i !== idx))
                    }
                    className="text-danger"
                  >
                    删除
                  </button>
                )}
              </div>
              <div className="mb-3 grid grid-cols-2 gap-2">
                {(["s", "e"] as const).map((k) => (
                  <div
                    key={k}
                    className="rounded-xl bg-surface p-2.5 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/5"
                  >
                    <span className="text-[12px] text-ink3">
                      {k === "s" ? "开始" : "结束"}
                    </span>
                    <input
                      value={d[k]}
                      onChange={(e) => setVal(idx, k, e.target.value)}
                      className={`tnum mt-0.5 w-full bg-transparent text-[24px] font-semibold outline-none ${
                        parse(d[k]) === null ? "text-danger" : ""
                      }`}
                    />
                    <div className="mt-2 flex gap-1.5">
                      <button
                        onClick={() => nudge(idx, k, -step)}
                        className="flex h-7 flex-1 items-center justify-center rounded bg-surface2 text-[12px] transition active:scale-[0.96]"
                      >
                        <I n="minus" s={12} />
                        {step}
                      </button>
                      <button
                        onClick={() => nudge(idx, k, step)}
                        className="flex h-7 flex-1 items-center justify-center rounded bg-surface2 text-[12px] transition active:scale-[0.96]"
                      >
                        <I n="plus" s={12} />
                        {step}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mb-2 text-[12px] text-ink3">快捷步长</p>
              <div className="flex gap-1.5">
                {[5, 10, 15, 30].map((m) => (
                  <button
                    key={m}
                    onClick={() => setStep(m)}
                    className={`h-8 flex-1 rounded-lg text-[12px] font-medium shadow-sm ring-1 transition-colors active:scale-[0.96] ${
                      step === m
                        ? "bg-teal text-white ring-teal"
                        : "bg-surface text-ink2 ring-black/[0.04] dark:ring-white/5"
                    }`}
                  >
                    {m} 分
                  </button>
                ))}
              </div>
            </div>
          ))}
          <Btn
            kind="plain"
            className="h-11 w-full"
            onClick={() =>
              setDraftSlots([
                ...draftSlots,
                { id: "n" + Date.now(), s: "13:00", e: "14:00" },
              ])
            }
          >
            <I n="plus" s={16} /> 添加时段
          </Btn>
        </div>
      ) : (
        <p className="mb-6 mt-2 text-center text-[14px] text-ink2">
          队友将看到你本日不能参加，不参与共同空闲计算。
        </p>
      )}
      {!valid && state === "present" && (
        <p className="mb-3 rounded-xl bg-dangersoft px-3 py-2 text-[13px] text-danger">
          请输入正确的 HH:MM 格式，且结束晚于开始。
        </p>
      )}
      <Btn
        disabled={state === "present" && !valid}
        className="w-full"
        onClick={() =>
          onSave({
            state,
            slots:
              state === "present"
                ? draftSlots.map((d) => ({
                    id: d.id,
                    s: parse(d.s)!,
                    e: parse(d.e)!,
                  }))
                : [],
            sync: "draft",
          })
        }
      >
        保存
      </Btn>
    </div>
  )
}
/* ───────── 时间编辑 ───────── */
function TimeSheet({
  item,
  items,
  draft,
  setDraft,
  onSave,
}: {
  item: Partial<Item>
  items: Item[]
  draft?: TimeDraft
  setDraft: (d: TimeDraft) => void
  onSave: (p: Partial<Item>) => void
}) {
  const d = draft ?? {
    title: item.title || "",
    s: item.start !== undefined ? fmt(item.start) : "",
    e: item.end !== undefined ? fmt(item.end) : "",
    place: item.place || "",
  }
  const s = parse(d.s),
    e = parse(d.e)
  const [step, setStep] = useState(15)
  const valid = s !== null && e !== null && e > s && d.title.trim().length > 0
  const conflict = valid
    ? items.find(
        (i) =>
          i.id !== item.id &&
          i.date === item.date &&
          i.start < e! &&
          s! < i.end,
      )
    : undefined
  const set = (p: Partial<typeof d>) => setDraft({ ...d, ...p })
  const nudge = (k: "s" | "e", delta: number) => {
    const v = parse(d[k])
    if (v !== null) set({ [k]: fmt(Math.max(0, Math.min(1439, v + delta))) })
  }

  return (
    <div>
      <div className="mb-4">
        <input
          value={d.title}
          onChange={(ev) => set({ title: ev.target.value })}
          placeholder="安排标题"
          className={`w-full bg-transparent text-[18px] font-semibold tracking-tight outline-none placeholder:text-ink3 ${
            d.title.trim() === "" ? "text-danger" : ""
          }`}
        />
        <p className="mt-1 text-[13px] text-ink3">{item.date}</p>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        {(["s", "e"] as const).map((k) => (
          <div key={k} className="rounded-2xl bg-surface2 p-3">
            <span className="text-[12px] text-ink3">
              {k === "s" ? "开始" : "结束"}
            </span>
            <input
              value={d[k]}
              onChange={(ev) => set({ [k]: ev.target.value })}
              inputMode="numeric"
              className={`tnum mt-0.5 w-full bg-transparent text-[30px] font-semibold tracking-tight outline-none ${
                parse(d[k]) === null ? "text-danger" : ""
              }`}
            />
            <div className="mt-1 flex gap-1.5">
              <button
                onClick={() => nudge(k, -step)}
                className="flex h-8 flex-1 items-center justify-center rounded-lg bg-surface text-[12px] font-medium transition active:scale-[0.96]"
              >
                <I n="minus" s={13} />
                {step}
              </button>
              <button
                onClick={() => nudge(k, step)}
                className="flex h-8 flex-1 items-center justify-center rounded-lg bg-surface text-[12px] font-medium transition active:scale-[0.96]"
              >
                <I n="plus" s={13} />
                {step}
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="mb-2 text-[12px] text-ink3">快捷步长</p>
      <div className="mb-2 flex gap-1.5">
        {[5, 10, 15, 30].map((m) => (
          <button
            key={m}
            onClick={() => setStep(m)}
            className={`h-8 flex-1 rounded-full text-[13px] font-medium transition-colors active:scale-[0.96] ${
              step === m ? "bg-teal text-white" : "bg-surface2 text-ink2"
            }`}
          >
            {m} 分
          </button>
        ))}
      </div>
      {valid && (
        <p className="mb-4 text-[13px] text-ink2 tnum">时长 {e! - s!} 分钟。</p>
      )}
      {!valid && (
        <p className="mb-3 rounded-xl bg-dangersoft px-3 py-2 text-[13px] text-danger">
          请填写标题与 HH:MM 时间，且结束晚于开始。
        </p>
      )}
      {conflict && (
        <div className="mb-3 rounded-xl bg-warnsoft px-3 py-2.5 text-[13px] text-warn">
          <p className="flex items-center gap-1.5 font-semibold">
            <I n="alert" s={15} />
            与「{conflict.title}」时间重叠
          </p>
          <p className="tnum mt-0.5">
            {fmt(conflict.start)}–{fmt(conflict.end)}。可仍然保存，或调整时间。
          </p>
          <button
            onClick={() =>
              s !== null &&
              e !== null &&
              setDraft({
                ...d,
                s: fmt(conflict.end),
                e: fmt(conflict.end + (e - s)),
              })
            }
            className="mt-1.5 font-semibold underline"
          >
            改到对方结束后
          </button>
        </div>
      )}
      <label className="mb-5 flex items-center gap-3 rounded-2xl bg-surface2 px-4 py-3">
        <I n="pin" s={18} className="text-ink3" />
        <input
          value={d.place}
          onChange={(ev) => set({ place: ev.target.value })}
          placeholder="地点"
          className="flex-1 bg-transparent text-[15px] outline-none"
        />
      </label>
      <Btn
        disabled={!valid}
        className="w-full"
        onClick={() =>
          onSave({ title: d.title, start: s!, end: e!, place: d.place })
        }
      >
        保存
      </Btn>
      {draft && item.id !== "new" && (
        <p className="mt-2 text-center text-[12px] text-ink3">
          有未保存的修改 · 关闭后仍会保留
        </p>
      )}
    </div>
  )
}
/* ───────── 计划 ───────── */
function Plan({
  ev,
  items,
  setItems,
  saved,
  route,
  setRoute,
  done,
  setDone,
  open,
  team,
  presence,
}: {
  ev: Ev
  items: Item[]
  setItems: (f: (x: Item[]) => Item[]) => void
  saved: Set<string>
  route: string[]
  setRoute: (r: string[]) => void
  done: Set<string>
  setDone: (d: Set<string>) => void
  open: (s: Sheet) => void
  team: boolean
  presence: Record<string, PresenceState>
}) {
  const [sub, setSub] = useState<"schedule" | "saved" | "route">("schedule")
  const [date, setDate] = useState(ev.dates[0])
  const day = items
    .filter((i) => i.date === date)
    .sort((a, b) => a.start - b.start)
  const conflicts = new Set(
    day.flatMap((a) =>
      day
        .filter((b) => a.id !== b.id && a.start < b.end && b.start < a.end)
        .map((b) => b.id),
    ),
  )
  const next = route.find((r) => !done.has(r))

  return (
    <div className="px-4 pt-4">
      <h1 className="mb-3 text-[28px] font-bold tracking-tight">计划</h1>
      <div className="mb-4">
        <Seg
          value={sub}
          onChange={setSub}
          options={[
            { v: "schedule", l: "日程" },
            { v: "saved", l: `收藏 ${saved.size}` },
            { v: "route", l: `路线 ${route.length}` },
          ]}
        />
      </div>

      {sub === "schedule" && (
        <>
          <div className="mb-4 flex gap-2">
            {ev.dates.map((d) => (
              <button
                key={d}
                onClick={() => setDate(d)}
                className={`tnum flex-1 rounded-xl py-2 text-[14px] font-semibold ${
                  d === date ? "bg-ink text-bg" : "bg-surface text-ink2"
                }`}
              >
                {d.replace("-", "月")}日
              </button>
            ))}
          </div>

          {(() => {
            const pState = presence[date] || {
              state: "unknown",
              slots: [],
              sync: "draft",
            }
            return (
              <div className="mb-5">
                <button
                  onClick={() => open({ t: "presence", date })}
                  className="w-full flex items-center justify-between rounded-[20px] bg-surface p-4 shadow-sm ring-1 ring-black/[0.04] transition-transform active:scale-[0.98]"
                >
                  <div className="text-left flex-1 min-w-0 pr-3">
                    <span className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink2">
                      <I n="clock" s={15} />
                      本日在场时间
                      {pState.sync === "review" && (
                        <Badge tone="warn" dot>
                          资料变动，需复核
                        </Badge>
                      )}
                      {pState.sync === "draft" &&
                        pState.state !== "unknown" && (
                          <Badge tone="neutral">未同步</Badge>
                        )}
                      {pState.sync === "confirmed" && (
                        <Badge tone="teal">已确认</Badge>
                      )}
                    </span>
                    <p className="mt-1.5 text-[16px] font-semibold text-ink truncate tnum">
                      {pState.state === "absent"
                        ? "不能参加"
                        : pState.state === "present"
                          ? pState.slots
                              .map((s) => `${fmt(s.s)}–${fmt(s.e)}`)
                              .join(", ")
                          : "尚未确认，点此设置"}
                    </p>
                  </div>
                  <I n="chev" s={18} className="text-ink3/50 shrink-0" />
                </button>
              </div>
            )
          })()}
          {day.length === 0 ? (
            <Empty
              icon="cal"
              title="这一天还没有安排"
              sub="从探索中点开摊位，选择「加入日程」或排入相关场次。"
            />
          ) : (
            <div className="relative space-y-2 pl-16">
              <span className="absolute bottom-2 left-[54px] top-2 w-px bg-line" />
              {day.map((i) => (
                <div key={i.id} className="relative">
                  <span className="tnum absolute -left-16 top-3 w-12 text-right text-[13.5px] font-semibold tracking-wide">
                    {fmt(i.start)}
                  </span>
                  <span
                    className={`absolute -left-[11px] top-[17px] size-[7px] rounded-full ring-4 ring-bg ${
                      conflicts.has(i.id) ? "bg-warn" : "bg-teal"
                    }`}
                  />
                  <button
                    onClick={() => open({ t: "time", id: i.id })}
                    className="w-full rounded-2xl bg-surface p-3.5 text-left active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[15px] font-semibold">{i.title}</p>
                      <Badge tone={STATUS[i.status].tone} dot>
                        {STATUS[i.status].label}
                      </Badge>
                    </div>
                    <p className="tnum mt-1 flex items-center gap-1 text-[13px] text-ink2">
                      <I n="clock" s={13} />
                      {fmt(i.start)}–{fmt(i.end)} · {i.end - i.start} 分
                      <span className="mx-1 text-ink3">|</span>
                      <I n="pin" s={13} />
                      {i.place}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {conflicts.has(i.id) && (
                        <Badge tone="warn">时间冲突 · 点按调整</Badge>
                      )}
                      {team && (
                        <Badge tone={i.shared ? "teal" : "neutral"}>
                          {i.shared ? "已同步到团队" : "仅自己可见"}
                        </Badge>
                      )}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => open({ t: "add_schedule", date })}
            className="mt-5 flex h-11 w-full items-center justify-center gap-1.5 rounded-[20px] border border-dashed border-ink/15 text-[14.5px] font-medium text-teal transition-colors hover:bg-teal/5"
          >
            <I n="plus" s={18} />
            新增日程安排
          </button>
        </>
      )}

      {sub === "saved" &&
        (saved.size === 0 ? (
          <Empty
            icon="star"
            title="还没有收藏"
            sub="在探索页点开摊位后点按「收藏」。收藏不会自动进入日程或路线。"
          />
        ) : (
          <div className="overflow-hidden rounded-2xl bg-surface divide-y divide-line">
            {BOOTHS.filter((b) => saved.has(b.id)).map((b) => (
              <Row
                key={b.id}
                title={b.name}
                sub={`${b.code} · ${
                  route.includes(b.id) ? "已在路线中" : "未加入路线"
                } · ${
                  items.some((i) => i.boothId === b.id)
                    ? "已排日程"
                    : "未排日程"
                }`}
                onClick={() => open({ t: "booth", id: b.id })}
              />
            ))}
          </div>
        ))}

      {sub === "route" &&
        (route.length === 0 ? (
          <Empty
            icon="route"
            title="路线是空的"
            sub="在摊位详情中点按「加入路线」，按加入顺序编号。"
          />
        ) : (
          <>
            {next ? (
              <div className="mb-4 rounded-2xl bg-teal p-4 text-white">
                <p className="text-[12px] opacity-80">
                  下一站 · 第 {route.indexOf(next) + 1} 站
                </p>
                <p className="mt-0.5 text-[20px] font-bold">
                  {BOOTHS.find((b) => b.id === next)!.name}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => open({ t: "booth", id: next })}
                    className="h-9 flex-1 rounded-lg bg-white/20 text-[14px] font-semibold"
                  >
                    查看详情
                  </button>
                  <button
                    onClick={() => setDone(new Set([...done, next]))}
                    className="h-9 flex-1 rounded-lg bg-white text-[14px] font-semibold text-teal"
                  >
                    标记已到达
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-4 rounded-2xl bg-tealsoft p-4 text-[15px] font-semibold text-teal">
                路线已全部完成 🎉
              </div>
            )}
            <FloorMap
              booths={BOOTHS.filter((b) => route.includes(b.id))}
              saved={new Set()}
              route={route}
              onPick={(id) => open({ t: "booth", id })}
              selected={next}
            />
            <div className="mt-4 overflow-hidden rounded-[20px] bg-surface divide-y divide-line shadow-sm ring-1 ring-black/[0.04] dark:ring-white/5">
              {route.map((id, idx) => {
                const b = BOOTHS.find((x) => x.id === id)!
                const ok = done.has(id)
                return (
                  <div key={id} className="flex items-center gap-3 px-4 py-3">
                    <button
                      onClick={() => {
                        const n = new Set(done)
                        ok ? n.delete(id) : n.add(id)
                        setDone(n)
                      }}
                      aria-label="切换完成"
                      className={`grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-bold ${
                        ok
                          ? "bg-teal text-white"
                          : id === next
                            ? "border-2 border-teal text-teal"
                            : "bg-surface2 text-ink2"
                      }`}
                    >
                      {ok ? <I n="check" s={14} /> : idx + 1}
                    </button>
                    <button
                      onClick={() => open({ t: "booth", id })}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span
                        className={`block truncate text-[15px] font-medium ${
                          ok ? "text-ink3 line-through" : ""
                        }`}
                      >
                        {b.name}
                      </span>
                      <span className="text-[12px] text-ink3">
                        {b.code} ·{" "}
                        {ok ? "已完成" : id === next ? "下一站" : "待前往"}
                      </span>
                    </button>
                    <div className="flex flex-col">
                      <button
                        disabled={idx === 0}
                        onClick={() => {
                          const r = [...route]
                          ;[r[idx - 1], r[idx]] = [r[idx], r[idx - 1]]
                          setRoute(r)
                        }}
                        className="text-ink3 disabled:opacity-25"
                      >
                        <I n="down" s={16} className="rotate-180" />
                      </button>
                      <button
                        disabled={idx === route.length - 1}
                        onClick={() => {
                          const r = [...route]
                          ;[r[idx + 1], r[idx]] = [r[idx], r[idx + 1]]
                          setRoute(r)
                        }}
                        className="text-ink3 disabled:opacity-25"
                      >
                        <I n="down" s={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ))}
    </div>
  )
}

/* ───────── 同行 ───────── */
const MEMBERS = [
  { n: "你", s: "confirmed" },
  { n: "示例·阿青", s: "confirmed" },
  { n: "示例·小满", s: "unconfirmed" },
  { n: "示例·Rui", s: "pending" },
] as const

function TeamView({
  ev,
  team,
  setTeam,
  items,
  setItems,
  invite,
  presence,
  updatePresence,
}: {
  ev: Ev
  team: Team | null
  setTeam: (t: Team | null) => void
  items: Item[]
  setItems: (f: (x: Item[]) => Item[]) => void
  invite: () => void
  presence: Record<string, PresenceState>
  updatePresence: (date: string, patch: Partial<PresenceState>) => void
}) {
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const shared = useMemo(() => items.filter((i) => i.shared), [items])

  if (!team)
    return (
      <div className="px-4 pt-4">
        <h1 className="mb-1 text-[28px] font-bold tracking-tight">同行</h1>
        <p className="mb-5 text-[14px] text-ink2">
          不组队也能完整使用收藏、日程与路线。组队后可查看共同空闲时间。
        </p>
        <Group title="创建团队" footer="你将成为队长，可管理成员与邀请。">
          <div className="flex items-center gap-2 px-4 py-2.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="团队名称，如：周六小分队"
              className="flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink3"
            />
            <button
              disabled={!name}
              onClick={() => setTeam({ name, leader: true, code: "K7Q2M9" })}
              className="text-[15px] font-semibold text-teal disabled:text-ink3"
            >
              创建
            </button>
          </div>
        </Group>
        <Group
          title="加入团队"
          footer="加入后需队长确认；你的个人计划不会自动同步。"
        >
          <div className="flex items-center gap-2 px-4 py-2.5">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="6 位邀请码"
              className="tnum flex-1 bg-transparent text-[16px] tracking-widest outline-none placeholder:tracking-normal placeholder:text-ink3"
            />
            <button
              disabled={code.length < 6}
              onClick={() =>
                setTeam({ name: "示例·周末同行", leader: false, code })
              }
              className="text-[15px] font-semibold text-teal disabled:text-ink3"
            >
              加入
            </button>
          </div>
        </Group>
      </div>
    )

  return (
    <div className="px-4 pt-4">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-[13px] text-ink2">
            {team.leader ? "你是队长" : "成员"}
          </p>
          <h1 className="text-[28px] font-bold tracking-tight">{team.name}</h1>
        </div>
        {team.leader && (
          <Btn kind="tinted" onClick={invite} className="h-9 px-3 text-[14px]">
            <I n="plus" s={16} />
            邀请
          </Btn>
        )}
      </div>

      <Group
        title="共同空闲 · 10月18日"
        footer="根据已同步到团队的日程计算，未同步的安排不参与。"
      >
        <div className="px-4 py-4">
          <div className="relative h-8 overflow-hidden rounded-lg bg-surface2">
            {[
              [0, 18],
              [36, 52],
              [78, 100],
            ].map(([a, b]) => (
              <span
                key={a}
                className="absolute inset-y-0 bg-tealsoft"
                style={{ left: `${a}%`, width: `${b - a}%` }}
              />
            ))}
            {shared.map((i) => (
              <span
                key={i.id}
                className="absolute inset-y-1.5 rounded bg-ink/15"
                style={{
                  left: `${((i.start - 600) / 480) * 100}%`,
                  width: `${((i.end - i.start) / 480) * 100}%`,
                }}
              />
            ))}
          </div>
          <div className="tnum mt-1 flex justify-between text-[10px] text-ink3">
            <span>10:00</span>
            <span>12:00</span>
            <span>14:00</span>
            <span>16:00</span>
            <span>18:00</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone="teal">10:00–11:26</Badge>
            <Badge tone="teal">12:53–14:10</Badge>
            <Badge tone="teal">16:14–18:00</Badge>
          </div>
        </div>
      </Group>

      <Group title={`成员 ${MEMBERS.length}`}>
        {MEMBERS.map((m) => (
          <div key={m.n} className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-8 place-items-center rounded-full bg-surface2 text-[13px] font-semibold">
              {m.n.slice(-1)}
            </span>
            <span className="flex-1 text-[15px]">{m.n}</span>
            {m.s === "confirmed" && (
              <Badge tone="teal" dot>
                已确认
              </Badge>
            )}
            {m.s === "unconfirmed" && (
              <Badge tone="warn" dot>
                未确认
              </Badge>
            )}
            {m.s === "pending" &&
              (team.leader ? (
                <button className="rounded-full bg-teal px-3 py-1 text-[12px] font-semibold text-white">
                  通过申请
                </button>
              ) : (
                <Badge>待队长通过</Badge>
              ))}
          </div>
        ))}
      </Group>

      <Group
        title="同步给队伍"
        footer="同步后，队友可见你的在场时间与安排，并计入共同空闲。草稿或修改后的资料需要你主动确认后才会更新给团队。"
      >
        {ev.dates.map((d) => {
          const p = presence[d] || {
            state: "unknown",
            slots: [],
            sync: "draft",
          }
          const needsSync = p.state !== "unknown" && p.sync !== "confirmed"
          return (
            <Row
              key={d}
              title={`${d} 在场时间`}
              sub={
                p.state === "unknown"
                  ? "未设置"
                  : p.state === "absent"
                    ? "不能参加"
                    : p.slots.map((s) => `${fmt(s.s)}–${fmt(s.e)}`).join(", ")
              }
              right={
                p.state === "unknown" ? (
                  <Badge>待完善</Badge>
                ) : needsSync ? (
                  <Btn
                    kind="tinted"
                    className="h-8 px-3 text-[13px]"
                    onClick={() => updatePresence(d, { sync: "confirmed" })}
                  >
                    {p.sync === "review" ? "确认更新" : "同步并确认"}
                  </Btn>
                ) : (
                  <Badge tone="teal">已确认</Badge>
                )
              }
            />
          )
        })}
        {items.map((i) => (
          <Row
            key={i.id}
            title={i.title}
            sub={
              <span className="tnum">
                {i.date} · {fmt(i.start)}–{fmt(i.end)}
              </span>
            }
            right={
              <Toggle
                on={i.shared}
                onChange={(v) =>
                  setItems((x) =>
                    x.map((y) => (y.id === i.id ? { ...y, shared: v } : y)),
                  )
                }
              />
            }
          />
        ))}
      </Group>
      <Btn kind="danger" className="mb-4 w-full" onClick={() => setTeam(null)}>
        {team.leader ? "解散团队" : "退出团队"}
      </Btn>
    </div>
  )
}

/* ───────── 我的 ───────── */
function Me({
  dark,
  setDark,
  offline,
  setOffline,
  onAdmin,
}: {
  dark: boolean
  setDark: (v: boolean) => void
  offline: boolean
  setOffline: (v: boolean) => void
  onAdmin: () => void
}) {
  const [pack, setPack] = useState<"none" | "loading" | "ready">("none")
  return (
    <div className="px-4 pt-4">
      <h1 className="mb-4 text-[28px] font-bold tracking-tight">我的</h1>
      <div className="mb-6 flex items-center gap-3 rounded-2xl bg-surface p-4">
        <span className="grid size-14 place-items-center rounded-full bg-tealsoft text-[20px] font-semibold text-teal">
          野
        </span>
        <div className="flex-1">
          <p className="text-[17px] font-semibold">示例用户</p>
          <p className="text-[13px] text-ink3">
            本机数据 · 上次备份 09-30 21:14
          </p>
        </div>
      </div>
      <Group title="账户与恢复">
        <Row
          icon="key"
          title="恢复码"
          sub="换设备时用于找回本地数据"
          onClick={() => {}}
        />
        <Row
          icon="shield"
          tint="bg-[#5e6ad2]"
          title="绑定手机号"
          sub="可选"
          onClick={() => {}}
        />
      </Group>
      <Group title="数据">
        <Row
          icon="download"
          tint="bg-[#3b82c4]"
          title="导入 / 导出"
          sub="JSON 或日历 .ics 文件"
          onClick={() => {}}
        />
        <Row
          icon="cloud"
          tint="bg-[#7a8796]"
          title="离线包"
          sub={
            pack === "ready"
              ? "地图与摊位已缓存 · 4.2 MB"
              : pack === "loading"
                ? "下载中…"
                : "未下载"
          }
          right={
            pack === "none" ? (
              <button
                onClick={() => {
                  setPack("loading")
                  setTimeout(() => setPack("ready"), 1400)
                }}
                className="text-[14px] font-semibold text-teal"
              >
                下载
              </button>
            ) : pack === "ready" ? (
              <Badge tone="teal">已就绪</Badge>
            ) : (
              <Badge tone="warn">下载中</Badge>
            )
          }
        />
        <Row
          icon="wifi"
          tint="bg-[#b26a00]"
          title="模拟离线"
          sub="预览离线状态"
          right={<Toggle on={offline} onChange={setOffline} />}
        />
      </Group>
      <Group title="外观">
        <Row
          icon="moon"
          tint="bg-[#3a3f47]"
          title="深色模式"
          right={<Toggle on={dark} onChange={setDark} />}
        />
      </Group>
      <Group title="其他">
        <Row
          icon="help"
          tint="bg-[#8b96a3]"
          title="帮助与反馈"
          onClick={() => {}}
        />
        <Row
          icon="gear"
          tint="bg-[#525b66]"
          title="管理员入口"
          sub="管理活动、地图、摊位与场次"
          onClick={onAdmin}
        />
      </Group>
    </div>
  )
}

/* ───────── 管理员 ───────── */
function Admin({ onBack }: { onBack: () => void }) {
  const [sec, setSec] = useState<"info" | "map" | "booth" | "session">("info")
  const [preview, setPreview] = useState(false)
  const [name, setName] = useState("示例·春日同人展 S01")
  const [dirty, setDirty] = useState(false)
  const [pub, setPub] = useState<SyncStatus>("submitted")
  const sessions = BOOTHS.flatMap((b) =>
    b.sessions.map((s, i) => ({
      ...s,
      booth: b.code,
      st: (["submitted", "review", "unconfirmed", "local"] as SyncStatus[])[
        (b.code.charCodeAt(0) + i) % 4
      ],
    })),
  )

  return (
    <>
      <header className="glass relative z-20 px-4 pb-3 pt-12 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="-ml-1 grid size-9 place-items-center rounded-full text-teal transition-colors hover:bg-teal/10 active:bg-teal/20"
          >
            <I n="back" />
          </button>
          <div className="flex-1">
            <p className="text-[11px] text-ink3">管理员 · 主办方工作台</p>
            <p className="truncate text-[16px] font-semibold">{name}</p>
          </div>
          <Badge tone={STATUS[pub].tone} dot>
            {dirty ? "有未发布修改" : STATUS[pub].label}
          </Badge>
        </div>
        <div className="mt-3">
          <Seg
            value={preview ? "p" : "e"}
            onChange={(v) => setPreview(v === "p")}
            options={[
              { v: "e", l: "编辑" },
              { v: "p", l: "预览" },
            ]}
          />
        </div>
      </header>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 py-3">
        {([
          ["info", "活动信息"],
          ["map", "地图"],
          ["booth", "摊位"],
          ["session", "场次"],
        ] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setSec(k)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium ${
              sec === k ? "bg-ink text-bg" : "bg-surface text-ink2"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      <main className="no-scrollbar flex-1 overflow-y-auto px-4 pb-28">
        {preview && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-tealsoft px-3 py-2 text-[13px] text-teal">
            <I n="eye" s={16} />
            预览模式：这是参与者看到的样子，不可编辑。
          </div>
        )}
        {sec === "info" && (
          <Group title="基本信息">
            {[
              ["名称", name, setName],
              ["日期", "10-18 / 10-19"],
              ["地点", "示例会展中心 2 号馆"],
              ["类型", "展会（导航显示「探索」）"],
            ].map(([l, v, f]) => (
              <label
                key={l as string}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="w-12 text-[14px] text-ink2">
                  {l as string}
                </span>
                <input
                  readOnly={preview || !f}
                  value={v as string}
                  onChange={(e) => {
                    if (typeof f === "function") f(e.target.value)
                    setDirty(true)
                  }}
                  className={`flex-1 bg-transparent text-[15px] outline-none ${
                    !preview && f ? "text-ink" : "text-ink2"
                  }`}
                />
                {!preview && f && <I n="edit" s={15} className="text-ink3" />}
              </label>
            ))}
          </Group>
        )}
        {sec === "map" && (
          <>
            <FloorMap
              booths={BOOTHS}
              saved={new Set()}
              route={[]}
              onPick={() => {}}
            />
            {!preview && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Btn kind="plain">替换底图</Btn>
                <Btn kind="tinted">标注摊位点</Btn>
              </div>
            )}
            <p className="mt-2 text-[12px] text-ink3">
              底图按上传原样显示，不做重新着色。通道需单独确认后才对参与者显示。
            </p>
            <Group title="通道">
              <Row
                title="公共通道（A–C 之间）"
                sub="未确认走向"
                right={<Badge tone="danger">需复核</Badge>}
              />
            </Group>
          </>
        )}
        {sec === "booth" && (
          <Group
            title={`摊位 ${BOOTHS.length}`}
            footer={preview ? undefined : "点按编辑；批量导入支持 CSV。"}
          >
            {BOOTHS.map((b, i) => (
              <Row
                key={b.id}
                title={`${b.code} · ${b.name}`}
                sub={b.circle}
                right={
                  <Badge tone={i === 3 ? "warn" : "teal"}>
                    {i === 3 ? "未确认" : "已发布"}
                  </Badge>
                }
                onClick={preview ? undefined : () => {}}
              />
            ))}
          </Group>
        )}
        {sec === "session" && (
          <Group
            title="场次发布"
            footer="状态：已本地保存 → 已提交 → 发布；冲突或信息缺失会标记为需复核。"
          >
            {sessions.map((s) => (
              <Row
                key={s.id}
                title={s.title}
                sub={
                  <span className="tnum">
                    {s.booth} · {s.date} {fmt(s.start)}–{fmt(s.end)}
                  </span>
                }
                right={
                  <Badge tone={STATUS[s.st].tone} dot>
                    {STATUS[s.st].label}
                  </Badge>
                }
              />
            ))}
          </Group>
        )}
      </main>
      {!preview && (
        <div className="glass absolute inset-x-3 bottom-4 z-20 flex items-center gap-2 rounded-[24px] p-2">
          <Btn
            kind="plain"
            className="flex-1"
            onClick={() => {
              setDirty(false)
              setPub("local")
            }}
          >
            保存草稿
          </Btn>
          <Btn
            className="flex-1"
            onClick={() => {
              setDirty(false)
              setPub("submitted")
            }}
          >
            发布
          </Btn>
        </div>
      )}
    </>
  )
}

function AddScheduleSheet({
  date,
  onPick,
  onCustom,
}: {
  date: string
  onPick: (b: Booth, s?: Booth["sessions"][number]) => void
  onCustom: () => void
}) {
  const [q, setQ] = useState("")

  const list: Array<AddScheduleItem> = []
  let hasAnySession = false

  BOOTHS.forEach((b) => {
    const matchQ =
      b.name.includes(q) || b.code.includes(q) || b.circle.includes(q)
    const daySessions = b.sessions.filter((s) => s.date === date)

    if (daySessions.length > 0) hasAnySession = true

    daySessions.forEach((s) => {
      if (matchQ || s.title.includes(q)) {
        list.push({ t: "session", b, s })
      }
    })

    if (matchQ) {
      list.push({ t: "booth", b })
    }
  })

  return (
    <div className="pb-2">
      <label className="mb-4 flex h-10 items-center gap-2 rounded-xl bg-ink/[0.06] px-3 text-ink3 transition-colors focus-within:bg-ink/[0.08] focus-within:ring-2 focus-within:ring-teal/20">
        <I n="search" s={17} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索摊位、地点或场次"
          className="flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink3"
        />
      </label>

      <div className="mb-4 overflow-hidden rounded-[20px] bg-surface divide-y divide-line shadow-sm ring-1 ring-black/[0.04] dark:ring-white/5">
        <button
          onClick={onCustom}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-surface2"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-surface2 text-teal">
            <I n="plus" s={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15.5px] font-medium text-teal">
              添加自定义安排
            </span>
          </span>
        </button>
      </div>

      {list.length === 0 ? (
        <div className="py-6 text-center text-[13.5px] text-ink3">
          没有匹配的地点或场次
        </div>
      ) : (
        <>
          <h3 className="mb-2 px-4 text-[13px] font-medium tracking-wide text-ink2/80">
            {date.replace("-", "月")}日相关
          </h3>
          {!hasAnySession && (
            <p className="mb-3 px-4 text-[12.5px] text-ink3">
              该日暂无已公布场次，可选地点后设置时间
            </p>
          )}
          <div className="overflow-hidden rounded-[20px] bg-surface divide-y divide-line shadow-sm ring-1 ring-black/[0.04] dark:ring-white/5 max-h-[45vh] overflow-y-auto no-scrollbar">
            {list.map((item, idx) => {
              if (item.t === "session") {
                return (
                  <button
                    key={`s-${item.s.id}`}
                    onClick={() => onPick(item.b, item.s)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-surface2"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-surface2 text-ink2">
                      <I n="clock" s={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15.5px] font-medium text-ink">
                        {item.s.title}
                      </span>
                      <span className="mt-0.5 block tnum text-[13px] text-ink3">
                        {item.b.code} · {fmt(item.s.start)}–{fmt(item.s.end)}
                      </span>
                    </span>
                  </button>
                )
              } else {
                return (
                  <button
                    key={`b-${item.b.id}`}
                    onClick={() => onPick(item.b)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-surface2"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-surface2 text-ink2">
                      <I n="pin" s={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15.5px] font-medium text-ink">
                        {item.b.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-ink3">
                        {item.b.code} · {item.b.circle}
                      </span>
                    </span>
                  </button>
                )
              }
            })}
          </div>
        </>
      )}
    </div>
  )
}
