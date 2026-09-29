import { useState } from 'react'
import { Check, PencilLine } from 'lucide-react'
import { DAY_KEYS, type DayKey, type RawBooking } from '../types'
import { DAY_META } from '../lib/dates'
import { useStore } from '../store'

type EditMap = Record<string, RawBooking>

export function Review({ onClose }: { onClose: () => void }) {
  const groups = useStore((s) => s.reviewGroups)
  const progress = useStore((s) => s.ocrProgress)
  const addRawBookings = useStore((s) => s.addRawBookings)
  const showToast = useStore((s) => s.showToast)
  const openModal = useStore((s) => s.openModal)

  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [edits, setEdits] = useState<EditMap>({})
  const [groupDays, setGroupDays] = useState<Record<number, DayKey>>({})
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({})

  const keyOf = (gi: number, bi: number) => `${gi}-${bi}`
  const isPicked = (k: string) => picked[k] ?? true

  function effective(gi: number, bi: number): RawBooking {
    const k = keyOf(gi, bi)
    const r = edits[k] ?? groups[gi].bookings[bi]
    if (r.day) return r
    return { ...r, day: groupDays[gi] ?? null }
  }

  function patch(k: string, gi: number, bi: number, patch: Partial<RawBooking>) {
    const current = effective(gi, bi)
    setEdits((m) => ({ ...m, [k]: { ...current, ...patch } }))
  }

  function toggle(k: string) {
    setPicked((p) => ({ ...p, [k]: !(p[k] ?? true) }))
  }

  function needsDay(gi: number): boolean {
    const g = groups[gi]
    return g.multiDay || g.bookings.some((b) => !b.day)
  }

  function handleSave() {
    const raws: RawBooking[] = []
    groups.forEach((g, gi) => {
      g.bookings.forEach((_, bi) => {
        const k = keyOf(gi, bi)
        if (isPicked(k)) raws.push(effective(gi, bi))
      })
    })
    if (raws.some((r) => !r.day)) {
      showToast('还有场次没有选择日期')
      return
    }
    if (raws.some((r) => !r.start || !r.end)) {
      showToast('还有场次的时间没填完整')
      return
    }
    const { saved, skipped } = addRawBookings(raws)
    if (!saved && skipped) showToast(`${skipped} 场与已有预约冲突`)
    else showToast(skipped ? `已保存 ${saved} 场，${skipped} 场冲突未保存` : `已保存 ${saved} 场`)
    onClose()
  }

  if (groups.length === 0) {
    return (
      <div className="ocr-loading">
        <div className="spinner" />
        <div className="ocr-loading-pct">{Math.round(Math.max(0, progress) * 100)}%</div>
        <div className="ocr-loading-sub">首次识别会先下载语言包</div>
      </div>
    )
  }

  const total = groups.reduce((n, g) => n + g.bookings.length, 0)

  if (total === 0) {
    return (
      <div className="empty">
        <div className="empty-title">未在截图中识别到预约</div>
        <div className="empty-sub">确认截图完整，或直接手动填写</div>
        <button
          className="btn btn-primary"
          onClick={() => {
            onClose()
            openModal({ type: 'bookingForm' })
          }}
        >
          <PencilLine size={17} />
          手动添加
        </button>
      </div>
    )
  }

  return (
    <>
      {groups.map((g, gi) => (
        <div key={gi} className="rv-group">
          <div className="rv-file">{g.fileName}</div>
          {needsDay(gi) && (
            <select
              className="select"
              style={{ marginBottom: 10 }}
              value={groupDays[gi] ?? ''}
              onChange={(e) => setGroupDays((m) => ({ ...m, [gi]: e.target.value as DayKey }))}
            >
              <option value="" disabled>
                选择截图所属日期
              </option>
              {DAY_KEYS.map((d) => (
                <option key={d} value={d}>
                  {DAY_META[d].date} {DAY_META[d].weekday}
                </option>
              ))}
            </select>
          )}

          {g.bookings.map((_, bi) => {
            const k = keyOf(gi, bi)
            const r = effective(gi, bi)
            const on = isPicked(k)
            const expanded = openKeys[k]
            return (
              <div key={k} className={`rv-row ${on ? '' : 'off'}`}>
                <div className="rv-row-main">
                  <button
                    className={`rv-check ${on ? 'on' : ''}`}
                    aria-label={on ? '取消选中' : '选中'}
                    onClick={() => toggle(k)}
                  >
                    {on ? <Check size={13} strokeWidth={3.2} /> : null}
                  </button>
                  <button className="rv-row-text" onClick={() => setOpenKeys((m) => ({ ...m, [k]: !m[k] }))}>
                    <span className="rv-time">
                      {r.start}–{r.end}
                    </span>
                    <span className="rv-title">{r.title}</span>
                    <span className="rv-meta">{[r.booth, r.ip].filter(Boolean).join(' ')}</span>
                  </button>
                  <button className="icon-btn" onClick={() => setOpenKeys((m) => ({ ...m, [k]: !m[k] }))}>
                    <PencilLine size={15} />
                  </button>
                </div>

                {expanded && (
                  <div className="rv-edit">
                    <div className="btn-row">
                      <div className="field" style={{ flex: 1 }}>
                        <label className="field-label">开始</label>
                        <input className="input" type="time" value={r.start} onChange={(e) => patch(k, gi, bi, { start: e.target.value })} />
                      </div>
                      <div className="field" style={{ flex: 1 }}>
                        <label className="field-label">结束</label>
                        <input className="input" type="time" value={r.end} onChange={(e) => patch(k, gi, bi, { end: e.target.value })} />
                      </div>
                    </div>
                    <div className="field">
                      <label className="field-label">活动名</label>
                      <input className="input" value={r.title} onChange={(e) => patch(k, gi, bi, { title: e.target.value })} />
                    </div>
                    <div className="btn-row">
                      <div className="field" style={{ flex: 1 }}>
                        <label className="field-label">展位</label>
                        <input className="input" value={r.booth ?? ''} onChange={(e) => patch(k, gi, bi, { booth: e.target.value })} />
                      </div>
                      <div className="field" style={{ flex: 1.4 }}>
                        <label className="field-label">作品</label>
                        <input className="input" value={r.ip ?? ''} onChange={(e) => patch(k, gi, bi, { ip: e.target.value })} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}

      <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={handleSave}>
        保存选中场次
      </button>
    </>
  )
}
