import {UserMinus} from 'lucide-react'
import type {AvailabilityPerson} from '../../../shared/types'

const labels={unsubmitted:'未提交',confirmed:'已提交',needs_review:'需要重新确认'}
export function FigmaCrewMembers({members,onRemove}:{members:AvailabilityPerson[];onRemove?:(id:string,name:string)=>void}){
 return <section className="figma-crew-section"><h2>成员 {members.length}</h2><div className="card me-card">{members.map(member=><div className="me-row figma-crew-member" key={member.id}><span className="figma-member-avatar" aria-hidden="true">{member.name.slice(0,1)}</span><span className="me-row-label">{member.name}</span><span className={`figma-badge ${member.status==='confirmed'?'is-accent':member.status==='needs_review'?'is-warning':''}`}>{labels[member.status]}</span>{onRemove&&<button className="icon-btn" aria-label={`移除 ${member.name}`} onClick={()=>onRemove(member.id,member.name)}><UserMinus size={17}/></button>}</div>)}</div></section>
}
