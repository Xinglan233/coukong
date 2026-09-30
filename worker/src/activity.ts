import { parseEventPackage, validateEventPackage, validateResponse, validatePersonalPlan } from '../../shared/event-validation'
import { personalAvailability } from '../../shared/availability'
import type { ActivityDTO, PersonalDTO, PersonalPlan } from '../../shared/activity-contract'
import type { EventPackage } from '../../shared/types'
type Row=Record<string,any>
export interface ActivityContext {
 req:Request; DB:D1Database; path:string; method:string; authHash:string; now:string
 body:()=>Promise<Row>; hash:(s:string)=>Promise<string>; token:(value:unknown)=>string; op:(value:unknown)=>string
 admin:()=>Promise<void>; limited:(key:string,max:number)=>Promise<void>; fail:(code:string,message:string,status?:number)=>never
}
export function activityDTO(row:Row):ActivityDTO{return {id:row.event_id??row.id,revision:row.revision,scheduleRevision:row.schedule_revision,spatialRevision:row.spatial_revision,status:row.status,eventPackage:JSON.parse(row.event_json),updatedAt:row.updated_at}}
export async function loadPublicActivity(DB:D1Database,id:string):Promise<ActivityDTO|null>{const row=await DB.prepare('SELECT v.* FROM events e JOIN event_versions v ON v.event_id=e.id AND v.revision=e.public_revision WHERE e.id=?').bind(id).first<Row>();return row?activityDTO(row):null}
function timeSignature(p:EventPackage){const e=p.event;return JSON.stringify([e.timezone,e.startDate,e.endDate,e.days,e.defaultBufferMinutes,e.defaultMinSlotMinutes,e.activities.map(a=>[a.id,a.sessions.map(s=>[s.id,s.date,s.start,s.end])])])}
function spaceSignature(p:EventPackage){const data=p.event.extensions?.convention;if(!data)return 'none';return JSON.stringify([data.maps.map(m=>[m.id,m.assetKey,m.width,m.height,m.revision,m.needsReview]),data.pois.map(p=>[p.id,p.position,p.routeNodeId,p.closed]),data.routingGraphs.map(g=>[g.id,g.mapId,g.mapRevision,g.revision,g.nodes,g.edges]),p.event.activities.flatMap(a=>a.sessions.map(s=>[s.id,s.poiId]))])}
const personalDTO=(p:Row):PersonalDTO=>({id:p.id,eventId:p.event_id,revision:p.revision,scheduleRevision:p.schedule_revision,spatialRevision:p.spatial_revision,plan:JSON.parse(p.plan_json),updatedAt:p.updated_at})
// Shared validator is loaded by the same module once its v2 plan validation is available.
async function planValidation(value:unknown,event:EventPackage,old:PersonalPlan|undefined,ctx:ActivityContext):Promise<PersonalPlan>{
 const plan=validatePersonalPlan(value,event.event,{allowMissingReferences:!!old})
 if(old){const knownPOI=new Set(event.event.extensions?.convention.pois.map(p=>p.id)||[]),oldPOI=new Set([...old.favorites.map(f=>f.poiId),...old.routes.flatMap(r=>[...(r.startPoiId?[r.startPoiId]:[]),...r.stops.map(s=>s.poiId)])]);for(const id of [...plan.favorites.map(f=>f.poiId),...plan.routes.flatMap(r=>[...(r.startPoiId?[r.startPoiId]:[]),...r.stops.map(s=>s.poiId)])])if(!knownPOI.has(id)&&!oldPOI.has(id))ctx.fail('INVALID_PERSONAL_PLAN','不能添加不存在的地点');const knownMaps=new Set(event.event.extensions?.convention.maps.map(m=>m.id)||[]),oldMaps=new Set(old.routes.map(r=>r.mapId));for(const r of plan.routes)if(!knownMaps.has(r.mapId)&&!oldMaps.has(r.mapId))ctx.fail('INVALID_PERSONAL_PLAN','不能添加不存在的地图')}
 return plan
}
export async function handleActivity(ctx:ActivityContext):Promise<{handled:boolean;data?:unknown}>{
 const {DB,path,method,authHash,now}=ctx
 const first=(sql:string,...args:any[])=>DB.prepare(sql).bind(...args).first<Row>()
 if(path==='/events'&&method==='GET'){const rows=await DB.prepare('SELECT v.* FROM events e JOIN event_versions v ON v.event_id=e.id AND v.revision=e.public_revision ORDER BY v.updated_at DESC,e.id LIMIT 50').all<Row>();return {handled:true,data:rows.results.map(activityDTO)}}
 if(path==='/admin/events'){
  await ctx.admin()
  if(method==='GET'){const rows=await DB.prepare('SELECT * FROM events ORDER BY updated_at DESC,id LIMIT 100').all<Row>();return {handled:true,data:rows.results.map(activityDTO)}}
  if(method==='POST'){
   const b=await ctx.body(),p=typeof b.raw==='string'?parseEventPackage(b.raw):validateEventPackage(b.eventPackage),status=b.status
   if(!['draft','published','archived','cancelled'].includes(status))ctx.fail('INVALID_REQUEST','活动状态无效')
   const operation=ctx.op(b.operationId),digest=await ctx.hash(JSON.stringify(b)),scope=authHash+':event:'+p.event.id
   const replay=await first('SELECT * FROM event_operations WHERE scope=? AND op=?',scope,operation);if(replay){if(replay.digest!==digest)ctx.fail('VERSION_CONFLICT','同一操作内容发生变化',409);return {handled:true,data:JSON.parse(replay.result_json)}}
   const old=await first('SELECT * FROM events WHERE id=?',p.event.id),expected=b.expectedRevision??0
   if(!Number.isInteger(expected)||expected<0||(old?.revision??0)!==expected)ctx.fail('VERSION_CONFLICT','活动版本已变化',409)
   const schedule=old?old.schedule_revision+(timeSignature(JSON.parse(old.event_json))!==timeSignature(p)?1:0):1,spatial=old?old.spatial_revision+(spaceSignature(JSON.parse(old.event_json))!==spaceSignature(p)?1:0):1,revision=expected+1
   // Published packages may reference only this event's ready assets with matching dimensions/hash.
   if(status!=='draft')for(const map of p.event.extensions?.convention.maps||[]){const asset=await first("SELECT * FROM media_assets WHERE event_id=? AND asset_key=? AND state='ready' AND width=? AND height=? ORDER BY revision DESC LIMIT 1",p.event.id,map.assetKey,map.width,map.height);if(!asset)ctx.fail('MISSING_MAP_ASSET','地图文件尚未上传、尺寸不符或不属于此活动');const manifest=p.assetManifest?.find(a=>a.assetKey===map.assetKey);if(manifest&&(manifest.sha256!==asset.sha256||manifest.sizeBytes!==asset.size_bytes))ctx.fail('INVALID_MAP_ASSET','地图文件哈希或大小与清单不符')}
   const assetGuard=" AND (?='draft' OR (NOT EXISTS(SELECT 1 FROM json_each(?, '$.event.extensions.convention.maps') m WHERE NOT EXISTS(SELECT 1 FROM media_assets a WHERE a.event_id=? AND a.asset_key=json_extract(m.value,'$.assetKey') AND a.state='ready' AND a.width=json_extract(m.value,'$.width') AND a.height=json_extract(m.value,'$.height'))) AND NOT EXISTS(SELECT 1 FROM json_each(?, '$.assetManifest') m WHERE NOT EXISTS(SELECT 1 FROM media_assets a WHERE a.event_id=? AND a.asset_key=json_extract(m.value,'$.assetKey') AND a.state='ready' AND a.sha256=json_extract(m.value,'$.sha256') AND a.size_bytes=json_extract(m.value,'$.sizeBytes')))))"
   const result:ActivityDTO={id:p.event.id,revision,scheduleRevision:schedule,spatialRevision:spatial,status,eventPackage:p,updatedAt:now}
   const publicRevision=status==='draft'?(old?.public_revision??null):revision
   const statements:D1PreparedStatement[]=[]
   if(old)statements.push(DB.prepare('UPDATE events SET revision=?,schedule_revision=?,spatial_revision=?,status=?,event_json=?,public_revision=?,last_op=?,last_digest=?,updated_at=? WHERE id=? AND revision=? AND EXISTS(SELECT 1 FROM admin_sessions WHERE hash=? AND expires_at>?)'+assetGuard).bind(revision,schedule,spatial,status,JSON.stringify(p),publicRevision,operation,digest,now,p.event.id,expected,authHash,Date.now(),status,JSON.stringify(p),p.event.id,JSON.stringify(p),p.event.id))
   else statements.push(DB.prepare('INSERT INTO events SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM admin_sessions WHERE hash=? AND expires_at>?)'+assetGuard+' ON CONFLICT(id) DO NOTHING').bind(p.event.id,revision,schedule,spatial,status,JSON.stringify(p),publicRevision,operation,digest,now,now,authHash,Date.now(),status,JSON.stringify(p),p.event.id,JSON.stringify(p),p.event.id))
   statements.push(DB.prepare('INSERT INTO event_versions SELECT id,revision,schedule_revision,spatial_revision,status,event_json,updated_at FROM events WHERE id=? AND revision=? AND last_op=? AND last_digest=? ON CONFLICT(event_id,revision) DO NOTHING').bind(p.event.id,revision,operation,digest),DB.prepare('INSERT INTO event_operations SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM events WHERE id=? AND revision=? AND last_op=? AND last_digest=?) ON CONFLICT(scope,op) DO NOTHING').bind(scope,operation,digest,JSON.stringify(result),p.event.id,p.event.id,revision,operation,digest))
   const results=await DB.batch(statements);if(!results[0].meta.changes)ctx.fail('VERSION_CONFLICT','活动版本或管理员会话已变化',409);return {handled:true,data:result}
  }
 }
 const match=path.match(/^\/events\/([^/]+)(.*)$/);if(!match)return {handled:false}
 const eventId=match[1],tail=match[2]
 if(tail===''&&method==='GET'){const event=await loadPublicActivity(DB,eventId);if(!event)ctx.fail('NOT_FOUND','活动未发布或不存在',404);return {handled:true,data:event}}
 if(tail==='/personal'&&method==='POST'){
  const b=await ctx.body(),hash=await ctx.hash(ctx.token(b.personalToken)),operation=ctx.op(b.operationId),digest=await ctx.hash(JSON.stringify(b));await ctx.limited('personal-create:'+hash,20)
  const old=await first('SELECT * FROM personal_plans WHERE event_id=? AND token_hash=?',eventId,hash);if(old){if(old.create_op!==operation||old.create_digest!==digest)ctx.fail('VERSION_CONFLICT','个人创建操作内容变化',409);return {handled:true,data:personalDTO(old)}}
  const event=await loadPublicActivity(DB,eventId);if(!event||event.status!=='published')ctx.fail('EVENT_UNAVAILABLE','活动尚未发布、取消或已归档',409)
  if(typeof b.name!=='string'||!b.name.trim()||b.name.trim().length>50)ctx.fail('INVALID_REQUEST','名字须为1–50字')
  const plan:PersonalPlan={response:validateResponse({name:b.name.trim(),presence:[],busy:[],bufferMinutes:event!.eventPackage.event.defaultBufferMinutes},event!.eventPackage.event),favorites:[],routes:[]},id=crypto.randomUUID()
  const inserted=await DB.prepare("INSERT INTO personal_plans(id,event_id,token_hash,schedule_revision,spatial_revision,plan_json,availability_json,create_op,create_digest,created_at,updated_at) SELECT ?,?,?,?,?,?,'[]',?,?,?,? WHERE EXISTS(SELECT 1 FROM events e JOIN event_versions v ON v.event_id=e.id AND v.revision=e.public_revision WHERE e.id=? AND v.status='published' AND v.revision=?) ON CONFLICT(token_hash) DO NOTHING").bind(id,eventId,hash,event!.scheduleRevision,event!.spatialRevision,JSON.stringify(plan),operation,digest,now,now,eventId,event!.revision).run()
  if(!inserted.meta.changes)ctx.fail('VERSION_CONFLICT','活动版本或个人凭据已变化',409);return {handled:true,data:personalDTO((await first('SELECT * FROM personal_plans WHERE id=?',id))!)}
 }
 const personal=tail.match(/^\/personal\/([^/]+)(\/links?)?$/);if(!personal)return {handled:false}
 const id=personal[1],row=await first('SELECT * FROM personal_plans WHERE id=? AND event_id=?',id,eventId)
 if(!row){if(method==='DELETE'){const tomb=await first('SELECT * FROM personal_tombstones WHERE id=? AND event_id=? AND token_hash=?',id,eventId,authHash);if(tomb){const b=await ctx.body();if(tomb.op!==ctx.op(b.operationId)||tomb.digest!==await ctx.hash(JSON.stringify(b)))ctx.fail('VERSION_CONFLICT','删除操作内容变化',409);return {handled:true,data:{deleted:true}}}}ctx.fail('INVALID_CAPABILITY','个人记录不存在或凭据已撤销',401)}
 if(row!.token_hash!==authHash)ctx.fail('FORBIDDEN','只能访问本人的个人计划',403)
 if(personal[2]&&method==='POST'){
  const b=await ctx.body(),memberHash=await ctx.hash(ctx.token(b.memberToken));const member=await first('SELECT m.id,m.group_id FROM members m JOIN groups g ON g.id=m.group_id WHERE m.id=? AND m.token_hash=? AND g.source_event_id=?',b.memberId,memberHash,eventId)
  if(!member)ctx.fail('FORBIDDEN','必须同时拥有本活动个人与小队成员凭据',403)
  await DB.prepare('INSERT INTO personal_member_links SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM personal_plans WHERE id=? AND token_hash=?) AND EXISTS(SELECT 1 FROM members m JOIN groups g ON g.id=m.group_id WHERE m.id=? AND m.token_hash=? AND g.source_event_id=?) ON CONFLICT(personal_id,member_id) DO NOTHING').bind(id,member!.id,member!.group_id,now,id,authHash,member!.id,memberHash,eventId).run();return {handled:true,data:{linked:true,groupId:member!.group_id,memberId:member!.id}}
 }
 if(personal[2]){if(method==='GET'){const links=await DB.prepare('SELECT group_id AS groupId,member_id AS memberId,created_at AS createdAt FROM personal_member_links WHERE personal_id=?').bind(id).all();return {handled:true,data:links.results}}if(method==='DELETE'){const b=await ctx.body();if(typeof b.memberId!=='string')ctx.fail('INVALID_REQUEST','需要 memberId');await DB.prepare('DELETE FROM personal_member_links WHERE personal_id=? AND member_id=?').bind(id,b.memberId).run();return {handled:true,data:{unlinked:true}}}return {handled:false}}
 if(method==='GET')return {handled:true,data:personalDTO(row!)}
 if(method==='PUT'){
  await ctx.limited('personal-write:'+authHash,60);const b=await ctx.body(),operation=ctx.op(b.operationId),digest=await ctx.hash(JSON.stringify(b)),scope=authHash+':'+id
  const saved=await first('SELECT * FROM personal_operations WHERE scope=? AND op=?',scope,operation);if(saved){if(saved.digest!==digest)ctx.fail('VERSION_CONFLICT','同一操作内容发生变化',409);return {handled:true,data:JSON.parse(saved.result_json)}}
  const event=await loadPublicActivity(DB,eventId);if(!event)ctx.fail('EVENT_UNAVAILABLE','活动资料未发布',409)
  if(event!.status==='cancelled')ctx.fail('EVENT_CANCELLED','活动已取消，请先查看最新资料',409)
  if(!Number.isInteger(b.spatialRevision)||b.spatialRevision!==event!.spatialRevision||b.scheduleRevision!==event!.scheduleRevision)ctx.fail('RECONFIRM_REQUIRED','活动时间或地图资料已变化，请保留草稿并重新核对',409)
  const plan=await planValidation(b.plan,event!.eventPackage,JSON.parse(row!.plan_json),ctx),availability=personalAvailability(event!.eventPackage.event,plan.response),result:PersonalDTO={id,eventId,revision:b.expectedRevision+1,scheduleRevision:b.scheduleRevision,spatialRevision:b.spatialRevision,plan,updatedAt:now}
  const results=await DB.batch([DB.prepare("UPDATE personal_plans SET revision=revision+1,schedule_revision=?,spatial_revision=?,plan_json=?,availability_json=?,last_op=?,last_digest=?,updated_at=? WHERE id=? AND event_id=? AND token_hash=? AND revision=? AND EXISTS(SELECT 1 FROM events e JOIN event_versions v ON v.event_id=e.id AND v.revision=e.public_revision WHERE e.id=? AND v.schedule_revision=? AND v.spatial_revision=? AND v.status IN ('published','archived'))").bind(b.scheduleRevision,b.spatialRevision,JSON.stringify(plan),JSON.stringify(availability),operation,digest,now,id,eventId,authHash,b.expectedRevision,eventId,b.scheduleRevision,b.spatialRevision),DB.prepare('INSERT INTO personal_operations SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM personal_plans WHERE id=? AND token_hash=? AND last_op=? AND last_digest=?) ON CONFLICT(scope,op) DO NOTHING').bind(scope,operation,digest,JSON.stringify(result),id,id,authHash,operation,digest)])
  if(!results[0].meta.changes)ctx.fail('VERSION_CONFLICT','个人或活动版本已变化，请保留草稿',409);return {handled:true,data:result}
 }
 if(method==='DELETE'){
  const b=await ctx.body(),operation=ctx.op(b.operationId),digest=await ctx.hash(JSON.stringify(b));if(!Number.isInteger(b.expectedRevision))ctx.fail('INVALID_REQUEST','需要 expectedRevision')
  const result=await DB.batch([DB.prepare('INSERT INTO personal_tombstones SELECT id,event_id,token_hash,?,?,? FROM personal_plans WHERE id=? AND event_id=? AND token_hash=? AND revision=? ON CONFLICT(id) DO NOTHING').bind(operation,digest,now,id,eventId,authHash,b.expectedRevision),DB.prepare('DELETE FROM personal_plans WHERE id=? AND event_id=? AND token_hash=? AND revision=? AND EXISTS(SELECT 1 FROM personal_tombstones WHERE id=? AND token_hash=? AND op=? AND digest=?)').bind(id,eventId,authHash,b.expectedRevision,id,authHash,operation,digest)])
  if(!result[1].meta.changes)ctx.fail('VERSION_CONFLICT','个人版本已变化，请重新确认删除',409);return {handled:true,data:{deleted:true}}
 }
 return {handled:false}
}
