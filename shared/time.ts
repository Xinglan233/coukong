import type { TimeInterval } from './types'
export type MinuteRange = [number, number]
export function toMinute(value: string, allowEnd = false): number {
  if (allowEnd && value === '24:00') return 1440
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new RangeError('时间必须为有效 HH:mm；24:00 仅允许作为结束')
  const [h, m] = value.split(':').map(Number); return h * 60 + m
}
export function fromMinute(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 1440) throw new RangeError('分钟须在 0–1440')
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}
export function dateOrdinal(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RangeError('日期须为 YYYY-MM-DD')
  const value = Date.parse(`${date}T00:00:00Z`)
  if (!Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== date) throw new RangeError('日期无效')
  return value / 86400000
}
export function validateTimeRange(interval: TimeInterval): boolean {
  try { return toMinute(interval.start) < toMinute(interval.end, true) } catch { return false }
}
export function minuteRange(interval: TimeInterval): MinuteRange {
  const start = toMinute(interval.start), end = toMinute(interval.end, true)
  if (end <= start) throw new RangeError('结束时间必须晚于开始时间')
  return [start, end]
}
export function mergeRanges(input: MinuteRange[]): MinuteRange[] {
  const sorted = input.filter(([s,e]) => s < e).map(([s,e]):MinuteRange => [s,e]).sort((a,b) => a[0]-b[0] || a[1]-b[1])
  const out: MinuteRange[] = []
  for (const [s,e] of sorted) { const last = out[out.length-1]; if (last && s <= last[1]) last[1] = Math.max(e,last[1]); else out.push([s,e]) }
  return out
}
export function intersectRanges(a: MinuteRange[], b: MinuteRange[]): MinuteRange[] {
  const left = mergeRanges(a), right = mergeRanges(b), out: MinuteRange[] = []; let i=0,j=0
  while(i<left.length && j<right.length) { const s=Math.max(left[i][0],right[j][0]),e=Math.min(left[i][1],right[j][1]); if(s<e) out.push([s,e]); if(left[i][1]<right[j][1]) i++; else j++ }
  return out
}
export function subtractRanges(a: MinuteRange[], b: MinuteRange[]): MinuteRange[] {
  const busy=mergeRanges(b),out:MinuteRange[]=[]
  for(const [s,e] of mergeRanges(a)) { let cursor=s; for(const [bs,be] of busy) { if(be<=cursor) continue; if(bs>=e) break; if(bs>cursor) out.push([cursor,Math.min(bs,e)]); cursor=Math.max(cursor,be); if(cursor>=e) break } if(cursor<e) out.push([cursor,e]) }
  return out
}
