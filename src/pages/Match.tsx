import { useState } from 'react'
import { ClipboardPaste } from 'lucide-react'
import { DAY_META, durationLabel, fromMinute } from '../lib/dates'
import { commonDays, mutualFree, type Person } from '../lib/availability'
import { useStore } from '../store'
import { TimeAxis, type AxisPerson } from '../ui/TimeAxis'

const SLOT_OPTIONS = [15, 30, 60]

export function Match() {
  const friends = useStore((s) => s.friends)
  const profile = useStore((s) => s.profile)
  const bookings = useStore((s) => s.bookings)
  const settings = useStore((s) => s.settings)
  const openModal = useStore((s) => s.openModal)

  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [minSlot, setMinSlot] = useState(settings.minSlotMinutes)

  const chosen = friends.filter((f) => selected[f.id] ?? false)
  const people: Person[] = [
    { bookings, days: profile.days },
    ...chosen.map((f) => ({ bookings: f.bookings, days: f.days }))
  ]
  const days = commonDays(people)

  const allOn = friends.length > 0 && chosen.length === friends.length

  function toggleAll() {
    if (allOn) setSelected({})
    else setSelected(Object.fromEntries(friends.map((f) => [f.id, true])))
  }

  if (friends.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">凑空</h1>
        <p className="page-sub">看看你和朋友什么时候都有空</p>
        <div className="empty" style={{ paddingTop: 70 }}>
          <div className="empty-title">还没有朋友的日程</div>
          <div className="empty-sub">让朋友填完发码给你</div>
          <button className="btn btn-primary" onClick={() => openModal({ type: 'importManual' })}>
            <ClipboardPaste size={17} />
            导入朋友码
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <h1 className="page-title">凑空</h1>
      <p className="page-sub">勾选朋友，查看共同空闲</p>

      <div className="chip-wrap" style={{ marginBottom: 10 }}>
        <button className="chip" onClick={toggleAll}>
          {allOn ? '清空' : '全选'}
        </button>
        {friends.map((f) => {
          const on = selected[f.id] ?? false
          return (
            <button
              key={f.id}
              className={`chip ${on ? 'on' : ''}`}
              onClick={() => setSelected((m) => ({ ...m, [f.id]: !on }))}
            >
              {f.name}
            </button>
          )
        })}
      </div>

      {chosen.length === 0 ? (
        <div className="empty" style={{ padding: '50px 20px' }}>
          <div className="empty-sub">勾选至少一位朋友</div>
        </div>
      ) : (
        <>
          <div className="segmented" style={{ margin: '6px 0 18px' }}>
            {SLOT_OPTIONS.map((m) => (
              <button key={m} className={minSlot === m ? 'on' : ''} onClick={() => setMinSlot(m)}>
                {m} 分钟以上
              </button>
            ))}
          </div>

          {days.length === 0 && (
            <div className="empty" style={{ padding: '40px 20px' }}>
              <div className="empty-sub">你们的参展日没有交集</div>
            </div>
          )}

          {days.map((day) => {
            const free = mutualFree(
              people,
              day,
              settings.openHour,
              settings.closeHour,
              settings.bufferMinutes,
              minSlot
            )
            const axisPeople: AxisPerson[] = [
              { name: profile.name, bookings: bookings.filter((b) => b.day === day) },
              ...chosen.map((f) => ({
                name: f.name,
                bookings: f.bookings.filter((b) => b.day === day)
              }))
            ]
            return (
              <div key={day} className="match-day">
                <div className="match-day-head">
                  <span className="match-day-date">{DAY_META[day].date}</span>
                  <span className="match-day-weekday">{DAY_META[day].weekday}</span>
                </div>

                {free.length === 0 ? (
                  <div className="match-none">当天凑不出整块时间</div>
                ) : (
                  <div className="free-list">
                    {free.map((iv, i) => (
                      <div key={i} className="free-row">
                        <span className="free-range">
                          {fromMinute(iv.start)}–{fromMinute(iv.end)}
                        </span>
                        <span className="free-dur">
                          {durationLabel(fromMinute(iv.start), fromMinute(iv.end))}
                        </span>
                      </div>
                    ))}
                  </div>
                )

                <TimeAxis
                  openHour={settings.openHour}
                  closeHour={settings.closeHour}
                  buffer={settings.bufferMinutes}
                  free={free}
                  people={axisPeople}
                />
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
