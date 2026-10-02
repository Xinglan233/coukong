import type {PersonalRoute,POI} from '../../../shared/activity-contract'
export function setRouteStart(route:PersonalRoute|undefined,date:string,spatialRevision:number,poi:POI|undefined):PersonalRoute{
 if(route?.mapId&&poi?.position&&route.mapId!==poi.position.mapId)throw new Error('起点不在当前路线地图，请选择同一地图的起点')
 return {...route||{date,mapId:poi?.position?.mapId,stops:[],spatialRevision},startPoiId:poi?.id}
}
