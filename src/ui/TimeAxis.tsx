import { Fragment, type ReactNode } from "react"
import type { Booking, Interval } from "../types"
import { formatTime, fromMinute } from "../lib/dates"

export interface AxisPerson {
  name: string
  bookings: Booking[]
}

interface TimeAxisProps {
  openHour: number
  closeHour: number
  buffer: number
  free: Interval[]
  people: AxisPerson[]
}

const ROW_H = 42
const BAND_H = 26

export function TimeAxis({ openHour, closeHour, buffer, free, people }: TimeAxisProps) {
  const span = (closeHour - openHour) * 60
  const openMin = openHour * 60

  const pos = (min: number) => ((min - openMin) / span) * 100
  const width = (start: number, end: number) => ((end - start) / span) * 100

  const hours: number[] = []
  for (let h = openHour; h <= closeHour; h++) hours.push(h)

  const busyBlocks = (bookings: Booking[]): ReactNode =>
    bookings.map((b) => {
      // 缓冲可能把块推出开放时间边界，夹回轴内避免溢出
      const from = Math.min(Math.max(parseHHMM(b.start) - buffer, openMin), openMin + span)
      const to = Math.min(Math.max(parseHHMM(b.end) + buffer, openMin), openMin + span)
      if (to <= from) return null
      const w = width(from, to)
      return (
        <div
          key={b.id}
          className="tl-busy"
          style={{ left: `${pos(from)}%`, width: `${w}%` }}
        >
          {w > 13 ? <span className="tl-busy-text">{b.title}</span> : null}
        </div>
      )
    })

  const totalRows = 1 + people.length

  return (
    <div className="tl" style={{ minHeight: BAND_H + totalRows * (ROW_H + 22) }}>
      <div className="tl-grid">
        {hours.map((h) => {
          const top = pos(h * 60)
          return (
            <Fragment key={h}>
              <span className="tl-time" style={{ top: `${top}%` }}>
                {h}:00
              </span>
              <span className="tl-line" style={{ top: `${top}%` }} />
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
        <Fragment key={`${p.name}-${i}`}>
          <div className="tl-label">{p.name}</div>
          <div className="tl-row" style={{ height: ROW_H }}>
            {busyBlocks(p.bookings)}
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
