import { useState } from 'react'
import { Camera, ChevronRight, PencilLine } from 'lucide-react'
import type { DayKey } from '../types'
import { DAY_META, formatTime, sortBookings } from '../lib/dates'
import { recognizeFiles } from '../lib/ocr'
import { useStore } from '../store'

export function Schedule() {
  const profile = useStore((s) => s.profile)
  const bookings = useStore((s) => s.bookings)
  const openModal = useStore((s) => s.openModal)
  const setReviewGroups = useStore((s) => s.setReviewGroups)
  const setOcrProgress = useStore((s) => s.setOcrProgress)

  async function handleFiles(files: File[]) {
    setOcrProgress(0)
    setReviewGroups([])
    openModal({ type: 'review' })
    try {
      const groups = await recognizeFiles(files, (p, status) => {
        if (status.includes('recognizing')) setOcrProgress(p)
      })
      setReviewGroups(groups)
    } catch {
      useStore.getState().showToast('识别失败，请重试或手动填写')
    } finally {
      setOcrProgress(-1)
    }
  }

  const [day, setDay] = useState<DayKey>(profile.days[0] ?? '10-02')
  const dayBookings = sortBookings(bookings.filter((b) => b.day === day))
  const overLimit = dayBookings.length > 5

  return (
    <div className="page">
      <h1 className="page-title">我的日程</h1>
      <p className="page-sub">{profile.name}</p>

      <div className="day-strip">
        {profile.days.length === 0 ? (
          <span className="badge badge-warning">还没有选择参展日</span>
        ) : (
          profile.days.map((d) => (
            <button
              key={d}
              className={`chip ${d === day ? 'on' : ''}`}
              onClick={() => setDay(d)}
            >
              {DAY_META[d].label} {d.replace('-', '/')}
            </button>
          ))
        )}
      </div>

      <div className={`overview ${overLimit ? 'overview-warn' : ''}`}>
        <span>
          当日已预约 {dayBookings.length}/5 场
        </span>
      </div>

      <div className="btn-row" style={{ marginBottom: 20 }}>
        <button
          className="btn btn-primary"
          style={{ flex: 1.3 }}
          onClick={() => document.getElementById('ocr-file')?.click()}
        >
          <Camera size={18} />
          截图识别
        </button>
        <button className="btn btn-surface" style={{ flex: 1 }} onClick={() => openModal({ type: 'bookingForm', presetDay: day })}>
          <PencilLine size={17} />
          手动添加
        </button>
      </div>

      <input
        id="ocr-file"
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (files.length) void handleFiles(files)
        }}
      />

      {dayBookings.length === 0 ? (
        <div className="empty">
          <div className="empty-title">当天还没有预约</div>
          <div className="empty-sub">上传预约截图，或手动添加一场</div>
        </div>
      ) : (
        <div className="sched-list">
          {dayBookings.map((b) => (
            <button key={b.id} className="sched-row" onClick={() => openModal({ type: 'bookingForm', bookingId: b.id })}>
              <div className="sched-time">
                <span>{formatTime(b.start)}</span>
                <span className="sched-time-end">{formatTime(b.end)}</span>
              </div>
              <div className="sched-main">
                <div className="sched-title">{b.title}</div>
                <div className="sched-meta">
                  {[b.booth, b.ip].filter(Boolean).join(' ')}
                </div>
              </div>
              <ChevronRight size={17} className="sched-chev" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
