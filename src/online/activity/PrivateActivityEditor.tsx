import {useEffect,useRef,useState} from 'react'
import {ACTIVITY_LIMITS,type ActivityDTO} from '../../../shared/activity-contract'
import type {EventPackage} from '../../../shared/types'
import {parseEventPackage} from '../../../shared/event-validation'
import {dateOrdinal} from '../../../shared/time'
import {Sheet} from '../../ui/Sheet'
import {Disclosure} from '../../ui/Disclosure'
import {api,ApiFailure} from '../api'
import {download,readLocal,removeLocal,writeLocal} from '../storage'
export interface PrivateEditDraft {eventId:string;expectedRevision:number;pack:EventPackage;raw:string;mode:'form'|'json';pending?:PrivatePatch}
export interface PrivatePatch {operationId:string;expectedRevision:number;eventPackage:EventPackage}
export function parsePrivateActivityEdit(raw:string,externalId:string):EventPackage{
 const pack=parseEventPackage(raw)
 if((pack.event.eventType??'generic')!=='generic'||pack.event.extensions||pack.assetManifest)throw new Error('私人日常活动只支持通用活动资料，不接受漫展地图扩展')
 if(pack.event.id!==externalId)throw new Error('活动文件的 ID 与原资料不同。更新时请保留原 ID')
 return pack
}
export function privateDateRange(pack:EventPackage,start:string,end:string):EventPackage{
 const a=dateOrdinal(start),b=dateOrdinal(end)
 if(b<a||b-a>30)throw new Error('日期范围须为1–31天')
 const days=Array.from({length:b-a+1},(_,i)=>{const date=new Date((a+i)*86400000).toISOString().slice(0,10),existing=pack.event.days.find(d=>d.date===date);return {date,openIntervals:structuredClone(existing?.openIntervals??pack.event.days[0]?.openIntervals??[])}})
 // Sessions outside the new date range remain visible to validation, never silently removed.
 return {...pack,event:{...pack.event,startDate:start,endDate:end,days}}
}
export function initialPrivateEdit(activity:ActivityDTO):PrivateEditDraft{return {eventId:activity.id,expectedRevision:activity.revision,pack:structuredClone(activity.eventPackage),raw:'',mode:'form'}}
export function privatePatchRequest(draft:PrivateEditDraft,pack:EventPackage,operation:string):PrivatePatch{
 if(draft.pending?.expectedRevision===draft.expectedRevision&&JSON.stringify(draft.pending.eventPackage)===JSON.stringify(pack))return draft.pending
 return {operationId:operation,expectedRevision:draft.expectedRevision,eventPackage:pack}
}
type Props={activity:ActivityDTO;ownerToken:string;open:boolean;onClose:()=>void;onSaved:(activity:ActivityDTO)=>void}
export function PrivateActivityEditor({activity,ownerToken,open,onClose,onSaved}:Props){
 const [draft,setDraft]=useState<PrivateEditDraft|null>(null),[preview,setPreview]=useState<EventPackage|null>(null),[latest,setLatest]=useState<ActivityDTO|null>(null),[error,setError]=useState(''),[saved,setSaved]=useState(''),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[reading,setReading]=useState(false),[conflict,setConflict]=useState(false)
 const current=useRef<PrivateEditDraft|null>(null),active=useRef(activity.id),queue=useRef(Promise.resolve()),mounted=useRef(true)
 active.current=activity.id
 const key='activity-owner-edit:'+activity.id,busy=loading||saving||reading||draft?.eventId!==activity.id
 useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false}},[])
 useEffect(()=>{
  if(!open)return
  let cancelled=false;setLoading(true);setSaving(false);setReading(false);setPreview(null);setLatest(null);setError('');setSaved('');setConflict(false)
  readLocal<PrivateEditDraft>(key).then(local=>{
   if(cancelled)return
   if(local&&(local.eventId!==activity.id||!Number.isInteger(local.expectedRevision)||typeof local.raw!=='string'||!['form','json'].includes(local.mode)||!local.pack?.event?.days))throw new Error('本机编辑记录无法读取，原记录未删除')
   const value=local??initialPrivateEdit(activity);current.current=value;setDraft(value);setLoading(false)
  }).catch(e=>{if(!cancelled){setError((e as Error).message);setLoading(false)}})
  return ()=>{cancelled=true}
 },[open,activity.id])
 function persist(value:PrivateEditDraft){const task=writeLocal('activity-owner-edit:'+value.eventId,value,queue.current.catch(()=>{}));queue.current=task;return task}
 function change(next:PrivateEditDraft){current.current=next;setDraft(next);setPreview(null);setSaved('');setLatest(null);persist(next).catch(e=>{if(mounted.current&&active.current===next.eventId)setError('本机保存失败：'+(e as Error).message)})}
 function edit(pack:EventPackage){if(!current.current)return;change({...current.current,pack,mode:'form',pending:undefined})}
 function dates(start:string,end:string){if(!draft)return;try{edit(privateDateRange(draft.pack,start,end));setError('')}catch(e){edit({...draft.pack,event:{...draft.pack.event,startDate:start,endDate:end}});setError((e as Error).message)}}
 function check(){if(!current.current)return;try{const d=current.current,pack=parsePrivateActivityEdit(d.mode==='json'?d.raw:JSON.stringify(d.pack),activity.eventPackage.event.id);setPreview(pack);setError('')}catch(e){setPreview(null);setError((e as Error).message)}}
 async function submit(){
  if(!preview||!current.current||busy)return
  const target=activity.id,request=privatePatchRequest(current.current,preview,crypto.randomUUID()),pending={...current.current,pending:request}
  current.current=pending;setDraft(pending);setSaving(true);setError('');setSaved('')
  try{
   // Persist exact operation and content before the first network write; a lost response retries safely.
   await persist(pending)
   const result=await api<ActivityDTO>('/events/'+target,ownerToken,request,'PATCH')
   await queue.current;await removeLocal('activity-owner-edit:'+target)
   if(mounted.current&&active.current===target){const next=initialPrivateEdit(result);current.current=next;setDraft(next);setPreview(null);setSaved('已保存');onSaved(result)}
  }catch(e){if(mounted.current&&active.current===target){setError((e as Error).message);setConflict(e instanceof ApiFailure&&e.status===409)}}finally{if(mounted.current&&active.current===target)setSaving(false)}
 }
 const event=draft?.pack.event
 return <Sheet open={open} title="编辑活动资料" onClose={()=>{if(!busy)onClose()}}>{loading?<p role="status">读取本机编辑…</p>:draft&&event?<>
  <fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0}}>
   <div className="field"><label className="field-label" htmlFor="private-event-title">活动标题</label><input id="private-event-title" className="input" value={event.title} maxLength={100} onChange={e=>edit({...draft.pack,event:{...event,title:e.target.value}})}/></div>
   <div className="field"><label className="field-label" htmlFor="private-event-description">活动说明</label><textarea id="private-event-description" className="input" value={event.description??''} rows={3} maxLength={5000} onChange={e=>edit({...draft.pack,event:{...event,description:e.target.value}})}/></div>
   <div className="field"><label className="field-label" htmlFor="private-event-start">开始日期</label><input id="private-event-start" className="input" type="date" value={event.startDate} onChange={e=>dates(e.target.value,event.endDate)}/></div>
   <div className="field"><label className="field-label" htmlFor="private-event-end">结束日期</label><input id="private-event-end" className="input" type="date" value={event.endDate} onChange={e=>dates(event.startDate,e.target.value)}/></div>
   <Disclosure title={<>每日开放时间</>}>{event.days.map((day,i)=><section key={day.date}><h3>{day.date}</h3>{day.openIntervals.map((range,j)=><div className="field" key={j}><label className="field-label">开始时间<input className="input" aria-label={`${day.date} 开始时间 ${j+1}`} type="time" step={60} value={range.start} onChange={e=>edit({...draft.pack,event:{...event,days:event.days.map((d,n)=>n===i?{...d,openIntervals:d.openIntervals.map((r,k)=>k===j?{...r,start:e.target.value}:r)}:d)}})}/></label><label className="field-label">结束时间<input className="input" aria-label={`${day.date} 结束时间 ${j+1}`} value={range.end} placeholder="24:00" maxLength={5} onChange={e=>edit({...draft.pack,event:{...event,days:event.days.map((d,n)=>n===i?{...d,openIntervals:d.openIntervals.map((r,k)=>k===j?{...r,end:e.target.value}:r)}:d)}})}/></label><button className="btn btn-surface btn-sm" onClick={()=>edit({...draft.pack,event:{...event,days:event.days.map((d,n)=>n===i?{...d,openIntervals:d.openIntervals.filter((_,k)=>k!==j)}:d)}})}>删除区间</button></div>)}<button className="btn btn-surface btn-sm" disabled={day.openIntervals.length>=24} onClick={()=>edit({...draft.pack,event:{...event,days:event.days.map((d,n)=>n===i?{...d,openIntervals:[...d.openIntervals,{start:'13:00',end:'20:00'}]}:d)}})}>添加区间</button></section>)}</Disclosure>
   <Disclosure title={<>导入活动 JSON</>}><div className="field"><label className="field-label">选择活动 JSON<input className="input" aria-label="选择活动 JSON" type="file" accept=".json,application/json" onChange={async e=>{const file=e.target.files?.[0],target=activity.id;if(!file||!current.current)return;if(file.size>ACTIVITY_LIMITS.packageBytes){setError('文件不能超过1 MiB');return}setReading(true);setError('');try{const raw=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());if(mounted.current&&active.current===target&&current.current)change({...current.current,raw,mode:'json',pending:undefined})}catch{if(mounted.current&&active.current===target)setError('文件无法读取，请使用 UTF-8 JSON')}finally{if(mounted.current&&active.current===target)setReading(false)}}}/></label></div><div className="field"><label className="field-label">粘贴活动 JSON<textarea className="input" aria-label="粘贴活动 JSON" rows={5} value={draft.raw} onChange={e=>change({...draft,raw:e.target.value,mode:'json',pending:undefined})}/></label></div><p className="page-sub">更新保留原活动 ID：{activity.eventPackage.event.id}。导入不会授予任何权限。</p></Disclosure>
   {draft.mode==='json'&&<p className="page-sub">当前预览使用导入文件。修改上方字段会改用表单内容。</p>}
   <button className="btn btn-surface btn-block" onClick={check}>预览修改</button>
   <button className="btn btn-surface btn-block" onClick={()=>{try{const d=current.current!,pack=parsePrivateActivityEdit(d.mode==='json'?d.raw:JSON.stringify(d.pack),activity.eventPackage.event.id);download('private-event-package.json',pack);setError('')}catch(e){setError((e as Error).message)}}}>导出活动 JSON</button>
   {preview&&<section aria-label="活动修改预览"><h3>{preview.event.title}</h3><p>{preview.event.startDate} 至 {preview.event.endDate} · {preview.event.timezone}</p>{preview.event.days.map(d=><p key={d.date}>{d.date}：{d.openIntervals.length?d.openIntervals.map(r=>r.start+'–'+r.end).join('、'):'不开放'}</p>)}<p>{preview.event.activities.reduce((n,a)=>n+a.sessions.length,0)} 个场次</p><p className="page-sub">更改时间后，个人计划需要重新核对；小队快照不会自动覆盖。</p><button className="btn btn-primary btn-block" onClick={submit}>确认保存活动资料</button></section>}
   {conflict&&<><button className="btn btn-surface btn-block" onClick={async()=>{const target=activity.id;setReading(true);try{const value=await api<ActivityDTO>('/events/'+target,ownerToken);if(mounted.current&&active.current===target)setLatest(value)}catch(e){if(mounted.current&&active.current===target)setError((e as Error).message)}finally{if(mounted.current&&active.current===target)setReading(false)}}}>读取最新资料</button>{latest&&<section><p>最新资料：{latest.eventPackage.event.title} · {latest.eventPackage.event.startDate} 至 {latest.eventPackage.event.endDate}</p><button className="btn btn-surface btn-block" onClick={()=>{if(!current.current)return;change({...current.current,expectedRevision:latest.revision,pending:undefined});setConflict(false);setError('请重新预览，确认后再保存') }}>保留修改，重新核对</button></section>}</>}
  </fieldset>
  <p className="page-sub" role="status">{saving?'保存中…':reading?'读取中…':saved||'编辑自动保存在本机，确认保存后才更新线上资料。'}</p>
 </>:null}{error&&<p className="notice" role="alert">{error}</p>}</Sheet>
}
