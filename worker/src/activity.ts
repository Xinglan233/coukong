import { parseEventPackage, validateEventPackage, validateResponse, validatePersonalPlan, validateEventTransition, eventSpatialSignature } from '../../shared/event-validation'
import { personalAvailability } from '../../shared/availability'
import { ACTIVITY_LIMITS, type ActivityDTO, type PersonalDTO, type PersonalPlan } from '../../shared/activity-contract'
import type { EventPackage } from '../../shared/types'
type Row=Record<string,any>
export interface ActivityContext {
 req:Request; DB:D1Database; path:string; method:string; authHash:string; now:string
 body:()=>Promise<Row>; hash:(s:string)=>Promise<string>; token:(value:unknown)=>string; op:(value:unknown)=>string
 admin:()=>Promise<void>; creation?:(code:unknown)=>Promise<void>; limited:(key:string,max:number)=>Promise<void>; fail:(code:string,message:string,status?:number)=>never
}
export function activityDTO(row:Row):ActivityDTO{return {id:row.event_id??row.id,revision:row.revision,scheduleRevision:row.schedule_revision,spatialRevision:row.spatial_revision,status:row.status,visibility:row.visibility??'public',eventPackage:JSON.parse(row.event_json),updatedAt:row.updated_at}}
export async function loadPublicActivity(DB:D1Database,id:string):Promise<ActivityDTO|null>{const row=await DB.prepare("SELECT v.*,e.visibility FROM events e JOIN event_versions v ON v.event_id=e.id AND v.revision=CASE WHEN e.visibility='private' THEN e.revision ELSE e.public_revision END WHERE e.id=? AND e.visibility='public'").bind(id).first<Row>();return row?activityDTO(row):null}
// Capabilities are independently scoped; an invitation reads only activity metadata.
export const eventAccessSQL="(e.visibility='public' OR e.owner_hash=? OR EXISTS(SELECT 1 FROM personal_plans p WHERE p.event_id=e.id AND p.token_hash=?) OR EXISTS(SELECT 1 FROM groups g WHERE g.source_event_id=e.id AND (g.manager_hash=? OR g.invite_hash=? OR EXISTS(SELECT 1 FROM members m WHERE m.group_id=g.id AND m.token_hash=?))))"
export const eventAccessArgs=(hash:string)=>[hash,hash,hash,hash,hash]
export async function loadReadableActivity(DB:D1Database,id:string,hash:string):Promise<ActivityDTO|null>{const row=await DB.prepare('SELECT v.*,e.visibility FROM events e JOIN event_versions v ON v.event_id=e.id AND v.revision=CASE WHEN e.visibility=\'private\' THEN e.revision ELSE e.public_revision END WHERE e.id=? AND '+eventAccessSQL).bind(id,...eventAccessArgs(hash)).first<Row>();return row?activityDTO(row):null}
function timeSignature(p:EventPackage){const e=p.event;return JSON.stringify([e.timezone,e.startDate,e.endDate,e.days,e.defaultBufferMinutes,e.defaultMinSlotMinutes,e.activities.map(a=>[a.id,a.sessions.map(s=>[s.id,s.date,s.start,s.end])])])}
const personalDTO=(p:Row):PersonalDTO=>({id:p.id,eventId:p.event_id,revision:p.revision,scheduleRevision:p.schedule_revision,spatialRevision:p.spatial_revision,plan:JSON.parse(p.plan_json),updatedAt:p.updated_at})
// Shared validator is loaded by the same module once its v2 plan validation is available.
async function planValidation(value:unknown,event:EventPackage,old:PersonalPlan|undefined,ctx:ActivityContext):Promise<PersonalPlan>{
 const plan=validatePersonalPlan(value,event.event,{allowMissingReferences:!!old})
 if(old){const knownPOI=new Set(event.event.extensions?.convention.pois.map(p=>p.id)||[]),oldPOI=new Set([...old.favorites.map(f=>f.poiId),...old.routes.flatMap(r=>[...(r.startPoiId?[r.startPoiId]:[]),...r.stops.map(s=>s.poiId)])]);for(const id of [...plan.favorites.map(f=>f.poiId),...plan.routes.flatMap(r=>[...(r.startPoiId?[r.startPoiId]:[]),...r.stops.map(s=>s.poiId)])])if(!knownPOI.has(id)&&!oldPOI.has(id))ctx.fail('INVALID_PERSONAL_PLAN','不能添加不存在的地点');const knownMaps=new Set(event.event.extensions?.convention.maps.map(m=>m.id)||[]),oldMaps=new Set(old.routes.map(r=>r.mapId));for(const r of plan.routes)if(r.mapId&&!knownMaps.has(r.mapId)&&!oldMaps.has(r.mapId))ctx.fail('INVALID_PERSONAL_PLAN','不能添加不存在的地图')}
 return plan
}
export async function handleActivity(ctx:ActivityContext):Promise<{handled:boolean;data?:unknown}>{
 const {DB,path,method,authHash,now}=ctx
 if(path==='/limits'&&method==='GET')return {handled:true,data:ACTIVITY_LIMITS}
 const first=(sql:string,...args:any[])=>DB.prepare(sql).bind(...args).first<Row>()
 if(path==='/events'&&method==='GET'){const rows=await DB.prepare('SELECT v.* FROM events e JOIN event_versions v ON v.event_id=e.id AND v.revision=CASE WHEN e.visibility=\'private\' THEN e.revision ELSE e.public_revision END WHERE e.visibility=\'public\' ORDER BY v.updated_at DESC,e.id LIMIT 50').all<Row>();return {handled:true,data:rows.results.map(activityDTO)}}
 if(path==='/private-events'&&method==='POST'){
  await ctx.limited('private-create:'+(ctx.req.headers.get('CF-Connecting-IP')||'local'),20)
  const b=await ctx.body();if(!ctx.creation)ctx.fail('FORBIDDEN','创建保护未配置',403);await ctx.creation!(b.creationCode)
  const ownerHash=await ctx.hash(ctx.token(b.ownerToken)),personHash=await ctx.hash(ctx.token(b.personalToken)),operation=ctx.op(b.operationId),digest=await ctx.hash(JSON.stringify(b))
  if(ownerHash===personHash)ctx.fail('INVALID_REQUEST','管理与个人凭据必须分开')
  const prior=await first("SELECT * FROM events WHERE owner_hash=? AND visibility='private'",ownerHash)
  if(prior){if(prior.private_create_op!==operation||prior.private_create_digest!==digest)ctx.fail('VERSION_CONFLICT','创建操作或凭据内容已变化',409);const person=await first('SELECT * FROM personal_plans WHERE event_id=? AND token_hash=?',prior.id,personHash);if(!person)ctx.fail('INVALID_CAPABILITY','个人记录已删除，请勿重复创建',401);return {handled:true,data:{activity:activityDTO(prior),personal:personalDTO(person!)}}}
  const pack=typeof b.raw==='string'?parseEventPackage(b.raw):validateEventPackage(b.eventPackage)
  if((pack.event.eventType??'generic')!=='generic'||pack.event.extensions||pack.assetManifest)ctx.fail('INVALID_EVENT_PACKAGE','日常活动使用通用类型，不接受公共地图扩展')
  if(typeof b.name!=='string'||!b.name.trim()||b.name.trim().length>50)ctx.fail('INVALID_REQUEST','名字须为1–50字')
  if(await first('SELECT id FROM personal_tombstones WHERE token_hash=?',personHash))ctx.fail('INVALID_CAPABILITY','个人凭据已撤销',401)
  const id='private-'+crypto.randomUUID(),personId=crypto.randomUUID(),json=JSON.stringify(pack),plan:PersonalPlan={response:validateResponse({name:b.name.trim(),presence:[],busy:[],bufferMinutes:pack.event.defaultBufferMinutes},pack.event),favorites:[],routes:[]}
  const inserted=await DB.batch([
   DB.prepare("INSERT INTO events(id,revision,schedule_revision,spatial_revision,status,event_json,public_revision,last_op,last_digest,created_at,updated_at,visibility,owner_hash,private_create_op,private_create_digest) SELECT ?,1,1,1,'published',?,NULL,?,?,?,?, 'private',?,?,? WHERE NOT EXISTS(SELECT 1 FROM events WHERE owner_hash=?) AND NOT EXISTS(SELECT 1 FROM personal_plans WHERE token_hash=?) AND NOT EXISTS(SELECT 1 FROM personal_tombstones WHERE token_hash=?) ON CONFLICT(id) DO NOTHING").bind(id,json,operation,digest,now,now,ownerHash,operation,digest,ownerHash,personHash,personHash),
   DB.prepare('INSERT INTO event_versions SELECT id,revision,schedule_revision,spatial_revision,status,event_json,updated_at FROM events WHERE id=? AND owner_hash=? AND last_op=? AND last_digest=?').bind(id,ownerHash,operation,digest),
   DB.prepare("INSERT INTO personal_plans(id,event_id,token_hash,schedule_revision,spatial_revision,plan_json,availability_json,create_op,create_digest,created_at,updated_at) SELECT ?,?,?,1,1,?,'[]',?,?,?,? WHERE EXISTS(SELECT 1 FROM events WHERE id=? AND owner_hash=? AND last_op=? AND last_digest=?)").bind(personId,id,personHash,JSON.stringify(plan),operation,digest,now,now,id,ownerHash,operation,digest)
  ])
  if(!inserted[0].meta.changes||!inserted[2].meta.changes)ctx.fail('VERSION_CONFLICT','创建凭据已使用，请回读已有活动',409)
  return {handled:true,data:{activity:activityDTO((await first('SELECT * FROM events WHERE id=?',id))!),personal:personalDTO((await first('SELECT * FROM personal_plans WHERE id=?',personId))!)}}
 }
 if(path==='/admin/events'){
  await ctx.admin()
  if(method==='GET'){const rows=await DB.prepare('SELECT * FROM events WHERE visibility=\'public\' ORDER BY updated_at DESC,id LIMIT 100').all<Row>();return {handled:true,data:rows.results.map(activityDTO)}}
  if(method==='POST'){
   const b=await ctx.body(),p=typeof b.raw==='string'?parseEventPackage(b.raw):validateEventPackage(b.eventPackage),status=b.status
   if(!['draft','published','archived','cancelled'].includes(status))ctx.fail('INVALID_REQUEST','活动状态无效')
   const operation=ctx.op(b.operationId),digest=await ctx.hash(JSON.stringify(b)),scope=authHash+':event:'+p.event.id
   const replay=await first('SELECT * FROM event_operations WHERE scope=? AND op=?',scope,operation);if(replay){if(replay.digest!==digest)ctx.fail('VERSION_CONFLICT','同一操作内容发生变化',409);return {handled:true,data:JSON.parse(replay.result_json)}}
   const old=await first('SELECT * FROM events WHERE id=?',p.event.id),expected=b.expectedRevision??0
   if(old?.visibility==='private')ctx.fail('FORBIDDEN','私人活动不能在公共管理入口编辑或发布',403)
   if(!Number.isInteger(expected)||expected<0||(old?.revision??0)!==expected)ctx.fail('VERSION_CONFLICT','活动版本已变化',409)
   if(old)validateEventTransition(JSON.parse(old.event_json),p)
   const schedule=old?old.schedule_revision+(timeSignature(JSON.parse(old.event_json))!==timeSignature(p)?1:0):1,spatial=old?old.spatial_revision+(eventSpatialSignature(JSON.parse(old.event_json))!==eventSpatialSignature(p)?1:0):1,revision=expected+1
   // Published packages may reference only this event's ready assets with matching dimensions/hash.
   if(status!=='draft')for(const map of p.event.extensions?.convention.maps||[]){
    const manifest=p.assetManifest?.find(a=>a.assetKey===map.assetKey)
    const asset=manifest?await first("SELECT id FROM media_assets WHERE event_id=? AND asset_key=? AND state='ready' AND width=? AND height=? AND sha256=? AND size_bytes=? AND mime_type=? ORDER BY revision DESC LIMIT 1",p.event.id,map.assetKey,map.width,map.height,manifest.sha256,manifest.sizeBytes,manifest.mimeType):await first("SELECT id FROM media_assets WHERE event_id=? AND asset_key=? AND state='ready' AND width=? AND height=? ORDER BY revision DESC LIMIT 1",p.event.id,map.assetKey,map.width,map.height)
    if(!asset)ctx.fail(manifest?'INVALID_MAP_ASSET':'MISSING_MAP_ASSET','地图文件尚未上传、内容或尺寸与清单不符，或不属于此活动')
   }
   const assetGuard=" AND (?='draft' OR (NOT EXISTS(SELECT 1 FROM json_each(?, '$.event.extensions.convention.maps') m WHERE NOT EXISTS(SELECT 1 FROM media_assets a WHERE a.event_id=? AND a.asset_key=json_extract(m.value,'$.assetKey') AND a.state='ready' AND a.width=json_extract(m.value,'$.width') AND a.height=json_extract(m.value,'$.height') AND (NOT EXISTS(SELECT 1 FROM json_each(?, '$.assetManifest') f WHERE json_extract(f.value,'$.assetKey')=a.asset_key) OR EXISTS(SELECT 1 FROM json_each(?, '$.assetManifest') f WHERE json_extract(f.value,'$.assetKey')=a.asset_key AND a.sha256=json_extract(f.value,'$.sha256') AND a.size_bytes=json_extract(f.value,'$.sizeBytes') AND a.mime_type=json_extract(f.value,'$.mimeType') AND a.width=json_extract(f.value,'$.width') AND a.height=json_extract(f.value,'$.height'))))) AND NOT EXISTS(SELECT 1 FROM json_each(?, '$.assetManifest') m WHERE NOT EXISTS(SELECT 1 FROM media_assets a WHERE a.event_id=? AND a.asset_key=json_extract(m.value,'$.assetKey') AND a.state='ready' AND a.sha256=json_extract(m.value,'$.sha256') AND a.size_bytes=json_extract(m.value,'$.sizeBytes') AND a.mime_type=json_extract(m.value,'$.mimeType') AND a.width=json_extract(m.value,'$.width') AND a.height=json_extract(m.value,'$.height')))))"
   const result:ActivityDTO={id:p.event.id,revision,scheduleRevision:schedule,spatialRevision:spatial,status,eventPackage:p,updatedAt:now}
   const publicRevision=status==='draft'?(old?.public_revision??null):revision
   const statements:D1PreparedStatement[]=[]
   if(old)statements.push(DB.prepare('UPDATE events SET revision=?,schedule_revision=?,spatial_revision=?,status=?,event_json=?,public_revision=?,last_op=?,last_digest=?,updated_at=? WHERE id=? AND revision=? AND EXISTS(SELECT 1 FROM admin_sessions WHERE hash=? AND expires_at>?)'+assetGuard).bind(revision,schedule,spatial,status,JSON.stringify(p),publicRevision,operation,digest,now,p.event.id,expected,authHash,Date.now(),status,JSON.stringify(p),p.event.id,JSON.stringify(p),JSON.stringify(p),JSON.stringify(p),p.event.id))
   else statements.push(DB.prepare('INSERT INTO events(id,revision,schedule_revision,spatial_revision,status,event_json,public_revision,last_op,last_digest,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM admin_sessions WHERE hash=? AND expires_at>?)'+assetGuard+' ON CONFLICT(id) DO NOTHING').bind(p.event.id,revision,schedule,spatial,status,JSON.stringify(p),publicRevision,operation,digest,now,now,authHash,Date.now(),status,JSON.stringify(p),p.event.id,JSON.stringify(p),JSON.stringify(p),JSON.stringify(p),p.event.id))
   statements.push(DB.prepare('INSERT INTO event_versions SELECT id,revision,schedule_revision,spatial_revision,status,event_json,updated_at FROM events WHERE id=? AND revision=? AND last_op=? AND last_digest=? ON CONFLICT(event_id,revision) DO NOTHING').bind(p.event.id,revision,operation,digest),DB.prepare('INSERT INTO event_operations SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM events WHERE id=? AND revision=? AND last_op=? AND last_digest=?) ON CONFLICT(scope,op) DO NOTHING').bind(scope,operation,digest,JSON.stringify(result),p.event.id,p.event.id,revision,operation,digest))
   const results=await DB.batch(statements);if(!results[0].meta.changes)ctx.fail('VERSION_CONFLICT','活动版本或管理员会话已变化',409);return {handled:true,data:result}
  }
 }
 const match=path.match(/^\/events\/([^/]+)(.*)$/);if(!match)return {handled:false}
 const eventId=match[1],tail=match[2]
 if(tail==='/owner'&&method==='GET'){const row=await first("SELECT * FROM events WHERE id=? AND visibility='private' AND owner_hash=?",eventId,authHash);if(!row)ctx.fail('FORBIDDEN','此入口没有私人活动管理权限',403);return {handled:true,data:activityDTO(row!)}}
 if(tail===''&&method==='GET'){const event=await loadReadableActivity(DB,eventId,authHash);if(!event)ctx.fail('NOT_FOUND','活动未发布或不存在',404);return {handled:true,data:event}}
 if(tail==='/event-export'&&method==='GET'){const event=await loadReadableActivity(DB,eventId,authHash);if(!event)ctx.fail('NOT_FOUND','活动不存在或没有访问权限',404);return {handled:true,data:event!.eventPackage}}
 if(tail===''&&method==='PATCH'){
  const old=await first("SELECT * FROM events WHERE id=? AND visibility='private'",eventId)
  if(!old)ctx.fail('FORBIDDEN','公共活动只能由管理员编辑',403)
  if(old!.owner_hash!==authHash)ctx.fail('FORBIDDEN','只有此私人活动的管理入口可以编辑资料',403)
  await ctx.limited('private-edit:'+authHash,30)
  const b=await ctx.body(),operation=ctx.op(b.operationId),digest=await ctx.hash(JSON.stringify(b))
  if(old!.last_op===operation){if(old!.last_digest!==digest)ctx.fail('VERSION_CONFLICT','同一操作内容发生变化',409);return {handled:true,data:activityDTO(old!)}}
  if(b.expectedRevision!==old!.revision)ctx.fail('VERSION_CONFLICT','活动资料已变化，请保留修改后重新核对',409)
  const pack=typeof b.raw==='string'?parseEventPackage(b.raw):validateEventPackage(b.eventPackage)
  if((pack.event.eventType??'generic')!=='generic'||pack.event.extensions||pack.assetManifest)ctx.fail('INVALID_EVENT_PACKAGE','日常活动使用通用类型，不接受公共地图扩展')
  if(pack.event.id!==JSON.parse(old!.event_json).event.id)ctx.fail('INVALID_EVENT_PACKAGE','活动资料ID不能修改')
  validateEventTransition(JSON.parse(old!.event_json),pack)
  if(pack.event.timezone!==JSON.parse(old!.event_json).event.timezone&&await first('SELECT id FROM personal_plans WHERE event_id=? AND revision>0 LIMIT 1',eventId))ctx.fail('FORBIDDEN','已有个人计划时不能直接改变时区，请创建新活动',409)
  const schedule=old!.schedule_revision+(timeSignature(JSON.parse(old!.event_json))!==timeSignature(pack)?1:0),revision=old!.revision+1
  const result=await DB.batch([
   DB.prepare("UPDATE events SET revision=?,schedule_revision=?,event_json=?,public_revision=NULL,last_op=?,last_digest=?,updated_at=? WHERE id=? AND visibility='private' AND owner_hash=? AND revision=?").bind(revision,schedule,JSON.stringify(pack),operation,digest,now,eventId,authHash,b.expectedRevision),
   // Private packages keep one current version; group snapshots remain independent.
   DB.prepare('DELETE FROM event_versions WHERE event_id=? AND EXISTS(SELECT 1 FROM events WHERE id=? AND revision=? AND owner_hash=? AND last_op=? AND last_digest=?)').bind(eventId,eventId,revision,authHash,operation,digest),
   DB.prepare('INSERT INTO event_versions SELECT id,revision,schedule_revision,spatial_revision,status,event_json,updated_at FROM events WHERE id=? AND revision=? AND owner_hash=? AND last_op=? AND last_digest=? ON CONFLICT(event_id,revision) DO NOTHING').bind(eventId,revision,authHash,operation,digest)
  ])
  if(!result[0].meta.changes)ctx.fail('VERSION_CONFLICT','活动版本已变化，请保留草稿',409)
  return {handled:true,data:{...activityDTO(old!),revision,scheduleRevision:schedule,eventPackage:pack,updatedAt:now}}
 }
 if(tail==='/personal'&&method==='POST'){
  const source=ctx.req.headers.get('CF-Connecting-IP')||'local';await ctx.limited('personal-create-source:'+source,120)
  const b=await ctx.body(),hash=await ctx.hash(ctx.token(b.personalToken)),operation=ctx.op(b.operationId),digest=await ctx.hash(JSON.stringify(b));await ctx.limited('personal-create:'+hash,20)
  const day=Math.floor(Date.now()/86400000),dailyKey='personal-create-day:'+source
  await DB.prepare('INSERT INTO rate_limits(key,window,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window').bind(dailyKey,day).run()
  const daily=await first('SELECT count FROM rate_limits WHERE key=?',dailyKey);if(daily!.count>1000)ctx.fail('LIMIT_EXCEEDED','此来源今日创建次数过多，请保留本机记录后稍后重试',429)
  const old=await first('SELECT * FROM personal_plans WHERE event_id=? AND token_hash=?',eventId,hash);if(old){if(old.create_op!==operation||old.create_digest!==digest)ctx.fail('VERSION_CONFLICT','个人创建操作内容变化',409);return {handled:true,data:personalDTO(old)}}
  if(await first('SELECT id FROM personal_tombstones WHERE token_hash=?',hash))ctx.fail('INVALID_CAPABILITY','此个人凭据已撤销，请使用新的身份凭据',401)
  const event=await loadReadableActivity(DB,eventId,authHash);if(!event||event.status!=='published')ctx.fail('EVENT_UNAVAILABLE','活动尚未发布、取消或已归档',409)
  if(typeof b.name!=='string'||!b.name.trim()||b.name.trim().length>50)ctx.fail('INVALID_REQUEST','名字须为1–50字')
  const plan:PersonalPlan={response:validateResponse({name:b.name.trim(),presence:[],busy:[],bufferMinutes:event!.eventPackage.event.defaultBufferMinutes},event!.eventPackage.event),favorites:[],routes:[]},id=crypto.randomUUID()
  const creationCleanup=DB.prepare("DELETE FROM personal_operations WHERE rowid IN(SELECT rowid FROM personal_operations WHERE expires_at<=? ORDER BY expires_at LIMIT 128) AND NOT EXISTS(SELECT 1 FROM personal_plans WHERE token_hash=?) AND EXISTS(SELECT 1 FROM events e JOIN event_versions v ON v.event_id=e.id AND v.revision=CASE WHEN e.visibility='private' THEN e.revision ELSE e.public_revision END WHERE e.id=? AND v.status='published' AND v.revision=?)").bind(Date.now(),hash,eventId,event!.revision)
  const creationStatement=DB.prepare("INSERT INTO personal_plans(id,event_id,token_hash,schedule_revision,spatial_revision,plan_json,availability_json,create_op,create_digest,created_at,updated_at) SELECT ?,?,?,?,?,?,'[]',?,?,?,? WHERE EXISTS(SELECT 1 FROM events e JOIN event_versions v ON v.event_id=e.id AND v.revision=CASE WHEN e.visibility='private' THEN e.revision ELSE e.public_revision END WHERE e.id=? AND v.status='published' AND v.revision=? AND "+eventAccessSQL+") AND NOT EXISTS(SELECT 1 FROM personal_plans WHERE token_hash=?) ON CONFLICT(token_hash) DO NOTHING").bind(id,eventId,hash,event!.scheduleRevision,event!.spatialRevision,JSON.stringify(plan),operation,digest,now,now,eventId,event!.revision,...eventAccessArgs(authHash),hash)
  const created=await DB.batch([creationCleanup,creationStatement]);const inserted=created[1]
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
  const saved=await first('SELECT * FROM personal_operations WHERE scope=? AND op=?',scope,operation);if(saved){if(saved.digest!==digest)ctx.fail('VERSION_CONFLICT','同一操作内容发生变化',409);if(saved.expires_at<=Date.now())ctx.fail('IDEMPOTENCY_EXPIRED','提交回执已过期，请回读当前计划并创建新操作',409);if(saved.committed_revision!==row!.revision)ctx.fail('OPERATION_SUPERSEDED','此提交已经成功，但后来已有新修改，请回读当前计划',409);return {handled:true,data:personalDTO(row!)}}if(row!.last_op===operation){if(row!.last_digest!==digest)ctx.fail('VERSION_CONFLICT','同一操作内容发生变化',409);ctx.fail('IDEMPOTENCY_EXPIRED','提交回执已过期，请回读当前计划并创建新操作',409)}
  const event=await loadReadableActivity(DB,eventId,authHash);if(!event)ctx.fail('EVENT_UNAVAILABLE','活动资料未发布',409)
  if(event!.status==='cancelled')ctx.fail('EVENT_CANCELLED','活动已取消，请先查看最新资料',409)
  if(!Number.isInteger(b.spatialRevision)||b.spatialRevision!==event!.spatialRevision||b.scheduleRevision!==event!.scheduleRevision)ctx.fail('RECONFIRM_REQUIRED','活动时间或地图资料已变化，请保留草稿并重新核对',409)
  if(new TextEncoder().encode(JSON.stringify(b.plan)).byteLength>ACTIVITY_LIMITS.personalPlanBytes)ctx.fail('PERSONAL_PLAN_TOO_LARGE','个人计划最多1.5 MiB，请减少备注或记录；本机草稿会保留',413)
  const plan=await planValidation(b.plan,event!.eventPackage,JSON.parse(row!.plan_json),ctx),availability=personalAvailability(event!.eventPackage.event,plan.response),result:PersonalDTO={id,eventId,revision:b.expectedRevision+1,scheduleRevision:b.scheduleRevision,spatialRevision:b.spatialRevision,plan,updatedAt:now}
  const expiresAt=Date.now()+ACTIVITY_LIMITS.idempotencyTTLSeconds*1000,receipt={id,eventId,revision:result.revision,scheduleRevision:result.scheduleRevision,spatialRevision:result.spatialRevision,updatedAt:now}
  const expiryCleanup=DB.prepare("DELETE FROM personal_operations WHERE rowid IN(SELECT rowid FROM personal_operations WHERE expires_at<=? ORDER BY expires_at LIMIT 128) AND EXISTS(SELECT 1 FROM personal_plans WHERE id=? AND event_id=? AND token_hash=? AND revision=?) AND EXISTS(SELECT 1 FROM events e JOIN event_versions v ON v.event_id=e.id AND v.revision=CASE WHEN e.visibility='private' THEN e.revision ELSE e.public_revision END WHERE e.id=? AND v.schedule_revision=? AND v.spatial_revision=? AND v.status IN ('published','archived'))").bind(Date.now(),id,eventId,authHash,b.expectedRevision,eventId,b.scheduleRevision,b.spatialRevision)
  const results=await DB.batch([expiryCleanup,DB.prepare("UPDATE personal_plans SET revision=revision+1,schedule_revision=?,spatial_revision=?,plan_json=?,availability_json=?,last_op=?,last_digest=?,last_receipt_expires_at=?,updated_at=? WHERE id=? AND event_id=? AND token_hash=? AND revision=? AND EXISTS(SELECT 1 FROM events e JOIN event_versions v ON v.event_id=e.id AND v.revision=CASE WHEN e.visibility='private' THEN e.revision ELSE e.public_revision END WHERE e.id=? AND v.schedule_revision=? AND v.spatial_revision=? AND v.status IN ('published','archived'))").bind(b.scheduleRevision,b.spatialRevision,JSON.stringify(plan),JSON.stringify(availability),operation,digest,expiresAt,now,id,eventId,authHash,b.expectedRevision,eventId,b.scheduleRevision,b.spatialRevision),DB.prepare('INSERT INTO personal_operations(scope,op,digest,result_json,personal_id,created_at,expires_at,committed_revision) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM personal_plans WHERE id=? AND token_hash=? AND last_op=? AND last_digest=?) AND NOT EXISTS(SELECT 1 FROM personal_operations WHERE scope=? AND op=?) ON CONFLICT(scope,op) DO NOTHING').bind(scope,operation,digest,JSON.stringify(receipt),id,Date.now(),expiresAt,result.revision,id,authHash,operation,digest,scope,operation)])
  if(!results[1].meta.changes)ctx.fail('VERSION_CONFLICT','回执不可用或个人/活动版本已变化，请回读核对并保留草稿',409);return {handled:true,data:result}
 }
 if(method==='DELETE'){
  const b=await ctx.body(),operation=ctx.op(b.operationId),digest=await ctx.hash(JSON.stringify(b));if(!Number.isInteger(b.expectedRevision))ctx.fail('INVALID_REQUEST','需要 expectedRevision')
  const result=await DB.batch([DB.prepare('INSERT INTO personal_tombstones SELECT id,event_id,token_hash,?,?,? FROM personal_plans WHERE id=? AND event_id=? AND token_hash=? AND revision=? ON CONFLICT(id) DO NOTHING').bind(operation,digest,now,id,eventId,authHash,b.expectedRevision),DB.prepare('DELETE FROM personal_plans WHERE id=? AND event_id=? AND token_hash=? AND revision=? AND EXISTS(SELECT 1 FROM personal_tombstones WHERE id=? AND token_hash=? AND op=? AND digest=?)').bind(id,eventId,authHash,b.expectedRevision,id,authHash,operation,digest)])
  if(!result[1].meta.changes)ctx.fail('VERSION_CONFLICT','个人版本已变化，请重新确认删除',409);return {handled:true,data:{deleted:true}}
 }
 return {handled:false}
}
