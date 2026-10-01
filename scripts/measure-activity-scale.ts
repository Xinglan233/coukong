// Bounded, fictional, local-only scale evidence. No platform CPU claims.
import assert from 'node:assert/strict'
import {readFileSync,readdirSync,writeFileSync} from 'node:fs'
import {createHash,randomBytes,randomUUID} from 'node:crypto'
import {performance} from 'node:perf_hooks'
import {pathToFileURL} from 'node:url'
import {ACTIVITY_LIMITS} from '../shared/activity-contract'
import {parseEventPackage,parseStrictJSON,validateEventPackage,validateResponse,ValidationError} from '../shared/event-validation'
import {commonAvailability,personalAvailability} from '../shared/availability'
import {routeFixedOrder} from '../shared/routing'
import type {AvailabilityPerson,EventPackage,ParticipantResponse} from '../shared/types'

const dates=Array.from({length:5},(_,i)=>`2026-10-${String(i+2).padStart(2,'0')}`)
const time=(m:number)=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`
export function scalePackage():EventPackage {
 const sample=JSON.parse(readFileSync(new URL('../examples/convention-demo.v2.json',import.meta.url),'utf8')) as EventPackage
 const manifest=sample.assetManifest![0]
 const nodes=Array.from({length:2000},(_,i)=>({id:`n${i}`,x:(i%50)/50,y:Math.floor(i/50)/40}))
 const edges=Array.from({length:4000},(_,i)=>({id:`e${i}`,from:`n${i%2000}`,to:`n${(i%2000+(i<2000?1:17))%2000}`,bidirectional:true,enabled:true,reviewed:true,estimatedTravelSeconds:i<2000?10:100}))
 return {kind:'coukong.event',schemaVersion:2,event:{id:'fictional-scale-test',title:'虚构最大计数性能测试',eventType:'comic_convention',timezone:'Asia/Shanghai',startDate:dates[0],endDate:dates[4],defaultBufferMinutes:0,defaultMinSlotMinutes:1,defaultSelectionStepMinutes:15,days:dates.map(date=>({date,openIntervals:[{start:'09:00',end:'21:00'}]})),activities:Array.from({length:1000},(_,i)=>({id:`a${i}`,title:`虚构场次${i}`,sessions:[{id:`s${i}`,date:dates[i%5],start:i===0?'13:07':time(540+i%600),end:i===0?'13:52':time(541+i%600),poiId:`p${i}`}]})),extensions:{convention:{maps:[{id:'m',title:'虚构地图测试',assetKey:manifest.assetKey,width:manifest.width,height:manifest.height,revision:1,coordinateSpace:'normalized-image-top-left'}],pois:Array.from({length:1000},(_,i)=>({id:`p${i}`,name:`虚构地点${i}`,kind:'booth',position:{mapId:'m',mapRevision:1,x:nodes[i*2].x,y:nodes[i*2].y},routeNodeId:`n${i*2}`})),routingGraphs:[{id:'g',mapId:'m',mapRevision:1,revision:1,nodes,edges}]} }},assetManifest:[manifest],meta:{isExample:true,sourceNote:'隔离性能测试，仅节点/边/场次/坐标为虚构，绝非REDLAND资料；媒体元数据引用仓库虚构示例。'}}
}
export function scaleResponses():ParticipantResponse[] {
 return Array.from({length:50},(_,person)=>({name:`测试成员${person}`,bufferMinutes:0,presence:dates.map(date=>({date,intervals:[{start:'09:00',end:'21:00'}]})),busy:dates.flatMap((date,day)=>Array.from({length:100},(_,i)=>({id:`busy-${day}-${i}`,date,start:i===0&&day===0?'13:07':time(541+i*6),end:i===0&&day===0?'13:52':time(542+i*6),title:'虚构安排',source:'manual' as const})))}))
}
interface Sample {wallMs:number;processCpuMs:number;rssBytes:number}
function measure<T>(fn:()=>T):{value:T;sample:Sample} {const start=performance.now(),cpu=process.cpuUsage();const value=fn(),elapsed=process.cpuUsage(cpu);return{value,sample:{wallMs:performance.now()-start,processCpuMs:(elapsed.user+elapsed.system)/1000,rssBytes:process.memoryUsage().rss}}}
function series<T>(iterations:number,fn:()=>T) {const samples:Sample[]=[];let value:T|undefined;for(let i=0;i<iterations;i++){const run=measure(fn);value=run.value;samples.push(run.sample)}const stats=(key:'wallMs'|'processCpuMs')=>{const values=samples.map(s=>s[key]).sort((a,b)=>a-b);return{min:values[0],p50:values[Math.floor(values.length/2)],p95:values[Math.min(values.length-1,Math.ceil(values.length*.95)-1)],max:values[values.length-1]}};return{value,evidence:{iterations,wallMs:stats('wallMs'),processCpuMs:stats('processCpuMs'),maxObservedRssBytes:Math.max(...samples.map(s=>s.rssBytes)),samples}}}
const rejects=(fn:()=>unknown)=>assert.throws(fn,(e:unknown)=>e instanceof ValidationError&&e.code==='LIMIT_EXCEEDED')
export function runScaleMeasurements(){
 const pkg=scalePackage(),raw=JSON.stringify(pkg),bytes=Buffer.byteLength(raw),initialRss=process.memoryUsage().rss
 assert.equal(pkg.event.activities.length,1000);assert.equal(pkg.event.extensions!.convention.pois.length,1000);assert.equal(pkg.event.extensions!.convention.routingGraphs[0].nodes.length,2000);assert.equal(pkg.event.extensions!.convention.routingGraphs[0].edges.length,4000)
 const cold=measure(()=>parseEventPackage(raw)) // Includes strict parsing, generated Schema and semantic checks.
 assert.equal(cold.value.event.activities[0].sessions[0].start,'13:07');assert.equal(cold.value.event.activities[0].sessions[0].end,'13:52')
 const strict=series(10,()=>parseStrictJSON(raw,ACTIVITY_LIMITS.packageBytes)),validation=series(10,()=>validateEventPackage(strict.value)),roundtrip=series(10,()=>parseEventPackage(raw))
 const convention=pkg.event.extensions!.convention,order=Array.from({length:100},(_,i)=>`p${(i*499)%1000}`)
 const route=series(3,()=>routeFixedOrder(convention,'m',order,dates[1]))
 assert.equal(route.value!.segments.length,99);assert.ok(route.value!.segments.every(s=>s.status==='ok'));assert.ok(route.value!.segments.every((s,i)=>s.nodeIds[0]===`n${Number(order[i].slice(1))*2}`&&s.nodeIds.at(-1)===`n${Number(order[i+1].slice(1))*2}`))
 const responses=scaleResponses();responses.forEach(r=>validateResponse(r,pkg.event))
 const members=():AvailabilityPerson[]=>responses.map((r,i)=>({id:`member${i}`,name:r.name,status:'confirmed',revision:1,confirmedScheduleRevision:1,updatedAt:'2026-10-01T00:00:00Z',submittedAt:'2026-10-01T00:00:00Z',availability:personalAvailability(pkg.event,r)}))
 const availability=series(10,()=>{const people=members();return commonAvailability(pkg.event,people,people.map(p=>p.id),1)})
 assert.equal(availability.value!.waiting.length,0);assert.ok(availability.value!.intervals.length>0)
 const precisionEvent={...pkg.event,startDate:dates[1],endDate:dates[1],activities:[],days:[{date:dates[1],openIntervals:[{start:'09:00',end:'12:00'}]}]}
 const precisionResponses:ParticipantResponse[]=[{name:'A',bufferMinutes:5,presence:[{date:dates[1],intervals:[{start:'09:00',end:'12:00'}]}],busy:[{id:'a',date:dates[1],start:'10:07',end:'10:22',title:'测试',source:'manual'}]},{name:'B',bufferMinutes:0,presence:[{date:dates[1],intervals:[{start:'09:15',end:'11:50'}]}],busy:[{id:'b',date:dates[1],start:'09:40',end:'09:55',title:'测试',source:'manual'}]}]
 const people=precisionResponses.map((r,i)=>({...members()[0],id:String(i),name:r.name,availability:personalAvailability(precisionEvent,r)}))
 const exact=commonAvailability(precisionEvent,people,['0','1'],1).intervals.map(i=>[i.start,i.end]);assert.deepEqual(exact,[['09:15','09:40'],['09:55','10:02'],['10:27','11:50']]);assert.equal(commonAvailability(precisionEvent,people,['0','1'],15).intervals.length,2)
 const expanded=structuredClone(pkg);expanded.event.extensions!.convention.pois.forEach(p=>p.description='x'.repeat(1000));const expandedBytes=Buffer.byteLength(JSON.stringify(expanded));rejects(()=>parseEventPackage(JSON.stringify(expanded)))
 const extraPoi=structuredClone(pkg);extraPoi.event.extensions!.convention.pois.push({id:'over-limit',name:'虚构超额',kind:'booth'});assert.throws(()=>validateEventPackage(extraPoi),ValidationError)
 const extraNode=structuredClone(pkg);extraNode.event.extensions!.convention.routingGraphs[0].nodes.push({id:'over-limit',x:0,y:0});assert.throws(()=>validateEventPackage(extraNode),ValidationError)
 const extraEdge=structuredClone(pkg);extraEdge.event.extensions!.convention.routingGraphs[0].edges.push({...convention.routingGraphs[0].edges[0],id:'over-limit'});assert.throws(()=>validateEventPackage(extraEdge),ValidationError)
 return{scope:'Bounded fictional Node-process benchmark; not Cloudflare CPU, database or browser evidence',createdAt:new Date().toISOString(),environment:{node:process.version,platform:process.platform,arch:process.arch},shape:{days:5,pois:1000,activities:1000,sessions:1000,nodes:2000,edges:4000,members:50,busyPerMember:500,totalBusy:25000,routeStops:100,routeSegments:99,maps:1,packageBytes:bytes,packageLimitBytes:ACTIVITY_LIMITS.packageBytes},coldParseSchemaSemantics:cold.sample,strictParse:strict.evidence,schemaAndSemantics:validation.evidence,fullParseSchemaSemantics:roundtrip.evidence,fixedOrderDijkstra:route.evidence,personalProjectionAnd50MemberIntersection:availability.evidence,assertions:{exactMinuteSample:exact,nonRoundedSession:['13:07','13:52'],selectedMemberCount:50,commonIntervals:availability.value!.intervals.length,oversizeTextRejected:{bytes:expandedBytes,limit:ACTIVITY_LIMITS.packageBytes},poi1001Rejected:true,node2001Rejected:true,edge4001Rejected:true},memory:{initialRssBytes:initialRss,finalRssBytes:process.memoryUsage().rss,processLifetimeMaxRssBytes:process.resourceUsage().maxRSS*1024},notVerified:['Cloudflare Workers Free 10ms CPU/request','Cloudflare wall-clock/CPU or quota at this maximum scale','Worker/D1 request at this scale','Browser 1000-marker rendering or mobile interaction','Five 12MiB/24MP image processing and Blob capacity'],interpretation:'The maximum counters can fit within 1MiB only with bounded concise content; individually valid long descriptions can exceed the independent byte cap and are rejected, never truncated.'}
}
// Optional real local workerd+D1 requests. Each run owns an ephemeral database;
// no dev server, 8787 port, persisted fixture or remote account is accessed.
async function localWorkerScale(pkg:EventPackage){
 const [{Miniflare,convertV4MiniflareOptions},{build}]=await Promise.all([import('miniflare'),import('esbuild')])
 const built=await build({entryPoints:['worker/src/index.ts'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'})
 const token=()=>randomBytes(32).toString('hex'),root=token(),admin=token(),manager=token(),invite=token()
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:built.outputFiles[0].text,compatibilityDate:'2026-09-01',d1Databases:['DB'],bindings:{CREATION_MODE:'invite',CREATION_CODE:'fictional-scale-local',ADMIN_ROOT_SECRET:root,ALLOWED_ORIGINS:'http://localhost:5173',BUILD_VERSION:'fictional-local-scale'}}))
 const measurements:{name:string;status:number;wallMs:number;harnessProcessCpuMs:number;responseBytes:number;d1Meta?:unknown}[]=[]
 async function request(path:string,method='GET',auth='',body?:unknown){const start=performance.now(),cpu=process.cpuUsage();const response=await mf.dispatchFetch('http://localhost/api/v1'+path,{method,headers:{...(auth?{Authorization:'Bearer '+auth}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const raw=await response.text(),elapsed=process.cpuUsage(cpu);measurements.push({name:method+' '+path.replace(/\/groups\/[^/]+/,'/groups/:id').replace(/\/members\/[^/]+/,'/members/:id'),status:response.status,wallMs:performance.now()-start,harnessProcessCpuMs:(elapsed.user+elapsed.system)/1000,responseBytes:Buffer.byteLength(raw)});assert.equal(response.status,200,`Local scale ${method} ${path} returned ${response.status}: ${raw.slice(0,300)}`);return JSON.parse(raw).data}
 try{
  const db=await mf.getD1Database('DB'),migrations=readdirSync('worker/migrations').filter(x=>x.endsWith('.sql')).sort()
  for(const name of migrations)await db.exec(readFileSync('worker/migrations/'+name,'utf8').replace(/\n/g,' '))
  await request('/admin/session','POST','',{rootToken:root,sessionToken:admin})
  const draft=await request('/admin/events','POST',admin,{eventPackage:pkg,status:'draft',expectedRevision:0,operationId:randomUUID()});assert.equal(draft.eventPackage.event.extensions.convention.pois.length,1000)
  const group=await request('/groups','POST','',{creationCode:'fictional-scale-local',eventPackage:pkg,managerToken:manager,inviteToken:invite,operationId:randomUUID()})
  const responses=scaleResponses(),ids:string[]=[]
  for(const response of responses){const member=token(),joined=await request(`/groups/${group.id}/join`,'POST',invite,{memberToken:member,name:response.name,operationId:randomUUID()});ids.push(joined.id);await request(`/groups/${group.id}/members/${joined.id}/response`,'PUT',member,{operationId:randomUUID(),expectedRevision:0,scheduleRevision:group.scheduleRevision,response})}
  const projection=await request(`/groups/${group.id}/availability`,'GET',manager);assert.equal(projection.members.length,50);assert.ok(projection.members.every((p:AvailabilityPerson)=>p.status==='confirmed'))
  const shared=commonAvailability(pkg.event,projection.members,ids,1);assert.equal(shared.waiting.length,0);assert.equal(shared.intervals.length,497)
  const reread=await request(`/groups/${group.id}`,'GET',manager);assert.equal(reread.eventPackage.event.activities[0].sessions[0].start,'13:07');assert.equal(reread.eventPackage.event.activities[0].sessions[0].end,'13:52')
  const by=(verb:string)=>measurements.filter(m=>m.name.startsWith(verb)),stat=(values:number[])=>({count:values.length,min:Math.min(...values),p50:[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)],max:Math.max(...values)})
  return{scope:'Real local Miniflare/workerd/D1 only; ephemeral DB. No remote CPU/quota/browser claims',workerBundleSha256:createHash('sha256').update(built.outputFiles[0].text).digest('hex'),migrations,memberJoins:50,memberSubmissions:50,confirmedMembers:50,commonIntervals:shared.intervals.length,requestWallMs:{all:stat(measurements.map(m=>m.wallMs)),joins:stat(by('POST /groups/:id/join').map(m=>m.wallMs)),submissions:stat(by('PUT').map(m=>m.wallMs))},measurements,notes:['Harness process CPU does not include a reliable isolated workerd request CPU measurement','Draft API accepted the maximum counters; no media activation or public publication was simulated','No D1 per-query Cloudflare rows/CPU quota evidence is available from this local run']}
 }finally{await mf.dispose()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const result:Record<string,unknown>=runScaleMeasurements();if(process.argv.includes('--worker')){result.localWorker=await localWorkerScale(scalePackage());result.notVerified=(result.notVerified as string[]).filter(s=>s!=='Worker/D1 request at this scale')}const json=JSON.stringify(result,null,2);const at=process.argv.indexOf('--output');if(at>=0){assert.ok(process.argv[at+1],'--output needs a path');writeFileSync(process.argv[at+1],json+'\n',{mode:0o600})}process.stdout.write(json+'\n')}
