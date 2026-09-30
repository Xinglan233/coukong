import type {ConventionData,Point,RoutingGraph,RouteEdge} from './activity-contract'
export interface PathResult {status:'ok'|'unreachable'|'stale'|'missing_location';nodeIds:string[];edgeIds:string[];geometry:Point[];distanceMeters:number|null;estimatedTravelSeconds:number|null;weightUnit:'seconds'|'relative'}
const empty=(status:PathResult['status']):PathResult=>({status,nodeIds:[],edgeIds:[],geometry:[],distanceMeters:null,estimatedTravelSeconds:null,weightUnit:'relative'})
function dimensions(width:number,height:number){if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new RangeError('图像尺寸须为正数')}
export function normalizedToImage(point:Point,width:number,height:number):Point{dimensions(width,height);if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||point.x<0||point.x>1||point.y<0||point.y>1)throw new RangeError('坐标须在0–1');return{x:point.x*width,y:point.y*height}}
export function imageToNormalized(point:Point,width:number,height:number):Point{dimensions(width,height);if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||point.x<0||point.x>width||point.y<0||point.y>height)throw new RangeError('像素坐标超出图像');return{x:point.x/width,y:point.y/height}}
// All weights within a run use seconds OR relative normalized graph geometry.
// Relative weights are never presented as physical metres or elapsed time.
export function shortestPath(graph:RoutingGraph,fromNodeId:string,toNodeId:string,date:string,mode:'time'|'relative'='time'):PathResult {
 const nodes=new Map(graph.nodes.map(n=>[n.id,n]));if(!nodes.has(fromNodeId)||!nodes.has(toNodeId))return empty('missing_location')
 const edges=graph.edges.filter(e=>e.enabled&&e.reviewed&&!e.closedDates?.includes(date)&&nodes.has(e.from)&&nodes.has(e.to))
 const seconds=mode==='time'&&edges.every(e=>typeof e.estimatedTravelSeconds==='number'&&e.estimatedTravelSeconds>0)
 const geometry=(edge:RouteEdge)=>edge.geometry||[nodes.get(edge.from)!,nodes.get(edge.to)!]
 const weight=(edge:RouteEdge)=>seconds?edge.estimatedTravelSeconds!:geometry(edge).slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-geometry(edge)[i].x,p.y-geometry(edge)[i].y),0)
 type Arc={to:string;edge:RouteEdge;reverse:boolean;weight:number}
 const adjacency=new Map<string,Arc[]>();for(const edge of edges){const w=weight(edge);if(!Number.isFinite(w)||w<=0)continue;const add=(from:string,to:string,reverse:boolean)=>{const list=adjacency.get(from)||[];list.push({to,edge,reverse,weight:w});adjacency.set(from,list)};add(edge.from,edge.to,false);if(edge.bidirectional)add(edge.to,edge.from,true)}
 // Binary heap avoids O(V²) repeated scans for the bounded 2000-node graphs.
 const heap:{id:string;distance:number}[]=[]
 const push=(item:{id:string;distance:number})=>{heap.push(item);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].distance<=item.distance)break;heap[i]=heap[p];i=p}heap[i]=item}
 const pop=()=>{const head=heap[0],tail=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].distance<heap[child].distance)child++;if(heap[child].distance>=tail.distance)break;heap[i]=heap[child];i=child}heap[i]=tail}return head}
 const distances=new Map<string,number>([[fromNodeId,0]]),previous=new Map<string,{from:string;arc:Arc}>();push({id:fromNodeId,distance:0})
 while(heap.length){const current=pop();if(current.distance!==distances.get(current.id))continue;if(current.id===toNodeId)break;for(const arc of adjacency.get(current.id)||[]){const d=current.distance+arc.weight;if(d<(distances.get(arc.to)??Infinity)){distances.set(arc.to,d);previous.set(arc.to,{from:current.id,arc});push({id:arc.to,distance:d})}}}
 if(!distances.has(toNodeId))return empty('unreachable')
 const arcs:Arc[]=[],nodeIds=[toNodeId];let cursor=toNodeId;while(cursor!==fromNodeId){const step=previous.get(cursor)!;arcs.unshift(step.arc);cursor=step.from;nodeIds.unshift(cursor)}
 const points:Point[]=[];for(const arc of arcs){const pointsForEdge=geometry(arc.edge).map(p=>({x:p.x,y:p.y}));if(arc.reverse)pointsForEdge.reverse();points.push(...(points.length?pointsForEdge.slice(1):pointsForEdge))}if(!arcs.length){const n=nodes.get(fromNodeId)!;points.push({x:n.x,y:n.y})}
 const total=(key:'distanceMeters'|'estimatedTravelSeconds')=>arcs.every(a=>typeof a.edge[key]==='number'&&a.edge[key]!>0)?arcs.reduce((sum,a)=>sum+a.edge[key]!,0):null
 return{status:'ok',nodeIds,edgeIds:arcs.map(a=>a.edge.id),geometry:points,distanceMeters:total('distanceMeters'),estimatedTravelSeconds:total('estimatedTravelSeconds'),weightUnit:seconds?'seconds':'relative'}
}
export function routeFixedOrder(convention:ConventionData,mapId:string,poiIds:string[],date:string,mode:'time'|'relative'='time'):{segments:PathResult[];distanceMeters:number|null;estimatedTravelSeconds:number|null} {
 const map=convention.maps.find(m=>m.id===mapId),graph=convention.routingGraphs.find(g=>g.mapId===mapId),segments:PathResult[]=[]
 for(let i=1;i<poiIds.length;i++){const from=convention.pois.find(p=>p.id===poiIds[i-1]),to=convention.pois.find(p=>p.id===poiIds[i]);if(!map||map.needsReview||graph&&graph.mapRevision!==map.revision){segments.push(empty('stale'));continue}if(!graph||!from?.routeNodeId||!to?.routeNodeId||from.closed||to.closed||from.position?.mapId!==mapId||to.position?.mapId!==mapId){segments.push(empty('missing_location'));continue}if(from.position.mapRevision!==map.revision||to.position.mapRevision!==map.revision){segments.push(empty('stale'));continue}segments.push(shortestPath(graph,from.routeNodeId,to.routeNodeId,date,mode))}
 const total=(key:'distanceMeters'|'estimatedTravelSeconds')=>segments.length&&segments.every(s=>s.status==='ok'&&s[key]!==null)?segments.reduce((sum,s)=>sum+s[key]!,0):null
 return{segments,distanceMeters:total('distanceMeters'),estimatedTravelSeconds:total('estimatedTravelSeconds')}
}
export function requiredTravelMinutes(travelSeconds:number|null,afterBuffer:number,beforeBuffer:number,stayMinutes=0,queueMinutes=0):number|null {
 if(travelSeconds===null)return null
 for(const value of [travelSeconds,afterBuffer,beforeBuffer,stayMinutes,queueMinutes])if(!Number.isFinite(value)||value<0)throw new RangeError('时间须为非负数')
 return Math.max(travelSeconds/60,afterBuffer+beforeBuffer)+stayMinutes+queueMinutes
}
