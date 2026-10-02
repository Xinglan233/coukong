import {useState} from 'react'
import {Search,Plus,Clock,MapPin} from 'lucide-react'
import type {ActivityDTO} from '../../../shared/activity-contract'
import {planCatalog} from './plan-catalog'
import {dateCn} from './fmt'

// AddScheduleSheet from the designated Figma Make; only current real activity sources.
export function FigmaPlanPicker({activity,date,onCustom,onPoi,onSession}:{activity:ActivityDTO;date:string;onCustom:()=>void;onPoi:(id:string)=>void;onSession:(id:string)=>void}){
 const [query,setQuery]=useState(''),event=activity.eventPackage.event
 const {pois,sessions}=planCatalog(event,date,query),hasSessions=event.activities.some(a=>a.sessions.some(s=>s.date===date))
 return <div className="figma-plan-picker"><label className="figma-search"><Search size={17}/><input aria-label="搜索摊位、地点或场次" placeholder="搜索摊位、地点或场次" value={query} onChange={e=>setQuery(e.target.value)}/></label>
  <div className="card me-card figma-picker-custom"><button className="me-row figma-picker-row" onClick={onCustom}><span className="figma-picker-icon is-accent"><Plus size={18}/></span><span className="me-row-label">添加自定义安排</span></button></div>
  {pois.length===0&&sessions.length===0?<div className="empty"><div className="empty-sub">没有匹配的地点或场次</div></div>:<><h3 className="section-label">{dateCn(date)}相关</h3>{!hasSessions&&<p className="page-sub figma-picker-hint">该日暂无已公布场次，可选地点后设置时间</p>}<div className="card me-card figma-picker-sources">
   {sessions.map(s=><button className="me-row figma-picker-row" key={`session:${s.sessionId}`} onClick={()=>onSession(s.sessionId)}><span className="figma-picker-icon"><Clock size={16}/></span><span className="me-row-label"><span className="sched-title">{s.title}</span><span className="sched-meta">{s.location?s.location+' · ':''}{s.start}–{s.end}</span></span></button>)}
   {pois.map(p=><button className="me-row figma-picker-row" key={`poi:${p.id}`} onClick={()=>onPoi(p.id)}><span className="figma-picker-icon"><MapPin size={16}/></span><span className="me-row-label"><span className="sched-title">{p.name}</span>{(p.boothCode||p.tags?.length)&&<span className="sched-meta">{[p.boothCode,...p.tags||[]].filter(Boolean).join(' · ')}</span>}</span></button>)}
  </div></>}
 </div>
}
