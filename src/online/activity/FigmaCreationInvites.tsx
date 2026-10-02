import {useEffect,useRef,useState} from 'react'
import {Copy,Plus} from 'lucide-react'
import type {CreationInviteDTO,CreateCreationInviteRequest,RevokeCreationInviteRequest} from '../../../shared/creation-invites'
import {newToken,operationId} from '../../../shared/api'
import {api,ApiFailure} from '../api'
import {adminCreationPendingPrefix} from './admin-creation-storage'

const statuses={available:'可用',used:'已使用',expired:'已过期',revoked:'已撤销'}
// V18 Group/Btn layout, adapted to the project's existing tokens and Sheet.
export function FigmaCreationInvites({token,eventId,eligible,confirming,onConfirm,onBack,onExpired}:{token:string;eventId:string;eligible:boolean;confirming:boolean;onConfirm:()=>void;onBack:()=>void;onExpired?:()=>void}){
 const [rows,setRows]=useState<CreationInviteDTO[]>([]),[fresh,setFresh]=useState(''),[error,setError]=useState(''),[feedback,setFeedback]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[selected,setSelected]=useState<CreationInviteDTO|null>(null)
 const scope=useRef(''),alive=useRef(true),pending=useRef<CreateCreationInviteRequest>(),revocation=useRef<RevokeCreationInviteRequest>()
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
 function fail(e:unknown){if(!alive.current)return;setError((e as Error).message);if(e instanceof ApiFailure&&e.status===401)onExpired?.()}
 async function load(){try{const records=await api<CreationInviteDTO[]>(`/admin/creation-invites?limit=100&eventId=${encodeURIComponent(eventId)}`,token);if(alive.current)setRows(records.filter(row=>row.eventId===eventId))}catch(e){fail(e)}finally{if(alive.current)setLoading(false)}}
 useEffect(()=>{void(async()=>{const prefix=await adminCreationPendingPrefix(token);if(!alive.current||sessionStorage.getItem('coukong-admin')!==token)return;scope.current=prefix+eventId;await load()})().catch(fail)},[eventId,token])
 async function generate(){if(busy||!eligible||!scope.current)return;setBusy(true);setError('');setFeedback('');try{
  const key=scope.current,saved=sessionStorage.getItem(key);const request=pending.current??(saved?JSON.parse(saved) as CreateCreationInviteRequest:{token:newToken(),operationId:operationId(),eventId})
  if(request.eventId!==eventId||!request.token||!request.operationId)throw new Error('本机待生成资料不匹配，请保留内容并重新进入管理。')
  const serialized=JSON.stringify(request);pending.current=request;sessionStorage.setItem(key,serialized)
  const result=await api<CreationInviteDTO>('/admin/creation-invites',token,request)
  // A closed editor must retain its undelivered code. A late reply must never
  // clear another editor's newer request or overwrite its displayed code.
  if(!alive.current||sessionStorage.getItem('coukong-admin')!==token||JSON.stringify(pending.current)!==serialized||sessionStorage.getItem(key)!==serialized)return
  sessionStorage.removeItem(key);pending.current=undefined
  setFresh(request.token);setRows(current=>[result,...current.filter(row=>row.id!==result.id)]);setFeedback('已生成建队码')
 }catch(e){fail(e)}finally{if(alive.current)setBusy(false)}}
 async function revoke(){if(!selected||busy)return;setBusy(true);setError('');try{
  const key=`${scope.current}:revoke:${selected.id}`,saved=sessionStorage.getItem(key)
  const request=revocation.current??(saved?JSON.parse(saved) as RevokeCreationInviteRequest:{operationId:operationId(),expectedRevision:selected.revision})
  const serialized=JSON.stringify(request);revocation.current=request;sessionStorage.setItem(key,serialized)
  const result=await api<CreationInviteDTO>(`/admin/creation-invites/${selected.id}`,token,request,'DELETE')
  if(!alive.current||sessionStorage.getItem('coukong-admin')!==token||JSON.stringify(revocation.current)!==serialized||sessionStorage.getItem(key)!==serialized)return
  sessionStorage.removeItem(key);revocation.current=undefined
  setRows(current=>current.map(row=>row.id===result.id?result:row));setFresh('');setSelected(null);setFeedback('已撤销');onBack()
 }catch(e){fail(e)}finally{if(alive.current)setBusy(false)}}
 const notices=<>{error&&<p className="notice" role="alert">{error}</p>}{feedback&&<p className="page-sub" role="status">{feedback}</p>}</>
 if(confirming)return <div className="figma-confirm-content"><p>确定要撤销这个建队码吗？撤销后，该码将立即失效且不可恢复。</p>{notices}<div className="btn-row"><button className="btn btn-subtle" disabled={busy} onClick={()=>{setError('');onBack()}}>取消</button><button className="btn btn-danger" disabled={busy} onClick={()=>void revoke()}>{busy?'撤销中…':'确认撤销'}</button></div></div>
 return <div className="figma-creation-invites"><button className="btn btn-primary btn-block" disabled={busy||!eligible||loading} onClick={()=>void generate()}><Plus size={18}/>{busy?'生成中…':'生成建队码'}</button>{!eligible&&<p className="page-sub">先公开发布这场活动，再生成建队码。</p>}{notices}
 {fresh&&<section className="figma-crew-section"><h2>新生成的建队码</h2><div className="figma-settings-group figma-code-current"><p className="figma-code-text" aria-label="新建队码">{fresh}</p><button className="btn btn-surface btn-block" onClick={async()=>{try{await navigator.clipboard.writeText(fresh);setFeedback('建队码已复制');setError('')}catch{setError('复制失败，请重试。')}}}><Copy size={16}/>复制长文字码</button></div><p className="page-sub">仅本次生成时展示，请及时复制给队长。历史列表不保留完整码。</p></section>}
 <section className="figma-crew-section"><h2>建队码列表</h2><div className="figma-settings-group creation-invite-history">{loading?<p className="me-row" role="status">正在读取…</p>:rows.length===0?<p className="me-row">暂无建队码</p>:rows.map(row=><div className="figma-code-history-row" key={row.id}><div className="figma-code-row-heading"><div><p>{row.eventTitle}</p><p className="page-sub">有效期至：{new Date(row.expiresAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}（上海时间）</p></div><span className={`figma-badge ${row.status==='available'?'is-confirmed':row.status==='revoked'?'is-danger':''}`}>{statuses[row.status]}</span></div>{row.status==='available'&&<div className="figma-code-row-action"><button className="btn btn-subtle figma-danger-action" disabled={busy} onClick={()=>{setSelected(row);revocation.current=undefined;setError('');onConfirm()}}>撤销该码</button></div>}</div>)}</div><p className="page-sub">出于安全原因，历史列表不再显示完整码。</p><button className="btn btn-subtle" disabled={busy} onClick={()=>void load()}>刷新状态</button></section>
 </div>
}
