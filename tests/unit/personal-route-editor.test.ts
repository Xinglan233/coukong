import {it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {validatePersonalPlan} from '../../shared/event-validation'
import {setRouteStart} from '../../src/online/activity/route-editor'
import type {EventPackage} from '../../shared/types'
it('unpositioned route start and cleared start remain valid without fabricated map',()=>{const event=(JSON.parse(readFileSync('examples/event-minimal.json','utf8')) as EventPackage).event;event.extensions={convention:{maps:[],routingGraphs:[],pois:[{id:'entrance',name:'入口待定位',kind:'entrance'}]}};const route=setRouteStart(undefined,'2026-10-03',1,event.extensions.convention.pois[0]);const plan={response:{name:'我',presence:[],busy:[],bufferMinutes:0},favorites:[],routes:[route]};expect(()=>validatePersonalPlan({...plan,routes:[{...route,mapId:''}]},event)).toThrow();expect(validatePersonalPlan(plan,event).routes[0].mapId).toBeUndefined();const cleared=setRouteStart(route,route.date,1,undefined);expect(validatePersonalPlan({...plan,routes:[cleared]},event).routes[0].startPoiId).toBeUndefined()})
