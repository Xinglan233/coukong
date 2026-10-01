import {useState} from 'react'
import {ChevronRight,Link2,Plus} from 'lucide-react'
import type {GroupDTO} from '../../../shared/types'
import {invitationTarget} from './figma-adapter'

export function FigmaCompanionsEntry({groups,onCreate,onOpen}:{groups:GroupDTO[];onCreate:()=>void;onOpen:(id:string)=>void}){
 const [invite,setInvite]=useState(''),[error,setError]=useState('')
 return <div className="figma-companions-entry"><p className="page-sub">不组队也能使用收藏、日程与路线。组队后可查看共同空闲。</p>{groups.length>0&&<section className="figma-crew-section"><h2>我的小队</h2><div className="card me-card">{groups.map(group=><button className="me-row" key={group.id} onClick={()=>onOpen(group.id)}><span className="me-row-label">{group.title}</span><ChevronRight size={17}/></button>)}</div></section>}<section className="figma-crew-section"><h2>创建小队</h2><div className="card me-card"><button className="me-row" onClick={onCreate}><span className="me-row-label"><Plus size={18}/>创建小队</span><ChevronRight size={17}/></button></div><p className="page-sub">你将成为队长，可管理成员与邀请。</p></section><section className="figma-crew-section"><h2>加入小队</h2><form className="figma-inline-entry" onSubmit={e=>{e.preventDefault();try{location.assign(invitationTarget(invite,location.origin));setError('')}catch(e){setError((e as Error).message)}}}><Link2 size={18}/><input aria-label="小队邀请链接" placeholder="完整邀请链接" autoComplete="off" value={invite} onChange={e=>{setInvite(e.target.value);setError('')}}/><button disabled={!invite.trim()}>加入</button></form>{error&&<p className="notice" role="alert">{error}</p>}<p className="page-sub">个人计划不会自动分享，加入后再确认同步。</p></section></div>
}
