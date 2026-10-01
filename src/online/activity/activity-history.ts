import type {ActivityDTO} from '../../../shared/activity-contract'
import {readLocalPrefix,writeLocal} from '../storage'
export interface RecentActivity{id:string;title:string;lastOpenedAt:string}
export async function rememberActivity(activity:ActivityDTO){await writeLocal(`activity-recent:${activity.id}`,{id:activity.id,title:activity.eventPackage.event.title,lastOpenedAt:new Date().toISOString()} satisfies RecentActivity)}
export async function recentActivities():Promise<RecentActivity[]>{return (await readLocalPrefix<RecentActivity>('activity-recent:')).filter(a=>a&&typeof a.id==='string'&&typeof a.title==='string'&&Number.isFinite(Date.parse(a.lastOpenedAt))).sort((a,b)=>b.lastOpenedAt.localeCompare(a.lastOpenedAt)).slice(0,50)}
export function publicPoiLink(origin:string,eventId:string,poiId:string):string{const url=new URL(`/events/${encodeURIComponent(eventId)}`,origin);url.searchParams.set('poi',poiId);return url.toString()}
