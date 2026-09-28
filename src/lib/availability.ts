import type { Booking, DayKey, Interval } from '../types'

export function mergeIntervals(ivals: Interval[]): Interval[] {
  const sorted = [...ivals].sort((a, b) => a.start - b.start)
  const out: Interval[] = []
  for (const iv of sorted) {
    const last = out[out.length - 1]
    if (last && iv.start <= last.end) {
      last.end = Math.max(last.end, iv.end)
    } else {
      out.push({ ...iv })
    }
  }
  return out
}

export function busyIntervals(bookings: Booking[], day: DayKey, buffer: number): Interval[] {
  const ivals = bookings
    .filter((b) => b.day === day)
    .map((b) => ({
      start: Math.max(0, parseTime(b.start) - buffer),
      end: parseTime(b.end) + buffer
    }))
  return mergeIntervals(ivals)
}

function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function freeIntervals(open: Interval, busy: Interval[]): Interval[] {
  const out: Interval[] = []
  let cursor = open.start
  for (const b of busy) {
    if (b.end <= cursor) continue
    if (b.start >= open.end) break
    if (b.start > cursor) out.push({ start: cursor, end: Math.min(b.start, open.end) })
    cursor = Math.max(cursor, b.end)
    if (cursor >= open.end) break
  }
  if (cursor < open.end) out.push({ start: cursor, end: open.end })
  return out
}

export interface Person {
  bookings: Booking[]
  days: DayKey[]
}

export function commonDays(people: Person[]): DayKey[] {
  if (!people.length) return []
  let days = new Set<DayKey>(people[0].days)
  for (const p of people.slice(1)) {
    const s = new Set(p.days)
    days = new Set([...days].filter((d) => s.has(d)))
  }
  return [...days].sort()
}

export function mutualFree(
  people: Person[],
  day: DayKey,
  openHour: number,
  closeHour: number,
  buffer: number,
  minMinutes: number
): Interval[] {
  const open: Interval = { start: openHour * 60, end: closeHour * 60 }
  const busyAll = people.flatMap((p) => busyIntervals(p.bookings, day, buffer))
  const free = freeIntervals(open, mergeIntervals(busyAll))
  return free.filter((iv) => iv.end - iv.start >= minMinutes)
}

export function findConflicts(bookings: Booking[], candidate: { day: DayKey; start: string; end: string; id?: string }): Booking[] {
  const s = parseTime(candidate.start)
  const e = parseTime(candidate.end)
  return bookings.filter(
    (b) =>
      b.id !== candidate.id &&
      b.day === candidate.day &&
      s < parseTime(b.end) &&
      parseTime(b.start) < e
  )
}
