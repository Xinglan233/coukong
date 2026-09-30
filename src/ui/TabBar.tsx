import { CalendarDays, UserRound, Users } from "lucide-react"
import { useStore, type Tab } from "../store"
import type { LucideIcon } from 'lucide-react'

const TABS: { key: Tab; label: string; icon: typeof CalendarDays }[] = [
  { key: "schedule", label: "日程", icon: CalendarDays },
  { key: "match", label: "凑空", icon: Users },
  { key: "me", label: "我的", icon: UserRound }
]

export function TabBar({items, value, onChange}:{items?:{key:string;label:string;icon:LucideIcon}[];value?:string;onChange?:(key:string)=>void}={}) {
  const tab = useStore((s) => s.tab)
  const setTab = useStore((s) => s.setTab)

  return (
    <nav className="tabbar">
      {(items||TABS).map(({ key, label, icon: Icon }) => (
        <button key={key} className={(value??tab) === key ? "on" : ""} aria-current={(value??tab)===key?'page':undefined} onClick={() => onChange?onChange(key):setTab(key as Tab)}>
          <Icon size={22} strokeWidth={(value??tab) === key ? 2.4 : 2} />
          {label}
        </button>
      ))}
    </nav>
  )
}
