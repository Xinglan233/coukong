import {ArrowLeft,ChevronDown} from 'lucide-react'
import type {ActivityDTO} from '../../../shared/activity-contract'
import {rangeText} from './fmt'

export function FigmaActivityHeader({activity,offline,onBack,onSwitch}:{activity:ActivityDTO;offline:boolean;onBack:()=>void;onSwitch:()=>void}){
 const event=activity.eventPackage.event
 return <header className="figma-activity-header"><button className="icon-btn" aria-label="返回活动列表" onClick={onBack}><ArrowLeft size={22}/></button><button className="figma-activity-switch" aria-label="切换活动" onClick={onSwitch}><span className="page-sub">当前活动 · {rangeText(event.startDate,event.endDate)}</span><span className="page-title"><span>{event.title}</span><ChevronDown size={14}/></span></button>{offline&&<span className="figma-badge is-warning">离线</span>}</header>
}
