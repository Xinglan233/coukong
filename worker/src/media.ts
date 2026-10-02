import type { ActivityContext } from './activity'
import type { MediaAssetDTO } from '../../shared/activity-contract'
import { ACTIVITY_LIMITS } from '../../shared/activity-contract'
type Row=Record<string,any>
export const MEDIA_BUDGET_BYTES=256*1024*1024
const chargedWhere="NOT(state='revoked' AND blob_path IS NULL AND source_path IS NULL AND display_path IS NULL)"
const chargeSQL="COALESCE(SUM(CASE WHEN source_path IS NOT NULL THEN COALESCE(size_bytes,12582912)+COALESCE(display_size_bytes,3145728)+COALESCE(declared_size_bytes,12582912) ELSE COALESCE(declared_size_bytes,12582912)+12582912+3145728 END),0)"
const unreferencedSQL="NOT EXISTS(SELECT 1 FROM event_versions v, json_each(v.event_json,'$.event.extensions.convention.maps') m WHERE v.event_id=media_assets.event_id AND json_extract(m.value,'$.assetKey')=media_assets.asset_key) AND NOT EXISTS(SELECT 1 FROM events e,json_each(e.event_json,'$.event.extensions.convention.maps') m WHERE e.id=media_assets.event_id AND json_extract(m.value,'$.assetKey')=media_assets.asset_key)"
export interface MediaContext extends ActivityContext { verifyNode:()=>Promise<void> }
export interface VercelOIDCConfig { VERCEL_OIDC_ISSUER?:string; VERCEL_OIDC_AUDIENCE?:string; VERCEL_OIDC_SUBJECT?:string }
const decoded=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))
export async function verifyVercelOIDC(req:Request,env:VercelOIDCConfig,fetcher:typeof fetch=fetch){
 const deny=()=>{throw new Error('Vercel运行时证明无效')}
 const issuer=env.VERCEL_OIDC_ISSUER,audience=env.VERCEL_OIDC_AUDIENCE,subject=env.VERCEL_OIDC_SUBJECT,jwt=req.headers.get('X-Vercel-OIDC-Token')
 if(!issuer||!/^https:\/\/oidc\.vercel\.com(?:\/[-\w]+)?$/.test(issuer)||!audience||!subject||!jwt||jwt.length>16000)deny()
 const subjects=subject!.split(',').map(s=>s.trim()).filter(Boolean)
 const pieces=jwt!.split('.');if(pieces.length!==3)deny()
 const header=JSON.parse(new TextDecoder().decode(decoded(pieces[0]))),claim=JSON.parse(new TextDecoder().decode(decoded(pieces[1]))),now=Math.floor(Date.now()/1000)
 if(header.alg!=='RS256'||typeof header.kid!=='string'||claim.iss!==issuer||claim.aud!==audience||!subjects.includes(claim.sub)||!Number.isInteger(claim.exp)||claim.exp<=now||!Number.isInteger(claim.iat)||claim.iat>now+30||claim.exp-claim.iat>(String(claim.sub).endsWith(':environment:development')?43200:7200)||(claim.nbf!==undefined&&claim.nbf>now+30))deny()
 const result=await fetcher.call(globalThis,issuer+'/.well-known/jwks',{signal:AbortSignal.timeout(5000),redirect:'manual'})
 if(!result.ok)deny()
 const text=await result.text();if(text.length>65536)deny();const keys=JSON.parse(text).keys as (JsonWebKey&{kid?:string;use?:string})[]
 const jwk=keys.find(k=>k.kid===header.kid&&k.kty==='RSA'&&(k.use===undefined||k.use==='sig')&&(k.alg===undefined||k.alg==='RS256'));if(!jwk)deny()
 const key=await crypto.subtle.importKey('jwk',jwk!,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify'])
 if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decoded(pieces[2]),new TextEncoder().encode(pieces[0]+'.'+pieces[1])))deny()
}
export function mediaDTO(r:Row):MediaAssetDTO{return {id:r.id,eventId:r.event_id,assetKey:r.asset_key,state:r.state,...(r.mime_type?{mimeType:r.mime_type,width:r.width,height:r.height,sizeBytes:r.size_bytes,sha256:r.sha256,displaySizeBytes:r.display_size_bytes}:{}),revision:r.revision}}
export async function handleMedia(ctx:MediaContext):Promise<{handled:boolean;data?:unknown}>{
 const {DB,path,method,authHash,now}=ctx,first=(sql:string,...args:any[])=>DB.prepare(sql).bind(...args).first<Row>()
 const backup=path.match(/^\/admin\/events\/([-\w]+)\/assets\/(backup-index|backup-file)$/)
 if(backup&&method==='GET'){
  await ctx.admin();await ctx.verifyNode();const eventId=backup[1],action=backup[2],params=new URL(ctx.req.url).searchParams,event=await first('SELECT revision,public_revision,status,updated_at FROM events WHERE id=?',eventId)
  if(!event)ctx.fail('NOT_FOUND','活动不存在',404)
  const expected=params.get('expectedRevision');if(expected!==null&&(!/^\d+$/.test(expected)||Number(expected)!==event!.revision))ctx.fail('VERSION_CONFLICT','活动在备份期间变化，请重新备份',409)
  if(action==='backup-index'){
   const rows=await DB.prepare("SELECT * FROM media_assets WHERE event_id=? AND state IN ('ready','revoked') AND source_path IS NOT NULL AND display_path IS NOT NULL ORDER BY revision,id LIMIT 51").bind(eventId).all<Row>()
   if(rows.results.length>50)ctx.fail('LIMIT_EXCEEDED','历史媒体超过50项备份上限',413)
   const refs=await DB.prepare("SELECT v.revision,json_extract(m.value,'$.assetKey') AS assetKey,json_extract(a.value,'$.sha256') AS sha256 FROM event_versions v JOIN json_each(v.event_json,'$.event.extensions.convention.maps') m LEFT JOIN json_each(v.event_json,'$.assetManifest') a ON json_extract(a.value,'$.assetKey')=json_extract(m.value,'$.assetKey') WHERE v.event_id=? ORDER BY v.revision LIMIT 10001").bind(eventId).all<Row>()
   if(refs.results.length>10000)ctx.fail('LIMIT_EXCEEDED','历史引用超过10000项备份上限',413)
   const assets=rows.results.map(r=>({...mediaDTO(r),sourceSha256:r.source_sha256||r.sha256,sourceSizeBytes:r.source_size_bytes||r.size_bytes,displaySha256:String(r.display_path).match(/display-([a-f0-9]{64})\.webp$/)?.[1],displayMimeType:r.display_mime_type,displayWidth:r.display_width,displayHeight:r.display_height}))
   return {handled:true,data:{format:'tongye.media-backup.v1',eventId,revision:event!.revision,publicRevision:event!.public_revision,status:event!.status,updatedAt:event!.updated_at,refs:refs.results,assets}}
  }
  const assetId=params.get('assetId'),kind=params.get('kind');if(!assetId||!/^[-\w]{1,100}$/.test(assetId)||!['source','display'].includes(kind||''))ctx.fail('INVALID_REQUEST','备份文件请求无效')
  const row=await first("SELECT * FROM media_assets WHERE id=? AND event_id=? AND state IN ('ready','revoked') AND source_path IS NOT NULL AND display_path IS NOT NULL",assetId,eventId);if(!row)ctx.fail('NOT_FOUND','已就绪历史资产不存在',404)
  const source=kind==='source',pathname=source?row!.source_path:row!.display_path,sha256=source?(row!.source_sha256||row!.sha256):String(pathname).match(/display-([a-f0-9]{64})\.webp$/)?.[1],sizeBytes=source?(row!.source_size_bytes||row!.size_bytes):row!.display_size_bytes,base=`assets/${eventId}/${assetId}/`
  if(!sha256||pathname!==(source?base+'source-'+sha256:base+'display-'+sha256+'.webp')||!Number.isInteger(sizeBytes)||sizeBytes<1||sizeBytes>(source?ACTIVITY_LIMITS.sourceBytes:3145728))ctx.fail('INVALID_MEDIA','历史媒体元数据无效')
  return {handled:true,data:{pathname,sizeBytes,sha256,mimeType:source?row!.mime_type:row!.display_mime_type}}
 }
 const maintenance=path.match(/^\/admin\/events\/([-\w]+)\/assets\/(usage|cleanup-plan|cleanup-commit)$/)
 if(maintenance){await ctx.admin();const eventId=maintenance[1],action=maintenance[2]
  if(action==='usage'&&method==='GET'){const usage=await first(`SELECT ${chargeSQL} AS charged FROM media_assets WHERE ${chargedWhere}`);return {handled:true,data:{budgetBytes:MEDIA_BUDGET_BYTES,chargedBytes:usage!.charged,remainingBytes:Math.max(0,MEDIA_BUDGET_BYTES-usage!.charged),basis:'conservative-application-budget'}}}
  if(method!=='POST')return {handled:false}
  await ctx.verifyNode();const cutoff=Date.now()-15*60*1000
  if(action==='cleanup-plan'){
   const rows=await DB.prepare(`SELECT id,event_id FROM media_assets WHERE event_id=? AND state IN ('pending','processing','failed') AND expires_at<? AND ${unreferencedSQL} ORDER BY expires_at,id LIMIT 5`).bind(eventId,cutoff).all<Row>(),candidates=[]
   for(const r of rows.results){const claimed=await DB.prepare(`UPDATE media_assets SET state='failed',updated_at=? WHERE id=? AND event_id=? AND state IN ('pending','processing','failed') AND expires_at<? AND ${unreferencedSQL} AND EXISTS(SELECT 1 FROM admin_sessions WHERE hash=? AND expires_at>?)`).bind(now,r.id,eventId,cutoff,authHash,Date.now()).run();if(claimed.meta.changes)candidates.push({id:r.id,eventId,prefix:`assets/${eventId}/${r.id}/`})}
   return {handled:true,data:{candidates}}
  }
  if(action==='cleanup-commit'){const b=await ctx.body();if(typeof b.assetId!=='string'||!/^[-\w]{1,100}$/.test(b.assetId))ctx.fail('INVALID_REQUEST','资产ID无效')
   const done=await DB.prepare(`UPDATE media_assets SET state='revoked',blob_path=NULL,updated_at=? WHERE id=? AND event_id=? AND state='failed' AND expires_at<? AND ${unreferencedSQL} AND EXISTS(SELECT 1 FROM admin_sessions WHERE hash=? AND expires_at>?)`).bind(now,b.assetId,eventId,cutoff,authHash,Date.now()).run()
   if(!done.meta.changes)ctx.fail('VERSION_CONFLICT','资产状态或引用已变化，未释放预算',409)
   return {handled:true,data:{cleaned:true}}
  }
 }
 const reserve=path.match(/^\/admin\/events\/([-\w]+)\/assets$/)
 if(reserve){await ctx.admin();const eventId=reserve[1],event=await first('SELECT * FROM events WHERE id=?',eventId);if(!event||event.visibility==='private')ctx.fail('NOT_FOUND','请先保存公共活动',404)
  if(method==='GET'){const rows=await DB.prepare(`SELECT * FROM media_assets WHERE event_id=? AND ${chargedWhere} ORDER BY created_at DESC,id LIMIT 50`).bind(eventId).all<Row>();return {handled:true,data:rows.results.map(mediaDTO)}}
  if(method!=='POST')return {handled:false}
  await ctx.limited('media-reserve:'+authHash,15)
  const b=await ctx.body(),ticketHash=await ctx.hash(ctx.token(b.uploadToken)),operation=ctx.op(b.operationId),digest=await ctx.hash(JSON.stringify(b))
  if(typeof b.assetKey!=='string'||!/^[-\w.]{1,100}$/.test(b.assetKey))ctx.fail('INVALID_REQUEST','assetKey须为简单文件标识')
  if(!Number.isInteger(b.sizeBytes)||b.sizeBytes<1||b.sizeBytes>ACTIVITY_LIMITS.sourceBytes)ctx.fail('LIMIT_EXCEEDED','地图源图上限12 MiB',413)
  if(!['image/png','image/jpeg','image/webp'].includes(b.mimeType))ctx.fail('INVALID_MEDIA','仅支持PNG/JPEG/WebP')
  const prior=await first('SELECT * FROM media_assets WHERE event_id=? AND operation_id=?',eventId,operation)
  const answer=(r:Row)=>({asset:mediaDTO(r),pathname:r.blob_path,expiresAt:r.expires_at})
  if(prior){if(prior.operation_digest!==digest||prior.ticket_hash!==ticketHash)ctx.fail('VERSION_CONFLICT','上传操作已被修改',409);return {handled:true,data:answer(prior)}}
  const total=await first(`SELECT count(*) AS n FROM media_assets WHERE event_id=? AND ${chargedWhere}`,eventId);if(total!.n>=50)ctx.fail('LIMIT_EXCEEDED','此活动媒体历史已满，请整理旧资产',409)
  // Current bindings and live upload keys share five map slots plus one replacement.
  // Historical unbound ready assets remain recoverable and charged globally, but do not occupy a live slot.
  const liveKeysSQL="SELECT json_extract(m.value,'$.assetKey') AS asset_key FROM events e,json_each(e.event_json,'$.event.extensions.convention.maps') m WHERE e.id=? UNION SELECT asset_key FROM media_assets WHERE event_id=? AND state IN ('pending','processing') AND expires_at>? UNION SELECT ? AS asset_key"
  const count=await first('SELECT count(*) AS n FROM ('+liveKeysSQL+')',eventId,eventId,Date.now(),b.assetKey)
  if(count!.n>ACTIVITY_LIMITS.maps+1)ctx.fail('LIMIT_EXCEEDED','每活动最多5张地图，一次替换一张',409)
  const charge=await first(`SELECT ${chargeSQL} AS charged FROM media_assets WHERE ${chargedWhere}`),reservation=b.sizeBytes+ACTIVITY_LIMITS.sourceBytes+3*1024*1024;if(charge!.charged+reservation>MEDIA_BUDGET_BYTES)ctx.fail('LIMIT_EXCEEDED','媒体应用预算不足，请清理失败和过期上传后重试',413)
  const revision=(await first('SELECT COALESCE(MAX(revision),0)+1 AS n FROM media_assets WHERE event_id=? AND asset_key=?',eventId,b.assetKey))!.n,id=crypto.randomUUID(),pathname=`assets/${eventId}/${id}/pending`,expires=Date.now()+15*60*1000
  const inserted=await DB.prepare(`INSERT INTO media_assets(id,event_id,asset_key,expected_event_revision,ticket_hash,expires_at,operation_id,operation_digest,blob_path,declared_size_bytes,declared_mime_type,revision,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM events WHERE id=? AND revision=?) AND EXISTS(SELECT 1 FROM admin_sessions WHERE hash=? AND expires_at>?) AND NOT EXISTS(SELECT 1 FROM media_assets WHERE event_id=? AND operation_id=?) AND (SELECT count(*) FROM media_assets WHERE event_id=? AND ${chargedWhere})<50 AND (SELECT count(*) FROM media_assets WHERE event_id=? AND state IN ('pending','processing') AND expires_at>?)<6 AND (SELECT count(*) FROM (${liveKeysSQL}))<=? AND (SELECT ${chargeSQL} FROM media_assets WHERE ${chargedWhere})+?<=? ON CONFLICT(id) DO NOTHING`).bind(id,eventId,b.assetKey,event!.revision,ticketHash,expires,operation,digest,pathname,b.sizeBytes,b.mimeType,revision,now,now,eventId,event!.revision,authHash,Date.now(),eventId,operation,eventId,eventId,Date.now(),eventId,eventId,Date.now(),b.assetKey,ACTIVITY_LIMITS.maps+1,reservation,MEDIA_BUDGET_BYTES).run()
  if(!inserted.meta.changes)ctx.fail('VERSION_CONFLICT','上传资料或活动版本已变化',409)
  return {handled:true,data:answer((await first('SELECT * FROM media_assets WHERE id=?',id))!)}
 }
 const match=path.match(/^\/events\/([-\w]+)\/assets(?:\/([-\w]+)\/(ticket|activate|read-ticket|process|fail))?$/);if(!match)return {handled:false}
 const eventId=match[1],id=match[2],action=match[3]
 // One public snapshot per invocation; history filtering must stay below D1's query budget.
 let publicPackage:Promise<Row|null>|undefined
 const loadPublicPackage=()=>publicPackage??=first("SELECT v.event_json FROM events e JOIN event_versions v ON v.event_id=e.id AND v.revision=e.public_revision WHERE e.id=? AND e.visibility='public' AND v.status IN ('published','archived') AND e.status!='cancelled'",eventId).then(row=>row?JSON.parse(row.event_json):null)
 const visible=async(r:Row,latestReady?:Map<string,Row>)=>{const p=await loadPublicPackage();if(!p)return false;const map=p.event.extensions?.convention.maps.find((m:Row)=>m.assetKey===r.asset_key&&m.width===r.width&&m.height===r.height),manifest=p.assetManifest?.find((m:Row)=>m.assetKey===r.asset_key);if(!map)return false;if(manifest)return manifest.sha256===r.sha256&&manifest.sizeBytes===r.size_bytes&&(!manifest.mimeType||manifest.mimeType===r.mime_type);if(latestReady)return latestReady.get(r.asset_key)?.id===r.id;const latest=await first("SELECT id FROM media_assets WHERE event_id=? AND asset_key=? AND state='ready' ORDER BY revision DESC LIMIT 1",eventId,r.asset_key);return latest?.id===r.id}
 if(!id&&method==='GET'){const rows=(await DB.prepare("SELECT * FROM media_assets WHERE event_id=? AND state='ready' ORDER BY created_at,id LIMIT 50").bind(eventId).all<Row>()).results,result=[],latestReady=new Map<string,Row>();for(const r of rows){const latest=latestReady.get(r.asset_key);if(!latest||r.revision>latest.revision)latestReady.set(r.asset_key,r)}for(const r of rows)if(await visible(r,latestReady))result.push(mediaDTO(r));return {handled:true,data:result}}
 const r=await first('SELECT * FROM media_assets WHERE id=? AND event_id=?',id,eventId);if(!r)ctx.fail('NOT_FOUND','地图不存在',404)
 if(action==='read-ticket'&&method==='GET'){
  await ctx.verifyNode();if(r!.state!=='ready')ctx.fail('NOT_FOUND','地图已失效',404)
  const event=await first('SELECT status FROM events WHERE id=?',eventId);if(event?.status==='cancelled')ctx.fail('NOT_FOUND','活动已取消',404)
  if(!await visible(r!))await ctx.admin()
  return {handled:true,data:{displayPath:r!.display_path,displaySizeBytes:r!.display_size_bytes,displayMimeType:r!.display_mime_type}}
 }
 if(['ticket','activate','process','fail'].includes(action)&&method==='POST'){
  if(r!.ticket_hash!==authHash||(r!.expires_at<=Date.now()&&!(['activate','ticket'].includes(action)&&r!.state==='ready'))||!['pending','processing','ready'].includes(r!.state))ctx.fail('INVALID_CAPABILITY','上传凭据失效或不属于此地图',401)
  if(action==='ticket'){if(r!.state==='ready'){await ctx.verifyNode();return {handled:true,data:{asset:mediaDTO(r!)}}}return {handled:true,data:{asset:mediaDTO(r!),pathname:r!.blob_path,expiresAt:r!.expires_at,mimeType:r!.declared_mime_type,sizeBytes:r!.declared_size_bytes}}}
  await ctx.verifyNode();if(r!.state==='ready')return {handled:true,data:mediaDTO(r!)}
  if(action==='process'||action==='fail'){
   const state=action==='process'?'processing':'failed'
   const result=await DB.prepare("UPDATE media_assets SET state=?,updated_at=? WHERE id=? AND event_id=? AND ticket_hash=? AND state IN ('pending','processing') AND expires_at>? AND EXISTS(SELECT 1 FROM events WHERE id=? AND revision=media_assets.expected_event_revision AND status!='cancelled')").bind(state,now,id,eventId,authHash,Date.now(),eventId).run()
   if(!result.meta.changes)ctx.fail('VERSION_CONFLICT','活动版本已变化，请重新上传',409)
   return {handled:true,data:mediaDTO((await first('SELECT * FROM media_assets WHERE id=?',id))!)}
  }
  const b=await ctx.body(),base=`assets/${eventId}/${id}`
  if(typeof b.sha256!=='string'||!/^[a-f0-9]{64}$/.test(b.sha256)||b.sourcePath!==base+'/source-'+b.sha256||typeof b.displayPath!=='string'||!new RegExp('^'+base+'/display-[a-f0-9]{64}\\.webp$').test(b.displayPath))ctx.fail('INVALID_MEDIA','资产路径或哈希无效')
  if(!['image/png','image/jpeg','image/webp'].includes(b.mimeType)||b.displayMimeType!=='image/webp'||!['width','height','displayWidth','displayHeight','sizeBytes','displaySizeBytes'].every(k=>Number.isInteger(b[k])&&b[k]>0)||b.width*b.height>ACTIVITY_LIMITS.pixels||b.displayWidth>2048||b.displayHeight>2048||b.sizeBytes>ACTIVITY_LIMITS.sourceBytes||b.displaySizeBytes>3*1024*1024)ctx.fail('INVALID_MEDIA','地图净化元数据无效')
  const changed=await DB.prepare("UPDATE media_assets SET state='ready',mime_type=?,width=?,height=?,size_bytes=?,sha256=?,display_size_bytes=?,source_path=?,display_path=?,display_mime_type=?,display_width=?,display_height=?,source_size_bytes=?,source_sha256=?,updated_at=? WHERE id=? AND event_id=? AND ticket_hash=? AND state IN ('pending','processing') AND expires_at>? AND EXISTS(SELECT 1 FROM events WHERE id=? AND revision=media_assets.expected_event_revision AND status!='cancelled')").bind(b.mimeType,b.width,b.height,b.sizeBytes,b.sha256,b.displaySizeBytes,b.sourcePath,b.displayPath,b.displayMimeType,b.displayWidth,b.displayHeight,b.sizeBytes,b.sha256,now,id,eventId,authHash,Date.now(),eventId).run()
  if(!changed.meta.changes)ctx.fail('VERSION_CONFLICT','活动版本已变化，旧地图仍保留，请重新上传',409)
  return {handled:true,data:mediaDTO((await first('SELECT * FROM media_assets WHERE id=?',id))!)}
 }
 return {handled:false}
}
