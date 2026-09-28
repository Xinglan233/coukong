import type { DayKey } from '../types'

export const DAY_META: Record<DayKey, { label: string; weekday: string; date: string }> = {
  '10-02': { label: '周五', weekday: '星期五', date: '10月2日' },
  '10-03': { label: '周六', weekday: '星期六', date: '10月3日' },
  '10-04': { label: '周日', weekday: '星期日', date: '10月4日' },
  '10-05': { label: '周一', weekday: '星期一', date: '10月5日' },
  '10-06': { label: '周二', weekday: '星期二', date: '10月6日' }
}

export function toMinute(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function fromMinute(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

export function sortBookings<T extends { day: DayKey; start: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.day !== b.day) return a.day.localeCompare(b.day)
    return toMinute(a.start) - toMinute(b.start)
  })
}

export function durationLabel(start: string, end: string): string {
  const mins = toMinute(end) - toMinute(start)
  if (mins < 60) return `${mins}分钟`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}小时${m}分` : `${h}小时`
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':')
  return `${Number(h)}:${m}`
}
