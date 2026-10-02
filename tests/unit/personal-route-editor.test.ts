import {it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {validatePersonalPlan} from '../../shared/event-validation'
import {setRouteStart} from '../../src/online/activity/route-editor'
import type {EventPackage} from '../../shared/types'
import type {PersonalRoute,POI} from '../../shared/activity-contract'
it('unpositioned route start and cleared start remain valid without fabricated map',()=>{const event=(JSON.parse(readFileSync('examples/event-minimal.json','utf8')) as EventPackage).event;event.extensions={convention:{maps:[],routingGraphs:[],pois:[{id:'entrance',name:'入口待定位',kind:'entrance'}]}};const route=setRouteStart(undefined,'2026-10-03',1,event.extensions.convention.pois[0]);const plan={response:{name:'我',presence:[],busy:[],bufferMinutes:0},favorites:[],routes:[route]};expect(()=>validatePersonalPlan({...plan,routes:[{...route,mapId:''}]},event)).toThrow();expect(validatePersonalPlan(plan,event).routes[0].mapId).toBeUndefined();const cleared=setRouteStart(route,route.date,1,undefined);expect(validatePersonalPlan({...plan,routes:[cleared]},event).routes[0].startPoiId).toBeUndefined()})
const routeFixture=():PersonalRoute=>({date:'2026-10-03',mapId:'map-a',startPoiId:'old-start',spatialRevision:1,stops:[{poiId:'kept-stop',visited:true,stayMinutes:7,queueMinutes:3}]})
const startPoi=(mapId:string):POI=>({id:'new-start',name:'新起点',kind:'entrance',position:{mapId,mapRevision:1,x:0.25,y:0.5}})
it('changing a route start across maps refuses without replacing map, dropping stops or changing review version',()=>{
 const route=routeFixture(),original=JSON.stringify(route)
 expect(()=>setRouteStart(route,route.date,2,startPoi('map-b'))).toThrow('起点不在当前路线地图')
 expect(JSON.stringify(route)).toBe(original)
 expect(()=>setRouteStart({...route,stops:[]},route.date,2,startPoi('map-b'))).toThrow('起点不在当前路线地图')
})
it('same-map start and cleared origin preserve route stops and existing spatial revision',()=>{
 const route=routeFixture(),original=JSON.stringify(route)
 const changed=setRouteStart(route,route.date,2,startPoi('map-a'))
 expect(changed).toEqual({...route,startPoiId:'new-start'})
 expect(setRouteStart(changed,route.date,2,undefined)).toEqual({...route,startPoiId:undefined})
 expect(JSON.stringify(route)).toBe(original)
})
it('new positioned routes establish the selected map while unlocated origins fabricate no map',()=>{
 expect(setRouteStart(undefined,'2026-10-03',2,startPoi('map-a'))).toEqual({date:'2026-10-03',mapId:'map-a',spatialRevision:2,stops:[],startPoiId:'new-start'})
 const route=routeFixture(),unlocated:POI={id:'unlocated',name:'未定位',kind:'entrance'}
 expect(setRouteStart(route,route.date,2,unlocated)).toEqual({...route,startPoiId:'unlocated'})
})
