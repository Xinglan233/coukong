import { Fragment, type ReactNode } from "react"
import type { Booking, Interval } from "../types"
import { formatTime, fromMinute } from "../lib/dates"

export interface AxisPerson {
  id?: string
  name: string
  bookings?: Booking[]
  /** Safe unavailable projection from the API; contains no private titles. */
  ranges?: Interval[]
}

interface TimeAxisProps {
  openHour: number
  closeHour: number
  openMinute?: number
  closeMinute?: number
  buffer: number
  free: Interval[]
  people: AxisPerson[]
}

const ROW_H = 42
const BAND_H = 26

export function TimeAxis({ openHour, closeHour, openMinute, closeMinute, buffer, free, people }: TimeAxisProps) {
  const openMin = openMinute ?? openHour * 60
  const closeMin = closeMinute ?? closeHour * 60
  const span = Math.max(1, closeMin - openMin)

  const pos = (min: number) => ((min - openMin) / span) * 100
  const width = (start: number, end: number) => ((end - start) / span) * 100

  const hours: number[] = []
  for (let h = Math.ceil(openMin / 60); h <= Math.floor(closeMin / 60); h++) hours.push(h)

  const busyBlocks = (person: AxisPerson): ReactNode =>
    (person.ranges ? person.ranges.map((r, i) => ({id:String(i), start:r.start,end:r.end,title:''})) : (person.bookings||[]).map(b=>({...b,start:parseHHMM(b.start)-buffer,end:parseHHMM(b.end)+buffer}))).map((b) => {
      // 缓冲可能把块推出开放时间边界，夹回轴内避免溢出
      const from = Math.min(Math.max(b.start, openMin), closeMin)
      const to = Math.min(Math.max(b.end, openMin), closeMin)
      if (to <= from) return null
      const w = width(from, to)
      return (
        <div
          key={b.id}
          className="tl-busy"
          style={{ left: `${pos(from)}%`, width: `${w}%` }}
        >
          {w > 13 && b.title ? <span className="tl-busy-text">{b.title}</span> : null}
        </div>
      )
    })

  const totalRows = 1 + people.length

  return (
    <div className={`tl ${openMinute!==undefined?'tl-online':''}`} style={{ minHeight: BAND_H + totalRows * (ROW_H + 22) }}>
      <div className="tl-grid">
        {hours.map((h) => {
          const left = pos(h * 60)
          return (
            <Fragment key={h}>
              <span className="tl-time" style={openMinute!==undefined?{left:`${left}%`}:{top:`${left}%`}}>
                {h}:00
              </span>
              <span className="tl-line" style={openMinute!==undefined?{left:`${left}%`}:{top:`${left}%`}} />
            </Fragment>
          )
        })}
      </div>

      <div className="tl-label tl-label-top">共同空闲</div>
      <div className="tl-row" style={{ height: BAND_H }}>
        {free.map((iv, i) => (
          <div
            key={i}
            className="tl-free"
            style={{ left: `${pos(iv.start)}%`, width: `${width(iv.start, iv.end)}%` }}
          >
            {width(iv.start, iv.end) > 12 ? (
              <span className="tl-free-text">
                {formatTime(fromMinute(iv.start))}–{formatTime(fromMinute(iv.end))}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      {people.map((p, i) => (
        <Fragment key={p.id||`${p.name}-${i}`}>
          <div className="tl-label">{p.name}</div>
          <div className="tl-row" style={{ height: ROW_H }}>
            {busyBlocks(p)}
          </div>
        </Fragment>
      ))}
    </div>
  )
}

function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}
