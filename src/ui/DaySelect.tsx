import { DAY_KEYS, type DayKey } from '../types'
import { DAY_META } from '../lib/dates'

interface DaySelectProps {
  value: DayKey[]
  onChange: (days: DayKey[]) => void
}

export function DaySelect({ value, onChange }: DaySelectProps) {
  return (
    <div className="chip-wrap">
      {DAY_KEYS.map((d) => {
        const on = value.includes(d)
        return (
          <button
            key={d}
            className={`chip ${on ? 'on' : ''}`}
            onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d])}
          >
            {DAY_META[d].label} {d.replace('-', '/')}
          </button>
        )
      })}
    </div>
  )
}
