import {toMinute,fromMinute} from '../../../shared/time'

export function editableMinute(value:string,end=false):number|null{
 try{return toMinute(value,end)}catch{return null}
}
export function shiftedClock(value:string,delta:number,end=false):string|null{
 const current=editableMinute(value,end)
 if(current===null||!Number.isInteger(delta))return null
 const next=current+delta
 return next>=0&&next<=(end?1440:1439)?fromMinute(next):null
}
export function durationClock(start:string,duration:number):string|null{
 const current=editableMinute(start)
 if(current===null||!Number.isInteger(duration)||duration<1||current+duration>1440)return null
 return fromMinute(current+duration)
}
