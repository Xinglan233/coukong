// 展示层日期格式化：存储、协议与算法保持原始 ISO 值，只有界面经这里转换
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function parts(date: string): { y: number; m: number; d: number; weekday: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
  if (!match) return null
  const [, y, m, d] = match
  const weekday = WEEKDAYS[new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))).getUTCDay()]
  return { y: Number(y), m: Number(m), d: Number(d), weekday }
}

// 2026-10-03 → 10/03
export function md(date: string): string {
  const p = parts(date)
  return p ? `${p.m}/${String(p.d).padStart(2, '0')}` : date
}

// 区间省略重复月份与年份：10/03–10/04、10/31–11/02
export function mdRange(start: string, end: string): string {
  const a = parts(start)
  const b = parts(end)
  if (!a || !b) return `${start}–${end}`
  if (a.y === b.y && a.m === b.m) return `${a.m}/${String(a.d).padStart(2, '0')}–${String(b.d).padStart(2, '0')}`
  return `${md(start)}–${md(end)}`
}

// 跨年区间带上年份：2026/12/30–2027/01/02
export function rangeText(start: string, end: string): string {
  const a = parts(start)
  const b = parts(end)
  if (!a || !b) return `${start}–${end}`
  if (a.y !== b.y) return `${a.y}/${md(start)}–${b.y}/${md(end)}`
  return mdRange(start, end)
}

// 2026-10-03 → 10月3日 周六
export function dateCn(date: string): string {
  const p = parts(date)
  return p ? `${p.m}月${p.d}日 ${p.weekday}` : date
}

// 2026-10-03 → 周六
export function weekdayCn(date: string): string {
  return parts(date)?.weekday || ''
}

// ISO 时间戳 → 10/1 09:47
export function stamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
