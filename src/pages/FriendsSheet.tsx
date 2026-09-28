import { ClipboardPaste, Trash2 } from 'lucide-react'
import { useStore } from '../store'

interface FriendsSheetProps {
  onClose: () => void
}

function stamp(ts?: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function FriendsSheet({ onClose }: FriendsSheetProps) {
  const friends = useStore((s) => s.friends)
  const deleteFriend = useStore((s) => s.deleteFriend)
  const openModal = useStore((s) => s.openModal)

  return (
    <>
      {friends.length === 0 ? (
        <div className="empty" style={{ padding: '40px 20px' }}>
          <div className="empty-title">还没有朋友</div>
          <div className="empty-sub">导入朋友发来的码</div>
        </div>
      ) : (
        friends.map((f) => (
          <div key={f.id} className="friend-row">
            <div className="friend-info">
              <div className="friend-name">{f.name}</div>
              <div className="friend-meta">
                {f.days.length} 天 {f.bookings.length} 场
              </div>
              {f.generatedAt && <div className="friend-time">更新于 {stamp(f.generatedAt)}</div>}
            </div>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => {
                deleteFriend(f.id)
              }}
            >
              <Trash2 size={14} />
              删除
            </button>
          </div>
        ))
      )}

      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 14 }}
        onClick={() => {
          onClose()
          openModal({ type: 'importManual' })
        }}
      >
        <ClipboardPaste size={17} />
        导入朋友码
      </button>
    </>
  )
}
