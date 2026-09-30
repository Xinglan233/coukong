import type { AvailabilityPerson, DatedInterval, EventData, MemberSummary, ParticipantResponse } from './types'
import { dateOrdinal, fromMinute, intersectRanges, mergeRanges, minuteRange, subtractRanges, type MinuteRange } from './time'
export function personalAvailability(event: EventData, response: ParticipantResponse): DatedInterval[] {
  if (!Number.isInteger(response.bufferMinutes) || response.bufferMinutes < 0 || response.bufferMinutes > 120) throw new RangeError('缓冲须为 0–120 整数分钟')
  const busy = mergeRanges(response.busy.map(item => { const base=dateOrdinal(item.date)*1440; const [s,e]=minuteRange(item); return [base+s-response.bufferMinutes,base+e+response.bufferMinutes] }))
  return event.days.flatMap(day => {
    const base=dateOrdinal(day.date)*1440
    const open=day.openIntervals.map(minuteRange)
    const presence=response.presence.filter(p=>p.date===day.date).flatMap(p=>p.intervals.map(minuteRange))
    const available=intersectRanges(open,presence).map(([s,e]):MinuteRange=>[base+s,base+e])
    return subtractRanges(available,busy).map(([s,e])=>({date:day.date,start:fromMinute(s-base),end:fromMinute(e-base)}))
  })
}
export function commonAvailability(event: EventData, members: AvailabilityPerson[], selectedIds: string[], minMinutes: number): {intervals:DatedInterval[];waiting:MemberSummary[]} {
  if(!Number.isInteger(minMinutes)||minMinutes<1||minMinutes>240) throw new RangeError('最短时长须为 1–240 整数分钟')
  const ids=[...new Set(selectedIds)], selected:AvailabilityPerson[]=[],waiting:MemberSummary[]=[]
  for(const id of ids) { const person=members.find(m=>m.id===id); if(!person) waiting.push({id,name:'成员不存在或已离开',status:'unsubmitted',revision:0,confirmedScheduleRevision:null,updatedAt:'',submittedAt:null}); else if(person.status!=='confirmed') { waiting.push({id:person.id,name:person.name,status:person.status,revision:person.revision,confirmedScheduleRevision:person.confirmedScheduleRevision,updatedAt:person.updatedAt,submittedAt:person.submittedAt}) } else selected.push(person) }
  if(!ids.length||waiting.length) return {intervals:[],waiting}
  const intervals=event.days.flatMap(day=>{
    let ranges=day.openIntervals.map(minuteRange)
    for(const member of selected) ranges=intersectRanges(ranges,member.availability.filter(i=>i.date===day.date).map(minuteRange))
    return ranges.filter(([s,e])=>e-s>=minMinutes).map(([s,e])=>({date:day.date,start:fromMinute(s),end:fromMinute(e)}))
  })
  return {intervals,waiting}
}
