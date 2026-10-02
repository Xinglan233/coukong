import {it,expect} from 'vitest'
import * as routing from '../../shared/routing'
import type {ConventionData,PersonalRoute} from '../../shared/activity-contract'
const convention:ConventionData={maps:[{id:'m',title:'虚构图',assetKey:'m.png',width:2000,height:1000,revision:1,coordinateSpace:'normalized-image-top-left'}],pois:['a','b'].map((id,i)=>({id,name:id,kind:'booth',routeNodeId:id,position:{mapId:'m',mapRevision:1,x:i,y:0}})),routingGraphs:[{id:'g',mapId:'m',mapRevision:1,revision:1,nodes:[{id:'a',x:0,y:0},{id:'b',x:1,y:0}],edges:[{id:'ab',from:'a',to:'b',enabled:true,reviewed:true,bidirectional:true,estimatedTravelSeconds:270}]}]}
const route=():PersonalRoute=>({date:'2026-10-03',mapId:'m',startPoiId:'a',spatialRevision:1,stops:[{poiId:'b',visited:false,stayMinutes:20,queueMinutes:10}]})
it('fits buffered minute window without subtracting buffer again or changing plan',()=>{const r=route(),original=JSON.stringify(r);expect(routing.routeWindowFit(convention,r,1,{date:r.date,start:'13:07',end:'13:52'})).toMatchObject({status:'fits',requiredMinutes:34.5,start:'13:07',end:'13:42'});expect(JSON.stringify(r)).toBe(original)})
it('too short window never creates a schedule; visited stops not counted',()=>{const r=route();expect(routing.routeWindowFit(convention,r,1,{date:r.date,start:'13:07',end:'13:41'}).status).toBe('too_short');r.stops[0].visited=true;expect(routing.routeWindowFit(convention,r,1,{date:r.date,start:'13:07',end:'13:52'}).status).toBe('unknown')})
it('unset stay or queue and unknown path time stay unknown, not zero',()=>{const r=route();delete r.stops[0].queueMinutes;expect(routing.routeWindowFit(convention,r,1,{date:r.date,start:'13:07',end:'13:52'}).status).toBe('unknown');const c=structuredClone(convention);delete c.routingGraphs[0].edges[0].estimatedTravelSeconds;expect(routing.routeWindowFit(c,route(),1,{date:r.date,start:'13:07',end:'13:52'}).status).toBe('unknown')})
it('stale, closed path, no declared origin and mismatched date cannot claim fits',()=>{const r=route(),w={date:r.date,start:'13:07',end:'13:52'};expect(routing.routeWindowFit(convention,r,2,w).status).toBe('stale');delete r.startPoiId;expect(routing.routeWindowFit(convention,r,1,w).status).toBe('unknown');const c=structuredClone(convention);c.routingGraphs[0].edges[0].enabled=false;expect(routing.routeWindowFit(c,route(),1,w).status).toBe('unknown');expect(routing.routeWindowFit(convention,route(),1,{...w,date:'2026-10-04'}).status).toBe('unknown')})
const remainingFixture=()=>{
 const c=structuredClone(convention)
 c.pois=['a','b','c','d'].map((id,i)=>({id,name:id,kind:'booth',routeNodeId:id,position:{mapId:'m',mapRevision:1,x:i/3,y:0}}))
 c.routingGraphs[0].nodes=c.pois.map(p=>({id:p.id,x:p.position!.x,y:0}))
 c.routingGraphs[0].edges=['ab','bc','cd'].map((id,i)=>({id,from:c.pois[i].id,to:c.pois[i+1].id,enabled:true,reviewed:true,bidirectional:true,estimatedTravelSeconds:60*(i+1)}))
 const r:PersonalRoute={date:'2026-10-03',mapId:'m',startPoiId:'a',spatialRevision:1,stops:[{poiId:'b',visited:true},{poiId:'c',visited:true},{poiId:'d',visited:false,stayMinutes:2,queueMinutes:1}]}
 return {c,r,w:{date:r.date,start:'13:07',end:'13:13'}}
}
it('remaining window starts at the last visited stop in fixed order, excludes completed travel and dwell',()=>{
 const {c,r,w}=remainingFixture(),original=JSON.stringify(r)
 expect(routing.routeWindowFit(c,r,1,w)).toEqual({status:'fits',requiredMinutes:6,start:'13:07',end:'13:13'})
 expect(routing.routeWindowFit(c,r,1,{...w,end:'13:12'})).toEqual({status:'too_short',requiredMinutes:6})
 expect(JSON.stringify(r)).toBe(original)
})
it('last visited origin retains missing time and stale map gates even when earlier travel is complete',()=>{
 const {c,r,w}=remainingFixture()
 delete c.routingGraphs[0].edges[2].estimatedTravelSeconds
 expect(routing.routeWindowFit(c,r,1,w).status).toBe('unknown')
 c.maps[0].needsReview=true
 expect(routing.routeWindowFit(c,r,1,w).status).toBe('stale')
})
it('completed origin needs no original start, while a missing visited location cannot claim a fit',()=>{
 const {c,r,w}=remainingFixture();delete r.startPoiId
 expect(routing.routeWindowFit(c,r,1,w).status).toBe('fits')
 delete c.pois[2].routeNodeId
 expect(routing.routeWindowFit(c,r,1,w).status).toBe('unknown')
})

it('map and time checks share the remaining fixed path without mutating completed records',()=>{
 const {c,r}=remainingFixture(),original=JSON.stringify(r)
 expect(routing.remainingRoutePoiIds(r)).toEqual(['c','d'])
 expect(routing.routeFixedOrder(c,'m',routing.remainingRoutePoiIds(r),r.date).segments[0]).toMatchObject({nodeIds:['c','d'],edgeIds:['cd'],estimatedTravelSeconds:180})
 expect(JSON.stringify(r)).toBe(original)
 const fresh=route();expect(routing.remainingRoutePoiIds(fresh)).toEqual(['a','b'])
 delete fresh.startPoiId;expect(routing.remainingRoutePoiIds(fresh)).toEqual(['b'])
})
