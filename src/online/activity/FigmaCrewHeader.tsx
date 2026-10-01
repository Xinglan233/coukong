import {UserPlus} from 'lucide-react'
import type {GroupDTO} from '../../../shared/types'

export function FigmaCrewHeader({group,manager,onInvite}:{group:GroupDTO;manager:boolean;onInvite:()=>void}){
 return <header className="figma-crew-heading"><div><p className="page-sub">{manager?'你是队长':'队员'}{group.status!=='open'?' · 已关闭填写':''}</p><h2>{group.title}</h2></div>{manager&&<button className="btn btn-surface" aria-label="邀请队员" onClick={onInvite}><UserPlus size={17}/>邀请</button>}</header>
}
