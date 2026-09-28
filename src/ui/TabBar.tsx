import { CalendarDays, UserRound, Users } from 'lucide-react'
import { useStore, type Tab } from '../store'

const TABS: { key: Tab; label: string; icon: typeof CalendarDays }[] = [
  { key: 'schedule', label: '日程', icon: CalendarDays },
  { key: 'match', label: '凑空', icon: Users },
  { key: 'me', label: '我的', icon: UserRound }
]

export function TabBar() {
  const tab = useStore((s) => s.tab)
  const setTab = useStore((s) => s.setTab)

  return (
    <nav className="tabbar">
      {TABS.map(({ key, label, icon: Icon }) => (
        <button key={key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>
          <Icon size={22} strokeWidth={tab === key ? 2.4 : 2} />
          {label}
        </button>
      )}
    </nav>
  )
}
