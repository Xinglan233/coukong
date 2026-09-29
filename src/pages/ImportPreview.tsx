import { motion, useReducedMotion } from 'framer-motion'
import { DAY_KEYS, type SharePayload } from '../types'
import { DAY_META, formatTime } from '../lib/dates'
import { useStore } from '../store'

interface ImportPreviewProps {
  payload: SharePayload
  onClose: () => void
}

export function ImportPreview({ payload, onClose }: ImportPreviewProps) {
  const importFriend = useStore((s) => s.importFriend)
  const hasSameName = useStore((s) => s.friends.some((f) => f.name === payload.name))
  const showToast = useStore((s) => s.showToast)
  const reduce = useReducedMotion()

  const grouped = DAY_KEYS.map((d) => ({
    day: d,
    list: payload.bookings
      .filter((b) => b.day === d)
      .sort((a, b) => a.start.localeCompare(b.start))
  })).filter((g) => g.list.length > 0)

  function handleSave() {
    const result = importFriend(payload)
    showToast(result === 'added' ? '已保存到朋友列表' : '已更新该朋友的日程')
    onClose()
  }

  return (
    <motion.div
      className="import-page"
      initial={{ opacity: 0, y: reduce ? 0 : 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className="page">
        <h1 className="page-title">{payload.name} 的日程</h1>
        <p className="page-sub">
          {payload.days.length} 天在场，{payload.bookings.length} 场预约
        </p>

        {hasSameName && <div className="notice">已有同名朋友，保存将覆盖其日程</div>}

        {grouped.map((g) => (
          <div key={g.day} className="import-day">
            <div className="import-day-head">
              {DAY_META[g.day].date} {DAY_META[g.day].weekday}
            </div>
            {g.list.map((b) => (
              <div key={b.id} className="import-row">
                <span className="import-time">
                  {formatTime(b.start)}–{formatTime(b.end)}
                </span>
                <span className="import-title">{b.title}</span>
                <span className="import-meta">{[b.booth, b.ip].filter(Boolean).join(' ')}</span>
              </div>
            ))}
          </div>
        ))}

        <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} onClick={handleSave}>
          保存为朋友
        </button>
        <button className="btn btn-surface btn-block" style={{ marginTop: 10 }} onClick={onClose}>
          取消
        </button>
      </div>
    </motion.div>
  )
}
