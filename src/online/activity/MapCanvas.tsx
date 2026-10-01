import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Minus, Plus, Maximize2 } from 'lucide-react'
import type { ConventionData, Point } from '../../../shared/activity-contract'
import type { PathResult } from '../../../shared/routing'
export interface MapTransform {zoom:number;x:number;y:number}
export interface MapCanvasProps {
 convention:ConventionData;mapId:string;assetUrl:string;selectedPoiId?:string;favoriteIds?:string[];visiblePoiIds?:string[];route?:PathResult
 onSelectPoi:(id:string)=>void;onPoint?:(point:Point)=>void;editable?:boolean;showGraph?:boolean
 onSelectNode?:(id:string)=>void;onSelectEdge?:(id:string)=>void;onMovePoi?:(id:string,point:Point)=>void
}
interface Rect {left:number;top:number;width:number;height:number}
export function pointerToNormalized(point:Point,rect:Rect,width:number,height:number,transform:MapTransform):Point|null {
 const scale=Math.min(rect.width/width,rect.height/height)
 if(!Number.isFinite(scale)||scale<=0||transform.zoom<=0)return null
 const left=rect.left+(rect.width-width*scale)/2,top=rect.top+(rect.height-height*scale)/2
 const x=((point.x-left)/scale-transform.x)/transform.zoom/width,y=((point.y-top)/scale-transform.y)/transform.zoom/height
 return Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=1&&y>=0&&y<=1?{x,y}:null
}
const initial:MapTransform={zoom:1,x:0,y:0}
export function MapCanvas({convention,mapId,assetUrl,selectedPoiId,favoriteIds=[],visiblePoiIds,route,onSelectPoi,onPoint,editable=false,showGraph=false,onSelectNode,onSelectEdge,onMovePoi}:MapCanvasProps) {
 const map=convention.maps.find(m=>m.id===mapId),svg=useRef<SVGSVGElement>(null),pointers=useRef(new Map<number,Point>())
 const gesture=useRef<{origin:Point;transform:MapTransform;distance:number;center:Point;poiId?:string;nodeId?:string;edgeId?:string;dragged:boolean}|null>(null)
 const [transform,setTransform]=useState<MapTransform>(initial),[failed,setFailed]=useState(false),[viewport,setViewport]=useState({width:400,height:320})
 const transformRef=useRef(transform);transformRef.current=transform
 useEffect(()=>{setTransform(initial);setFailed(false);pointers.current.clear();gesture.current=null},[mapId,assetUrl])
 useEffect(()=>{const element=svg.current;if(!element)return;const observer=new ResizeObserver(()=>{const rect=element.getBoundingClientRect();setViewport({width:rect.width,height:rect.height})});observer.observe(element);return()=>observer.disconnect()},[mapId])
 useEffect(()=>{const element=svg.current;if(!element||!map)return;const handle=(event:WheelEvent)=>{event.preventDefault();setTransform(t=>{const zoom=Math.min(8,Math.max(1,t.zoom*(event.deltaY<0?1.1:1/1.1))),ratio=zoom/t.zoom;return{zoom,x:map.width/2-(map.width/2-t.x)*ratio,y:map.height/2-(map.height/2-t.y)*ratio}})};element.addEventListener('wheel',handle,{passive:false});return()=>element.removeEventListener('wheel',handle)},[map])
 if(!map)return <p role="status">尚未提供这张地图，可在地点列表继续查看。</p>
 const width=map.width,height=map.height,scale=Math.min(viewport.width/width,viewport.height/height),marker=11/(scale*transform.zoom),font=12/(scale*transform.zoom)
 const pois=convention.pois.filter(p=>(visiblePoiIds===undefined||visiblePoiIds.includes(p.id))&&p.position?.mapId===mapId&&p.position.mapRevision===map.revision)
 const graph=showGraph?convention.routingGraphs.find(g=>g.mapId===mapId&&g.mapRevision===map.revision):undefined
 const pointFor=(e:ReactPointerEvent<SVGSVGElement>)=>pointerToNormalized({x:e.clientX,y:e.clientY},svg.current!.getBoundingClientRect(),width,height,transformRef.current)
 function setGesture(poiId?:string,nodeId?:string,edgeId?:string){const points=[...pointers.current.values()],center=points.length>1?{x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2}:points[0];gesture.current={origin:points[0],transform:transformRef.current,distance:points.length>1?Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y):0,center,poiId,nodeId,edgeId,dragged:false}}
 function down(e:ReactPointerEvent<SVGSVGElement>){if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const target=e.target as Element;setGesture(target.closest('[data-poi]')?.getAttribute('data-poi')||undefined,target.closest('[data-node]')?.getAttribute('data-node')||undefined,target.closest('[data-edge]')?.getAttribute('data-edge')||undefined)}
 function move(e:ReactPointerEvent<SVGSVGElement>){if(!pointers.current.has(e.pointerId)||!gesture.current)return;pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const g=gesture.current,points=[...pointers.current.values()];if(Math.hypot(e.clientX-g.origin.x,e.clientY-g.origin.y)>5)g.dragged=true
  if(points.length===1&&g.poiId&&editable&&onMovePoi){return}
  if(points.length>1&&g.distance>0){const rect=svg.current!.getBoundingClientRect(),s=Math.min(rect.width/width,rect.height/height),distance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y),zoom=Math.max(1,Math.min(8,g.transform.zoom*distance/g.distance)),center={x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2},left=rect.left+(rect.width-width*s)/2,top=rect.top+(rect.height-height*s)/2,ratio=zoom/g.transform.zoom;setTransform({zoom,x:(center.x-left)/s-((g.center.x-left)/s-g.transform.x)*ratio,y:(center.y-top)/s-((g.center.y-top)/s-g.transform.y)*ratio})}
  else {const rect=svg.current!.getBoundingClientRect(),s=Math.min(rect.width/width,rect.height/height);setTransform({...g.transform,x:g.transform.x+(e.clientX-g.origin.x)/s,y:g.transform.y+(e.clientY-g.origin.y)/s})}
 }
 function up(e:ReactPointerEvent<SVGSVGElement>){const g=gesture.current;if(g&&pointers.current.size===1){const point=pointFor(e);if(editable&&g.poiId&&g.dragged&&point&&onMovePoi)onMovePoi?.(g.poiId,point);else if(!g.dragged){const {poiId,nodeId,edgeId}=g;if(poiId)onSelectPoi(poiId);else if(nodeId)onSelectNode?.(nodeId);else if(edgeId)onSelectEdge?.(edgeId);else if(editable&&point)onPoint?.(point)}}pointers.current.delete(e.pointerId);if(pointers.current.size){setGesture();gesture.current!.dragged=true}else gesture.current=null}
 function zoomBy(factor:number){setTransform(t=>{const zoom=Math.min(8,Math.max(1,t.zoom*factor)),ratio=zoom/t.zoom;return{zoom,x:width/2-(width/2-t.x)*ratio,y:height/2-(height/2-t.y)*ratio}})}
 // Show labels only when they fit in screen space; selected label always wins.
 const occupied:{x:number;y:number;width:number}[]=[],labelIds=new Set<string>()
 for(const poi of [...pois].sort((a,b)=>Number(b.id===selectedPoiId)-Number(a.id===selectedPoiId))){if(poi.id!==selectedPoiId&&transform.zoom<2)continue;const x=poi.position!.x*width*scale*transform.zoom,y=poi.position!.y*height*scale*transform.zoom,w=Math.min(poi.name.length,12)*12+24;if(poi.id===selectedPoiId||!occupied.some(p=>Math.abs(y-p.y)<24&&Math.abs(x-p.x)<(w+p.width)/2)){occupied.push({x,y,width:w});labelIds.add(poi.id)}}
 const points=(geometry:Point[])=>geometry.map(p=>`${p.x*width},${p.y*height}`).join(' ')
 return <section aria-label={map.title} style={{minWidth:0}}>
  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}><span style={{flex:1,color:'var(--ink-2)',fontSize:13}}>{map.title}</span><div role="group" aria-label="地图缩放" style={{display:'flex',gap:4}}><button className="btn" aria-label="缩小地图" onClick={()=>zoomBy(1/1.5)} disabled={transform.zoom<=1}><Minus size={16}/></button><button className="btn" aria-label="放大地图" onClick={()=>zoomBy(1.5)} disabled={transform.zoom>=8}><Plus size={16}/></button><button className="btn" aria-label="回到全图" onClick={()=>setTransform(initial)}><Maximize2 size={16}/></button></div></div>
  {failed&&<p role="alert">地图图片暂不可用，请重试或使用地点列表。</p>}
  {map.needsReview&&<p role="status">地图已更新，点位与通道需要重新校对。</p>}
  <svg ref={svg} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" aria-label="活动地图，可平移与缩放" role="group" tabIndex={0}
   style={{display:'block',width:'100%',height:'min(60vh, 440px)',minHeight:260,background:'var(--surface-2)',border:'1px solid var(--line)',borderRadius:'var(--radius)',touchAction:'none',overflow:'hidden'}}
   onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={e=>{pointers.current.delete(e.pointerId);gesture.current=null}} 
   onKeyDown={e=>{if(e.target!==e.currentTarget)return;const step=50/scale;if(e.key==='+'||e.key==='=')zoomBy(1.5);else if(e.key==='-')zoomBy(1/1.5);else if(e.key==='Home')setTransform(initial);else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();setTransform(t=>({...t,x:t.x+(e.key==='ArrowRight'?-step:e.key==='ArrowLeft'?step:0),y:t.y+(e.key==='ArrowDown'?-step:e.key==='ArrowUp'?step:0)}))}}}>
   <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.zoom})`}>
    <image href={assetUrl} x={0} y={0} width={width} height={height} onError={()=>setFailed(true)} onLoad={()=>setFailed(false)} style={{filter:'none'}}/>
    {!map.needsReview&&graph?.edges.map(edge=>{const from=graph.nodes.find(n=>n.id===edge.from),to=graph.nodes.find(n=>n.id===edge.to);if(!from||!to)return null;return <polyline key={edge.id} data-edge={edge.id} points={points(edge.geometry||[from,to])} fill="none" stroke={edge.enabled?'var(--accent)':'var(--ink-3)'} strokeWidth={5} vectorEffect="non-scaling-stroke" strokeDasharray={edge.reviewed?undefined:'6 5'} opacity={edge.enabled?.7:.35} role="button" aria-label={`通道 ${edge.id}${edge.bidirectional?' 双向':' 单向'}`} tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')onSelectEdge?.(edge.id)}}/>})}
    {!map.needsReview&&route?.status==='ok'&&<polyline points={points(route.geometry)} fill="none" stroke="var(--accent)" strokeWidth={5} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"/>}
    {!map.needsReview&&graph?.nodes.map(node=><circle key={node.id} data-node={node.id} cx={node.x*width} cy={node.y*height} r={marker*.65} fill="var(--surface)" stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" role="button" tabIndex={0} aria-label={`通道节点 ${node.id}`} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')onSelectNode?.(node.id)}}/>)}
    {!map.needsReview&&pois.map(poi=><g key={poi.id} data-poi={poi.id} role="button" tabIndex={0} aria-label={`${poi.name}${favoriteIds.includes(poi.id)?'，已收藏':''}${poi.closed?'，已关闭':''}`} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelectPoi(poi.id)}}}>
     <circle cx={poi.position!.x*width} cy={poi.position!.y*height} r={marker*(poi.id===selectedPoiId?1.35:1)} fill={favoriteIds.includes(poi.id)?'var(--accent)':'var(--surface)'} stroke={poi.id===selectedPoiId?'var(--ink)':'var(--accent)'} strokeWidth={poi.id===selectedPoiId?3:2} vectorEffect="non-scaling-stroke" opacity={poi.closed?.45:1}/>
     {labelIds.has(poi.id)&&<text x={poi.position!.x*width} y={poi.position!.y*height-marker*1.8} fontSize={font} textAnchor="middle" fill="var(--ink)" stroke="var(--surface)" strokeWidth={font*.3} paintOrder="stroke" pointerEvents="none">{poi.name.slice(0,12)}</text>}
    </g>)}
   </g>
  </svg>
  {route&&route.status!=='ok'&&<p role="status" style={{fontSize:13,color:'var(--ink-2)'}}>该路段缺少当前可用通道，请按地点清单查看。</p>}
  <p style={{fontSize:12,color:'var(--ink-3)',marginTop:8}}>{editable?'点击地图标点；拖动已选地点微调。':'双指缩放或拖动地图；点击地点查看。'}键盘可用方向键、加减号和 Home。</p>
 </section>
}
