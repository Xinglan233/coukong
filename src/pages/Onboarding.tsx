import { useState } from 'react'
import type { DayKey } from '../types'
import { useStore } from '../store'
import { DaySelect } from '../ui/DaySelect'

export function Onboarding() {
  const finishOnboarding = useStore((s) => s.finishOnboarding)
  const [step, setStep] = useState(0)
  const [name, setName] = useState('CN')
  const [days, setDays] = useState<DayKey[]>([])

  return (
    <div className="onboard">
      <div className="onboard-brand">凑空</div>
      <div className="onboard-event">REDLAND · 10.2–10.6</div>

      {step === 0 ? (
        <div className="onboard-step">
          <h1 className="onboard-title">怎么称呼</h1>
          <input
            className="input"
            value={name}
            maxLength={12}
            onChange={(e) => setName(e.target.value)}
            placeholder="名字"
          />
          <button
            className="btn btn-primary btn-block onboard-btn"
            disabled={!name.trim()}
            onClick={() => setStep(1)}
          >
            继续
          </button>
        </div>
      ) : (
        <div className="onboard-step">
          <h1 className="onboard-title">哪几天在</h1>
          <DaySelect value={days} onChange={setDays} />
          <button
            className="btn btn-primary btn-block onboard-btn"
            disabled={days.length === 0}
            onClick={() => finishOnboarding({ name: name.trim(), days })}
          >
            开始
          </button>
        </div>
      )}
    </div>
  )
}
