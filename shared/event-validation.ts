import schemaValidateV1 from './generated-event-validator.js'
import schemaValidateV2 from './generated-event-v2-validator.js'
import { ACTIVITY_LIMITS, type PersonalPlan } from './activity-contract'
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
export function parseEventPackage(raw: string): EventPackage {
  const parsed = parseStrictJSON(raw, ACTIVITY_LIMITS.packageBytes)
  const version = parsed && typeof parsed === 'object' ? (parsed as {schemaVersion?:unknown}).schemaVersion : undefined
  if (version !== 2 && new TextEncoder().encode(raw).length > LIMITS.packageBytes) reject('$', 'v1文件不能超过512KiB', 'LIMIT_EXCEEDED')
  return validateEventPackage(parsed)
}
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
  const version = value && typeof value === 'object' ? (value as {schemaVersion?:unknown}).schemaVersion : undefined
  const bytes = version === 2 ? ACTIVITY_LIMITS.packageBytes : LIMITS.packageBytes
  if (new TextEncoder().encode(JSON.stringify(value)).length > bytes) reject('$', version === 2 ? 'v2文件不能超过1MiB' : 'v1文件不能超过512KiB', 'LIMIT_EXCEEDED')
  const schemaValidate = version === 2 ? schemaValidateV2 : schemaValidateV1
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
  if (p.schemaVersion === 2) validateSpatial(p)
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

