import type {EventData,EventSession,BusyItem} from '../../../shared/types'
import type {POI} from '../../../shared/activity-contract'

export interface PlanSessionSource {
 sessionId:string;title:string;date:string;start:string;end:string;location?:string;poiId?:string
}

function poiLocation(poi:POI):string{return [poi.name,poi.boothCode].filter(Boolean).join(' · ')}

function sessionSource(session:EventSession,title:string,location?:string,poi?:POI):PlanSessionSource {
 return {sessionId:session.id,title,date:session.date,start:session.start,end:session.end,location:session.location||location||(poi?poiLocation(poi):undefined),poiId:session.poiId}
}

/** Sources are resolved from the current activity package, never from favorites or routes. */
export function planCatalog(event:EventData,date:string,query:string){
 const needle=query.trim().toLocaleLowerCase()
 const matches=(values:(string|undefined)[])=>values.some(v=>v?.toLocaleLowerCase().includes(needle))
 const allPois=event.extensions?.convention.pois||[],byId=new Map(allPois.map(p=>[p.id,p]))
 const pois=allPois.filter(p=>!p.closed&&matches([p.name,p.boothCode,p.description,...p.tags||[]]))
 const sessions=event.activities.flatMap(activity=>activity.sessions.filter(s=>s.date===date).map(s=>{
  const poi=s.poiId?byId.get(s.poiId):undefined
  const source=sessionSource(s,activity.title,activity.location,poi)
  return {source,visible:!poi?.closed&&matches([activity.title,activity.description,source.location,poi?.name,poi?.boothCode,...activity.tags||[],...poi?.tags||[]])}
 })).filter(s=>s.visible).map(s=>s.source).sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title)||a.sessionId.localeCompare(b.sessionId))
 return {pois,sessions}
}

export function sessionArrangement(event:EventData,sessionId:string,itemId:string):BusyItem {
 const activity=event.activities.find(a=>a.sessions.some(s=>s.id===sessionId)),session=activity?.sessions.find(s=>s.id===sessionId)
 if(!activity||!session)throw new Error('场次已移除，请刷新活动资料')
 const poi=event.extensions?.convention.pois.find(p=>p.id===session.poiId)
 if(poi?.closed)throw new Error('地点已关闭，请核对当前场次')
 const source=sessionSource(session,activity.title,activity.location,poi)
 return {id:itemId,source:'session',sessionId:source.sessionId,title:source.title,date:source.date,start:source.start,end:source.end,...source.location?{location:source.location}:{}}
}

/** A place without a published session has no inferred time. It remains an editor draft. */
export function poiArrangement(event:EventData,poiId:string,date:string,itemId:string):BusyItem {
 const poi=event.extensions?.convention.pois.find(p=>p.id===poiId)
 if(!poi||poi.closed)throw new Error('地点已移除或关闭，请刷新活动资料')
 if(!event.days.some(d=>d.date===date))throw new Error('请选择活动范围内的日期')
 return {id:itemId,source:'manual',date,title:poi.name,location:poiLocation(poi),start:'',end:''}
}
