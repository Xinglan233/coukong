import {Clock,MapPin} from 'lucide-react'
import type {ActivityDTO,PersonalPlan} from '../../../shared/activity-contract'
import {planReference,type ReferenceSync} from './figma-adapter'

const states={saved:'已保存到云端',local:'未保存到云端',pending:'待联网保存',needs_review:'需要复核'} as const
export function FigmaPlanTimeline({activity,plan,date,sync,onEdit}:{activity:ActivityDTO;plan:PersonalPlan;date:string;sync:ReferenceSync;onEdit:(id:string)=>void}){
 const {items}=planReference(activity,plan,date,sync)
 if(!items.length)return <div className="empty"><div className="empty-title">当天还没有安排</div><div className="empty-sub">手动添加，或从活动里选择场次</div></div>
 return <div className="sched-list figma-plan-timeline">{items.map(item=><div className="figma-plan-entry" key={item.id}><span className="figma-plan-time" aria-hidden="true">{item.start}</span><span className={`figma-plan-dot ${item.conflict?'is-warning':''}`} aria-hidden="true"/><button className="sched-row figma-plan-card" aria-label={`${item.start}–${item.end} ${item.title||'待填写'} ${states[item.state]}`} onClick={()=>onEdit(item.id)}><div className="figma-plan-card-head"><span className="sched-title">{item.title||'待填写'}</span><span className={`figma-badge ${item.state==='needs_review'?'is-warning':item.state==='saved'?'is-accent':''}`}>{states[item.state]}</span></div><span className="sched-meta"><Clock size={13}/><span>{item.start}–{item.end}{item.durationMinutes!==null?` · ${item.durationMinutes} 分`:''}</span>{item.location&&<><span aria-hidden="true">|</span><MapPin size={13}/><span>{item.location}</span></>}</span>{item.conflict&&<span className="figma-badge is-warning figma-conflict">时间冲突 · 点按调整</span>}</button></div>)}</div>
}