function validateSpatial(p: EventPackage): void {
  const c=p.event.extensions?.convention, path='event.extensions.convention'
  const manifests=new Map<string,NonNullable<EventPackage['assetManifest']>[number]>()
  for(const [i,a] of (p.assetManifest||[]).entries()) {
    if(manifests.has(a.assetKey)) reject(`assetManifest[${i}].assetKey`,'资产键重复')
    if(a.width*a.height>ACTIVITY_LIMITS.pixels) reject(`assetManifest[${i}]`,'图像不能超过2400万像素','LIMIT_EXCEEDED')
    manifests.set(a.assetKey,a)
  }
  if(!c) { if(manifests.size) reject('assetManifest','未绑定地图的资产不能导入'); if(p.event.activities.some(a=>a.sessions.some(s=>s.poiId)))reject('event.activities','场次地点引用不存在'); return }
  const maps=new Map<string,typeof c.maps[number]>(), graphByMap=new Map<string,typeof c.routingGraphs[number]>()
  for(const [i,m] of c.maps.entries()) {const mp=`${path}.maps[${i}]`; if(!m.title.trim())reject(`${mp}.title`,'标题不能为空白');if(maps.has(m.id))reject(`${mp}.id`,'地图ID重复');maps.set(m.id,m);if(m.width*m.height>ACTIVITY_LIMITS.pixels)reject(mp,'图像不能超过2400万像素','LIMIT_EXCEEDED');const a=manifests.get(m.assetKey);if(!a)reject(`${mp}.assetKey`,'资产清单缺少地图文件');if(a.width!==m.width||a.height!==m.height)reject(mp,'地图尺寸与资产清单不符') }
  const referenced=new Set(c.maps.map(m=>m.assetKey));for(const key of manifests.keys())if(!referenced.has(key))reject('assetManifest','存在未绑定地图的资产')
  const graphIds=new Set<string>(); let nodeCount=0,edgeCount=0
  for(const [i,g] of c.routingGraphs.entries()) {const gp=`${path}.routingGraphs[${i}]`,map=maps.get(g.mapId);if(graphIds.has(g.id))reject(`${gp}.id`,'图ID重复');graphIds.add(g.id);if(!map||(map.revision!==g.mapRevision&&!(map.needsReview&&g.mapRevision<map.revision)))reject(`${gp}.mapRevision`,'地图不存在或版本不符');if(graphByMap.has(g.mapId))reject(`${gp}.mapId`,'每张地图仅允许一份当前路网');graphByMap.set(g.mapId,g);nodeCount+=g.nodes.length;edgeCount+=g.edges.length;if(nodeCount>ACTIVITY_LIMITS.nodes||edgeCount>ACTIVITY_LIMITS.edges)reject(gp,'整个活动最多2000节点、4000边','LIMIT_EXCEEDED');const nodes=new Map(g.nodes.map(n=>[n.id,n]));if(nodes.size!==g.nodes.length)reject(`${gp}.nodes`,'节点ID重复');const edges=new Set<string>();for(const [j,e] of g.edges.entries()){const ep=`${gp}.edges[${j}]`;if(edges.has(e.id))reject(`${ep}.id`,'边ID重复');edges.add(e.id);if(e.from===e.to||!nodes.has(e.from)||!nodes.has(e.to))reject(ep,'边必须引用不同且已存在的节点');const from=nodes.get(e.from)!,to=nodes.get(e.to)!;if(e.geometry){const first=e.geometry[0],last=e.geometry[e.geometry.length-1];if(first.x!==from.x||first.y!==from.y||last.x!==to.x||last.y!==to.y)reject(`${ep}.geometry`,'折线必须按from到to方向起止于引用节点')}else if(from.x===to.x&&from.y===to.y&&!e.estimatedTravelSeconds&&!e.distanceMeters)reject(ep,'零长度边必须有可信正权重');for(const d of e.closedDates||[])if(!p.event.days.some(day=>day.date===d))reject(`${ep}.closedDates`,'关闭日期必须在活动日期内') } }
  const pois=new Set<string>();for(const [i,poi] of c.pois.entries()){const pp=`${path}.pois[${i}]`;if(pois.has(poi.id))reject(`${pp}.id`,'地点ID重复');pois.add(poi.id);if(!poi.name.trim())reject(`${pp}.name`,'名称不能为空白');if(poi.tags?.some(t=>!t.trim())||new Set(poi.tags?.map(t=>t.trim())).size!==(poi.tags?.length||0))reject(`${pp}.tags`,'标签不能为空或重复');if(poi.position){const map=maps.get(poi.position.mapId);if(!map||(map.revision!==poi.position.mapRevision&&!(map.needsReview&&poi.position.mapRevision<map.revision)))reject(`${pp}.position`,'地图不存在或版本不符');if(poi.routeNodeId&&!graphByMap.get(map.id)?.nodes.some(n=>n.id===poi.routeNodeId))reject(`${pp}.routeNodeId`,'地点入口节点不存在于所在地图路网')}else if(poi.routeNodeId)reject(`${pp}.routeNodeId`,'关联路网节点前须声明地图位置')}
  for(const [i,a] of p.event.activities.entries())for(const [j,s] of a.sessions.entries())if(s.poiId&&!pois.has(s.poiId))reject(`event.activities[${i}].sessions[${j}].poiId`,'场次地点ID不存在')
}
export function validatePersonalPlan(value:unknown,event:EventData,options:{allowMissingReferences?:boolean}={}):PersonalPlan {
 const plan=object(value,['response','favorites','routes'],['response','favorites','routes'],'plan')
 validateResponse(plan.response,event)
 if(!Array.isArray(plan.favorites)||plan.favorites.length>ACTIVITY_LIMITS.favorites||!Array.isArray(plan.routes)||plan.routes.length>31)reject('plan','收藏最多1000条、每日路线最多31条','LIMIT_EXCEEDED')
 const c=event.extensions?.convention,poiIds=new Set(c?.pois.map(p=>p.id)||[]),mapIds=new Set(c?.maps.map(m=>m.id)||[]),favorites=new Set<string>(),dates=new Set<string>()
 const id=(v:unknown,path:string)=>{if(typeof v!=='string'||!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(v))reject(path,'ID格式无效');if(!options.allowMissingReferences&&!poiIds.has(v as string))reject(path,'地点不存在于当前活动')}
 plan.favorites.forEach((raw,i)=>{const f=object(raw,['poiId','visited'],['poiId','visited'],`plan.favorites[${i}]`);id(f.poiId,`plan.favorites[${i}].poiId`);if(favorites.has(f.poiId as string)||typeof f.visited!=='boolean')reject(`plan.favorites[${i}]`,'收藏重复或状态无效');favorites.add(f.poiId as string)})
 plan.routes.forEach((raw,i)=>{const rp=`plan.routes[${i}]`,r=object(raw,['date','mapId','startPoiId','stops','spatialRevision'],['date','stops','spatialRevision'],rp);if(typeof r.date!=='string'||!event.days.some(d=>d.date===r.date)||dates.has(r.date))reject(`${rp}.date`,'日期不在活动内或重复');dates.add(r.date as string);if(r.mapId!==undefined&&(typeof r.mapId!=='string'||!r.mapId||(!options.allowMissingReferences&&!mapIds.has(r.mapId))))reject(`${rp}.mapId`,'地图不存在');if(!Number.isInteger(r.spatialRevision)||Number(r.spatialRevision)<1)reject(`${rp}.spatialRevision`,'空间版本须为正整数');if(r.startPoiId!==undefined){id(r.startPoiId,`${rp}.startPoiId`);const start=c?.pois.find(p=>p.id===r.startPoiId);if(r.mapId!==undefined&&start?.position&&start.position.mapId!==r.mapId)reject(`${rp}.startPoiId`,'首发路线不支持跨图')}if(!Array.isArray(r.stops)||r.stops.length>ACTIVITY_LIMITS.routeStops)reject(`${rp}.stops`,'路线最多100站','LIMIT_EXCEEDED');const stops=new Set<string>();r.stops.forEach((raw,j)=>{const sp=`${rp}.stops[${j}]`,s=object(raw,['poiId','visited','stayMinutes','queueMinutes'],['poiId','visited'],sp);id(s.poiId,`${sp}.poiId`);if(stops.has(s.poiId as string)||typeof s.visited!=='boolean')reject(sp,'站点重复或状态无效');stops.add(s.poiId as string);for(const k of ['stayMinutes','queueMinutes'])if(s[k]!==undefined&&(!Number.isInteger(s[k])||Number(s[k])<0||Number(s[k])>1440))reject(`${sp}.${k}`,'须为0–1440整数分钟');const poi=c?.pois.find(p=>p.id===s.poiId);if(r.mapId!==undefined&&poi?.position&&poi.position.mapId!==r.mapId)reject(`${sp}.poiId`,'首发路线不支持跨图')}) })
 return value as PersonalPlan
}
