import type {PersonalRoute,POI} from '../../../shared/activity-contract'
export function setRouteStart(route:PersonalRoute|undefined,date:string,spatialRevision:number,poi:POI|undefined):PersonalRoute{return {...route||{date,mapId:poi?.position?.mapId,stops:[],spatialRevision},startPoiId:poi?.id}}
