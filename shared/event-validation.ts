import schemaValidate from './generated-event-validator.js'
import { LIMITS, type EventPackage, type EventData, type ParticipantResponse, type TimeInterval } from './types'

export class ValidationError extends Error {
  name = 'ValidationError'
  constructor(public code: string, message: string, public fields: { path: string; message: string }[] = []) { super(message) }
}
function reject(path: string, message: string, code = 'INVALID_EVENT_PACKAGE'): never {
  throw new ValidationError(code, `${path}：${message}`, [{ path, message }])
}
export function parseStrictJSON(raw: string, maxBytes = LIMITS.packageBytes): unknown {
  if (new TextEncoder().encode(raw).length > maxBytes) reject('$', '请求或文件超过允许大小', 'LIMIT_EXCEEDED')
  let i = 0
  const ws = () => { while (/\s/.test(raw[i] || '') && i < raw.length) i++ }
  function str(): string {
    const start = i++
    while (i < raw.length) {
      if (raw[i] === '\\') { i += 2; continue }
      if (raw[i++] === '"') return JSON.parse(raw.slice(start, i)) as string
    }
    reject('$', 'JSON 字符串未闭合')
  }
  function value(depth: number): unknown {
    if (depth > 32) reject('$', 'JSON 嵌套过深')
    ws()
    if (raw[i] === '"') return str()
    if (raw[i] === '{') {
      i++; ws()
      const out = Object.create(null) as Record<string, unknown>
      if (raw[i] === '}') { i++; return out }
      while (i < raw.length) {
        ws(); if (raw[i] !== '"') reject('$', 'JSON 对象键必须用双引号')
        const key = str()
        if (Object.prototype.hasOwnProperty.call(out, key)) reject('$', `重复对象键 ${key}`)
        ws(); if (raw[i++] !== ':') reject('$', 'JSON 缺少冒号')
        out[key] = value(depth + 1); ws()
        const c = raw[i++]
        if (c === '}') return out
        if (c !== ',') reject('$', 'JSON 对象格式错误')
      }
    }
    if (raw[i] === '[') {
      i++; ws(); const out: unknown[] = []
      if (raw[i] === ']') { i++; return out }
      while (i < raw.length) {
        out.push(value(depth + 1)); ws(); const c = raw[i++]
        if (c === ']') return out
        if (c !== ',') reject('$', 'JSON 数组格式错误')
      }
    }
    const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(raw.slice(i))
    if (match) { i += match[0].length; return JSON.parse(match[0]) }
    reject('$', 'JSON 格式错误，不支持注释或尾逗号')
  }
  try { const out = value(0); ws(); if (i !== raw.length) reject('$', 'JSON 后存在多余内容'); return out }
  catch (e) { if (e instanceof ValidationError) throw e; reject('$', 'JSON 格式错误') }
}
export function parseEventPackage(raw: string): EventPackage { return validateEventPackage(parseStrictJSON(raw)) }
const minute = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3))
export function dateOrdinal(s: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || s < '1900-01-01' || s > '2100-12-31') return NaN
  const timestamp = Date.parse(`${s}T00:00:00Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === s ? timestamp / 86400000 : NaN
}
function range(v: TimeInterval, path: string) {
  if (!v || typeof v.start !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v.start)) reject(`${path}.start`, '开始须为 00:00–23:59', 'INVALID_TIME_RANGE')
  if (typeof v.end !== 'string' || !/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.test(v.end)) reject(`${path}.end`, '结束须为分钟时间，可用 24:00', 'INVALID_TIME_RANGE')
  if (minute(v.end) <= minute(v.start)) reject(`${path}.end`, '结束时间必须晚于开始时间', 'INVALID_TIME_RANGE')
}
const timezoneCache = new Map<string, boolean>()
function checkTimezoneDates(e: EventData) {
  let format: Intl.DateTimeFormat
  try { format = new Intl.DateTimeFormat('en-US', { timeZone: e.timezone, timeZoneName: 'longOffset' }) }
  catch { reject('event.timezone', '需要有效的 IANA 时区') }
  // Shanghai and UTC have no DST in the supported 1900–2100 date range used by this product.
  // Historical Shanghai DST is handled by the same offset check before 1992.
  if (e.timezone === 'UTC' || (e.timezone === 'Asia/Shanghai' && e.startDate >= '1992-01-01')) return
  for (const d of e.days) {
    const key = `${e.timezone}:${d.date}`
    if (timezoneCache.has(key)) { if (!timezoneCache.get(key)) reject(`event.days.${d.date}`, '第一版不支持时区切换日及相邻日期', 'UNSUPPORTED_TIMEZONE_DATE'); continue }
    const base = dateOrdinal(d.date) * 86400000
    const offsets = new Set([-24, -12, 0, 12, 24, 36].map(h => format.formatToParts(base + h * 3600000).find(p => p.type === 'timeZoneName')?.value))
    const ok = offsets.size === 1
    if (timezoneCache.size > 256) timezoneCache.clear()
    timezoneCache.set(key, ok)
    if (!ok) reject(`event.days.${d.date}`, '第一版不支持时区切换日及相邻日期', 'UNSUPPORTED_TIMEZONE_DATE')
  }
}
export function validateEventPackage(value: unknown): EventPackage {
  if (new TextEncoder().encode(JSON.stringify(value)).length > LIMITS.packageBytes) reject('$', '文件不能超过 512 KiB', 'LIMIT_EXCEEDED')
  if (!schemaValidate(value)) {
    const fields = (schemaValidate.errors || []).slice(0, 20).map(e => ({ path: e.instancePath || '$', message: '字段类型、必填项或格式不符合活动包 Schema' }))
    throw new ValidationError('INVALID_EVENT_PACKAGE', '活动包结构错误，请检查字段与格式', fields)
  }
  const p = value as EventPackage, e = p.event
  const begin = dateOrdinal(e.startDate), end = dateOrdinal(e.endDate)
  if (!Number.isFinite(begin)) reject('event.startDate', '日期须为真实日历日期（1900–2100）')
  if (!Number.isFinite(end) || end < begin || end - begin >= LIMITS.days) reject('event.endDate', '日期须真实、顺序正确且范围最多 31 天')
  const text = (s: string, path: string) => { if (!s.trim()) reject(path, '不能全部为空白') }
  text(e.title, 'event.title')
  const dates = new Map<string, TimeInterval[]>()
  for (const [i, d] of e.days.entries()) {
    const n = dateOrdinal(d.date), path = `event.days[${i}]`
    if (!Number.isFinite(n) || n < begin || n > end || dates.has(d.date)) reject(`${path}.date`, '日期无效、重复或超出范围')
    let previous = -1
    for (const [j, iv] of d.openIntervals.entries()) {
      range(iv, `${path}.openIntervals[${j}]`)
      if (minute(iv.start) < previous) reject(`${path}.openIntervals[${j}]`, '开放区间必须升序且不重叠')
      previous = minute(iv.end)
    }
    dates.set(d.date, d.openIntervals)
  }
  if (dates.size !== end - begin + 1) reject('event.days', '日期范围内每一天须恰好一条，关闭日用空区间')
  checkTimezoneDates(e)
  const activityIds = new Set<string>(), sessionIds = new Set<string>()
  for (const [i, a] of e.activities.entries()) {
    const path = `event.activities[${i}]`; text(a.title, `${path}.title`)
    if (activityIds.has(a.id)) reject(`${path}.id`, '活动 ID 重复'); activityIds.add(a.id)
    a.tags?.forEach((t, j) => text(t, `${path}.tags[${j}]`))
    if (new Set(a.tags?.map(t => t.trim())).size !== (a.tags?.length || 0)) reject(`${path}.tags`, '标签去空白后重复')
    for (const [j, s] of a.sessions.entries()) {
      const sp = `${path}.sessions[${j}]`; range(s, sp)
      if (sessionIds.has(s.id)) reject(`${sp}.id`, '场次 ID 在整个包内必须唯一'); sessionIds.add(s.id)
      if (sessionIds.size > LIMITS.sessions) reject('event.activities', '总场次数最多 1000', 'LIMIT_EXCEEDED')
      if (!dates.get(s.date)?.some(iv => minute(s.start) >= minute(iv.start) && minute(s.end) <= minute(iv.end))) reject(sp, '场次必须完整位于当天开放区间内')
    }
  }
  return p
}
function object(v: unknown, keys: string[], required: string[], path: string): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) reject(path, '须为对象')
  const o = v as Record<string, unknown>
  if (Object.keys(o).some(k => !keys.includes(k)) || required.some(k => !Object.prototype.hasOwnProperty.call(o, k))) reject(path, '存在未知字段或缺少必填字段')
  return o
}
export function validateResponse(value: unknown, event: EventData): ParticipantResponse {
  const r = object(value, ['name','presence','busy','bufferMinutes'], ['name','presence','busy','bufferMinutes'], 'response')
  if (typeof r.name !== 'string' || !r.name.trim() || r.name.length > 50) reject('response.name', '昵称须为 1–50 字符')
  if (!Number.isInteger(r.bufferMinutes) || Number(r.bufferMinutes) < 0 || Number(r.bufferMinutes) > 120) reject('response.bufferMinutes', '缓冲须为 0–120 整数')
  if (!Array.isArray(r.presence) || r.presence.length > LIMITS.days || !Array.isArray(r.busy) || r.busy.length > LIMITS.busy) reject('response', '可参与日期最多31天，安排最多500条', 'LIMIT_EXCEEDED')
  const dates = new Set(event.days.map(d => d.date)), seen = new Set<string>(), ids = new Set<string>()
  r.presence.forEach((raw, i) => {
    const path = `response.presence[${i}]`, d = object(raw, ['date','intervals'], ['date','intervals'], path)
    if (typeof d.date !== 'string' || !dates.has(d.date) || seen.has(d.date)) reject(`${path}.date`, '日期重复或不在活动中'); seen.add(d.date)
    if (!Array.isArray(d.intervals) || d.intervals.length > LIMITS.intervals) reject(`${path}.intervals`, '每天最多24段', 'LIMIT_EXCEEDED')
    d.intervals.forEach((iv, j) => { object(iv, ['start','end'], ['start','end'], `${path}.intervals[${j}]`); range(iv as TimeInterval, `${path}.intervals[${j}]`) })
  })
  r.busy.forEach((raw, i) => {
    const path = `response.busy[${i}]`, b = object(raw, ['id','date','start','end','title','location','note','source','sessionId'], ['id','date','start','end','title','source'], path)
    if (typeof b.id !== 'string' || b.id.length < 1 || b.id.length > 100 || ids.has(b.id)) reject(`${path}.id`, '安排 ID 不能为空或重复'); ids.add(b.id)
    if (typeof b.date !== 'string' || !dates.has(b.date)) reject(`${path}.date`, '日期不在活动中')
    range(b as unknown as TimeInterval, path)
    if (typeof b.title !== 'string' || !b.title.trim() || b.title.length > 100) reject(`${path}.title`, '标题须为1–100字符')
    for (const [key, max] of [['location',200],['note',2000]] as const) if (b[key] !== undefined && (typeof b[key] !== 'string' || (b[key] as string).length > max)) reject(`${path}.${key}`, `最多${max}字符`)
    if (!['manual','session','legacy'].includes(String(b.source))) reject(`${path}.source`, '安排来源无效')
    if (b.source === 'session') {
      const session = event.activities.flatMap(a => a.sessions).find(s => s.id === b.sessionId)
      if (!session || session.date !== b.date || session.start !== b.start || session.end !== b.end) reject(`${path}.sessionId`, '场次已变化，请复核后重新选择', 'RECONFIRM_REQUIRED')
    } else if (b.sessionId !== undefined) reject(`${path}.sessionId`, '只有场次安排能指定场次 ID')
  })
  return value as ParticipantResponse
}
