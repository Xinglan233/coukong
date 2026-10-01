import type {ActivityDTO,PersonalPlan} from '../../../shared/activity-contract'
import {ACTIVITY_LIMITS} from '../../../shared/activity-contract'
import {parseStrictJSON,validatePersonalPlan} from '../../../shared/event-validation'
export type DateStatus='upcoming'|'ongoing'|'ended'|'cancelled'|'archived'
export function activityDateStatus(a:ActivityDTO,now=new Date()):DateStatus {
 if(a.status==='cancelled'||a.status==='archived')return a.status
 const e=a.eventPackage.event,parts=new Intl.DateTimeFormat('en-CA',{timeZone:e.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now)
 const part=(name:string)=>parts.find(p=>p.type===name)!.value,today=`${part('year')}-${part('month')}-${part('day')}`
 return today<e.startDate?'upcoming':today>e.endDate?'ended':'ongoing'
}
export const dateStatusText:Record<DateStatus,string>={upcoming:'未开始',ongoing:'进行中',ended:'已结束',cancelled:'已取消',archived:'已归档'}
export function activityUpdatedAt(a:ActivityDTO):string {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:a.eventPackage.event.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(a.updatedAt))
 const p=(name:string)=>parts.find(p=>p.type===name)!.value
 return `${p('year')}-${p('month')}-${p('day')} ${p('hour')}:${p('minute')}`
}
export function activityLocalKey(key:string,eventId:string):boolean {
 return ['activity-cap:','activity-personal:','activity-snapshot:','activity-personal-create:','activity-create-group:','activity-preferences:','activity-recent:'].some(prefix=>key===prefix+eventId)||['activity-submit:','activity-delete:','personal-busy-editor:'].some(prefix=>key.startsWith(prefix+eventId+':'))||key.startsWith(`activity-prepared:v1:${encodeURIComponent(eventId)}:`)
}
export function personalBackup(activity:ActivityDTO,plan:PersonalPlan,personId?:string,versions?:{scheduleRevision:number;spatialRevision:number}){return {kind:'tongye.personal-plan',schemaVersion:1,eventId:activity.id,...(personId?{personId}:{}),scheduleRevision:versions?.scheduleRevision??activity.scheduleRevision,spatialRevision:versions?.spatialRevision??activity.spatialRevision,plan}}
export function readPersonalBackup(raw:string,activity:ActivityDTO,personId:string|undefined,current?:PersonalPlan):PersonalPlan {
 const parsed=parseStrictJSON(raw,ACTIVITY_LIMITS.personalPlanBytes+8192)
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('请选择个人计划备份')
 const p=parsed as Record<string,unknown>,allowed=['kind','schemaVersion','eventId','personId','scheduleRevision','spatialRevision','plan']
 if(Object.keys(p).some(k=>!allowed.includes(k))||p.kind!=='tongye.personal-plan'||p.schemaVersion!==1)throw new Error('个人计划格式无效，不接受权限或活动资料')
 if(p.eventId!==activity.id)throw new Error('备份不属于当前活动')
 if(!personId)throw new Error('请先保存个人计划或打开本人恢复链接')
 if(p.personId!==undefined&&p.personId!==personId)throw new Error('备份不属于当前身份，请打开原个人恢复链接')
 for(const field of ['scheduleRevision','spatialRevision'])if(p[field]!==undefined&&(!Number.isInteger(p[field])||Number(p[field])<1))throw new Error('备份版本格式无效')
 if(p.scheduleRevision!==undefined&&p.scheduleRevision!==activity.scheduleRevision)throw new Error('活动时间已变化，请先核对原备份后手动调整')
 if(p.spatialRevision!==undefined&&p.spatialRevision!==activity.spatialRevision)throw new Error('地图资料已变化，请先核对原备份后手动调整')
 if(new TextEncoder().encode(JSON.stringify(p.plan)).byteLength>ACTIVITY_LIMITS.personalPlanBytes)throw new Error('个人计划超过大小限制')
 const plan=validatePersonalPlan(p.plan,activity.eventPackage.event,{allowMissingReferences:!!current})
 if(current){const c=activity.eventPackage.event.extensions?.convention,known=new Set(c?.pois.map(p=>p.id)||[]),old=new Set([...current.favorites.map(f=>f.poiId),...current.routes.flatMap(r=>[...(r.startPoiId?[r.startPoiId]:[]),...r.stops.map(s=>s.poiId)])]);for(const id of [...plan.favorites.map(f=>f.poiId),...plan.routes.flatMap(r=>[...(r.startPoiId?[r.startPoiId]:[]),...r.stops.map(s=>s.poiId)])])if(!known.has(id)&&!old.has(id))throw new Error('备份包含当前活动没有的地点');const maps=new Set(c?.maps.map(m=>m.id)||[]),oldMaps=new Set(current.routes.map(r=>r.mapId));for(const r of plan.routes)if(r.mapId&&!maps.has(r.mapId)&&!oldMaps.has(r.mapId))throw new Error('备份包含当前活动没有的地图')}
 return plan
}
