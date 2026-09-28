import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { DAY_KEYS, type Booking, type CatalogSession, type DayKey } from '../types'
import { DAY_META, toMinute } from '../lib/dates'
import { activitiesForDay } from '../lib/catalog'
import { findConflicts } from '../lib/availability'
import { useStore } from '../store'

interface BookingFormProps {
  bookingId?: string
  presetDay?: DayKey
  onClose: () => void
}

export function BookingForm({ bookingId, presetDay, onClose }: BookingFormProps) {
  const bookings = useStore((s) => s.bookings)
  const profile = useStore((s) => s.profile)
  const saveBooking = useStore((s) => s.saveBooking)
  const deleteBooking = useStore((s) => s.deleteBooking)
  const showToast = useStore((s) => s.showToast)

  const existing: Booking | undefined = bookings.find((b) => b.id === bookingId)
  const [mode, setMode] = useState<'catalog' | 'custom'>(existing ? 'custom' : 'catalog')

  const [day, setDay] = useState<DayKey>(existing?.day ?? presetDay ?? profile.days[0] ?? '10-04')
  const [activityId, setActivityId] = useState<string | null>(null)
  const [session, setSession] = useState<CatalogSession | null>(null)

  const [title, setTitle] = useState(existing?.title ?? '')
  const [start, setStart] = useState(existing?.start ?? '10:00')
  const [end, setEnd] = useState(existing?.end ?? '11:00')
  const [booth, setBooth] = useState(existing?.booth ?? '')
  const [ip, setIp] = useState(existing?.ip ?? '')
  const [note, setNote] = useState(existing?.note ?? '')

  const conflicts = useMemo(
    () => findConflicts(bookings, { day, start, end, id: bookingId }),
    [bookings, day, start, end, bookingId]
  )

  const dayCount = bookings.filter((b) => b.day === day && b.id !== bookingId).length
  const overFive = dayCount >= 5

  const timeInvalid = toMinute(end) <= toMinute(start)
  const catalogReady = Boolean(activityId && session)
  const customReady = Boolean(title.trim() && !timeInvalid && conflicts.length === 0)

  function handleSave() {
    if (mode === 'catalog') {
      if (!activityId || !session) return
      const activity = activitiesForDay(day).find((a) => a.id === activityId)
      if (!activity) return
      const hit = findConflicts(bookings, { day, start: session.start, end: session.end, id: bookingId })
      if (hit.length) {
        showToast('该场次与已有预约时间冲突')
        return
      }
      saveBooking(
        { day, start: session.start, end: session.end, booth: activity.booth, ip: activity.ip, title: activity.title, source: 'catalog' },
        bookingId
      )
    } else {
      if (!customReady) return
      saveBooking(
        { day, start, end, booth: booth || undefined, ip: ip || undefined, title: title.trim(), note: note || undefined, source: 'manual' },
        bookingId
      )
    }
    showToast(bookingId ? '已更新预约' : '已添加预约')
    onClose()
  }

  function handleDelete() {
    if (!bookingId) return
    deleteBooking(bookingId)
    showToast('已删除预约')
    onClose()
  }

  const selectableDays = profile.days.length ? profile.days : DAY_KEYS

  return (
    <>
      <div className="field">
        <label className="field-label">日期</label>
        <select className="select" value={day} onChange={(e) => {
          setDay(e.target.value as DayKey)
          setActivityId(null)
          setSession(null)
        }}>
          {selectableDays.map((d) => (
            <option key={d} value={d}>
              {DAY_META[d].date} {DAY_META[d].weekday}
            </option>
          ))}
        </select>
      </div>

      {!existing && (
        <div className="segmented" style={{ marginBottom: 16 }}>
          <button className={mode === 'catalog' ? 'on' : ''} onClick={() => setMode('catalog')}>
            场次库
          </button>
          <button className={mode === 'custom' ? 'on' : ''} onClick={() => setMode('custom')}>
            自定义
          </button>
        </div>
      )}

      {mode === 'catalog' ? (
        <div>
          {activitiesForDay(day).length === 0 ? (
            <div className="empty" style={{ padding: '36px 20px' }}>
              <div className="empty-sub">当天场次库还是空的，先用自定义填写</div>
            </div>
          ) : (
            <>
              {activitiesForDay(day).map((a) => (
                <div key={a.id}>
                  <button
                    className={`cat-activity ${activityId === a.id ? 'on' : ''}`}
                    onClick={() => {
                      setActivityId(a.id)
                      setSession(null)
                    }}
                  >
                    <span className="cat-activity-title">{a.title}</span>
                    <span className="cat-activity-meta">
                      {[a.booth, a.ip].filter(Boolean).join(' ')}
                    </span>
                  </button>
                  {activityId === a.id && (
                    <div className="chip-wrap" style={{ margin: '2px 0 12px', paddingLeft: 10 }}>
                      {a.sessions[day]?.map((s) => (
                        <button
                          key={s.start}
                          className={`chip ${session?.start === s.start ? 'on' : ''}`}
                          onClick={() => setSession(s)}
                        >
                          {s.start}–{s.end}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        <div>
          {conflicts.length > 0 && <div className="notice">与已有预约时间冲突</div>}
          {overFive && <div className="notice">当天预约已超过 5 场</div>}
          {timeInvalid && <div className="notice">结束时间需晚于开始时间</div>}

          <div className="field">
            <label className="field-label">活动名</label>
            <input className="input" value={title} maxLength={30} onChange={(e) => setTitle(e.target.value)} placeholder="活动名" />
          </div>
          <div className="btn-row">
            <div className="field" style={{ flex: 1 }}>
              <label className="field-label">开始</label>
              <input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label className="field-label">结束</label>
              <input className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="btn-row">
            <div className="field" style={{ flex: 1 }}>
              <label className="field-label">展位</label>
              <input className="input" value={booth} maxLength={8} onChange={(e) => setBooth(e.target.value)} placeholder="A-09" />
            </div>
            <div className="field" style={{ flex: 1.4 }}>
              <label className="field-label">作品</label>
              <input className="input" value={ip} maxLength={20} onChange={(e) => setIp(e.target.value)} placeholder="作品名" />
            </div>
          </div>
          <div className="field">
            <label className="field-label">备注</label>
            <input className="input" value={note} maxLength={40} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
      )}

      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 8 }}
        disabled={mode === 'catalog' ? !catalogReady : !customReady}
        onClick={handleSave}
      >
        保存
      </button>
      {existing && (
        <button className="btn btn-danger btn-block" style={{ marginTop: 10 }} onClick={handleDelete}>
          <Trash2 size={16} />
          删除这场
        </button>
      )}
    </>
  )
}
