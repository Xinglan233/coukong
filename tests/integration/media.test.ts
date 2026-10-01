import { describe,it,expect,beforeAll,afterAll } from 'vitest'
import { Miniflare,convertV4MiniflareOptions } from 'miniflare'
import { build } from 'esbuild'
import { readFileSync,readdirSync } from 'node:fs'
import { randomBytes,randomUUID,createHash } from 'node:crypto'
let mf:Miniflare
const auth=randomBytes(32).toString('hex'),token=()=>randomBytes(32).toString('hex'),hash=(s:string)=>createHash('sha256').update(s).digest('hex')
const pkg=JSON.parse(readFileSync('examples/event-minimal.json','utf8')),eventId=pkg.event.id
async function api(path:string,method='GET',bearer='',body?:unknown,trusted=false){const response=await mf.dispatchFetch('http://localhost'+path,{method,headers:{Authorization:'Bearer '+bearer,...(trusted?{'X-Test-Trusted-Node':'yes'}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,...await response.json() as any}}
beforeAll(async()=>{
 // This isolated SQL harness supplies a trusted Node authority. The real JWT signature and
 // issuer/project/environment boundary are tested independently with actual RSA signatures.
 const code=`import {handleMedia} from './worker/src/media'; export default {async fetch(req,env){const hash=async(s)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');const authHash=await hash(req.headers.get('Authorization').replace(/^Bearer /,''));const fail=(code,message,status=400)=>{throw Object.assign(new Error(message),{code,status})};try{const out=await handleMedia({req,DB:env.DB,path:new URL(req.url).pathname,method:req.method,authHash,now:new Date().toISOString(),body:()=>req.json(),hash,token:s=>{if(!/^[a-f0-9]{64}$/.test(s))fail('INVALID_CAPABILITY','token',401);return s},op:s=>s,admin:async()=>{if(!await env.DB.prepare('SELECT hash FROM admin_sessions WHERE hash=? AND expires_at>?').bind(authHash,Date.now()).first())fail('INVALID_CAPABILITY','admin',401)},limited:async()=>{},verifyNode:async()=>{if(req.headers.get('X-Test-Trusted-Node')!=='yes')fail('FORBIDDEN','node',403)},fail});return Response.json(out.handled?{data:out.data}:{error:{code:'NOT_FOUND'}},{status:out.handled?200:404})}catch(e){return Response.json({error:{code:e.code,message:e.message}},{status:e.status||503})}}}`
 const built=await build({stdin:{contents:code,resolveDir:process.cwd(),sourcefile:'media-test-worker.ts'},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'})
 mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:built.outputFiles[0].text,compatibilityDate:'2026-09-01',d1Databases:['DB']}))
 const db=await mf.getD1Database('DB');for(const file of readdirSync('worker/migrations').filter(x=>x.endsWith('.sql')).sort())await db.exec(readFileSync('worker/migrations/'+file,'utf8').replace(/\n/g,' '))
 await db.prepare('INSERT INTO admin_sessions VALUES(?,?)').bind(hash(auth),Date.now()+3600000).run()
 await db.prepare("INSERT INTO events(id,revision,schedule_revision,spatial_revision,status,event_json,public_revision,last_op,last_digest,created_at,updated_at) VALUES(?,1,0,0,'draft',?,NULL,'seed','seed',?,?)").bind(eventId,JSON.stringify(pkg),new Date().toISOString(),new Date().toISOString()).run()
},30000)
afterAll(async()=>{await mf?.dispose()})
const reserve=(uploadToken:string,assetKey='map-'+randomUUID())=>({uploadToken,assetKey,operationId:randomUUID(),sizeBytes:100,mimeType:'image/png'})
const metadata=(assetId:string)=>({sourcePath:`assets/${eventId}/${assetId}/source-${'a'.repeat(64)}`,displayPath:`assets/${eventId}/${assetId}/display-${'b'.repeat(64)}.webp`,mimeType:'image/png',width:64,height:32,sizeBytes:200,sha256:'a'.repeat(64),displaySizeBytes:100,displayMimeType:'image/webp',displayWidth:64,displayHeight:32})
describe.sequential('地图资产真实D1权限与CAS',()=>{
 it('仅admin预留、有界声明、ticket哈希存储、幂等及跨asset拒绝',async()=>{
  const t=token(),body=reserve(t),path=`/admin/events/${eventId}/assets`
  expect((await api(path,'POST',token(),body)).status).toBe(401)
  expect((await api(path,'POST',auth,{...body,sizeBytes:12*1024*1024+1})).status).toBe(413)
  expect((await api(path,'POST',auth,{...body,mimeType:'image/svg+xml'})).status).toBe(400)
  const saved=await api(path,'POST',auth,body);expect(saved.status).toBe(200)
  expect((await api(path,'POST',auth,body)).data.asset.id).toBe(saved.data.asset.id)
  expect((await api(path,'POST',auth,{...body,sizeBytes:99})).status).toBe(409)
  const id=saved.data.asset.id,read=await api(`/events/${eventId}/assets/${id}/ticket`,'POST',t,{})
  expect(read.status).toBe(200);expect(read.data.sizeBytes).toBe(100)
  expect((await api(`/events/${eventId}/assets/${id}/ticket`,'POST',token(),{})).status).toBe(401)
  expect((await api(`/events/other/assets/${id}/ticket`,'POST',t,{})).status).toBe(404)
  expect((await api(`/events/${eventId}/assets/${id}/activate`,'POST',t,metadata(id))).status).toBe(403)
  const db=await mf.getD1Database('DB'),row=await db.prepare('SELECT * FROM media_assets WHERE id=?').bind(id).first<any>();expect(row.ticket_hash).toBe(hash(t));expect(JSON.stringify(row)).not.toContain(t)
  await db.prepare('UPDATE media_assets SET expires_at=? WHERE id=?').bind(Date.now()-1,id).run()
  expect((await api(`/events/${eventId}/assets/${id}/ticket`,'POST',t,{})).status).toBe(401)
 })
 it('只可信Node可激活、路径不可跨资产；失败CAS不损坏旧ready资产',async()=>{
  const t=token(),saved=await api(`/admin/events/${eventId}/assets`,'POST',auth,reserve(t)),id=saved.data.asset.id,path=`/events/${eventId}/assets/${id}/activate`
  expect((await api(path,'POST',t,{...metadata(id),sourcePath:'https://internal.invalid'},true)).status).toBe(400)
  expect((await api(path,'POST',t,metadata(id),true)).status).toBe(200)
  const nextToken=token(),next=await api(`/admin/events/${eventId}/assets`,'POST',auth,reserve(nextToken)),nextId=next.data.asset.id
  const db=await mf.getD1Database('DB');await db.prepare('UPDATE events SET revision=revision+1 WHERE id=?').bind(eventId).run()
  expect((await api(`/events/${eventId}/assets/${nextId}/activate`,'POST',nextToken,metadata(nextId),true)).status).toBe(409)
  expect((await db.prepare('SELECT state FROM media_assets WHERE id=?').bind(id).first<any>()).state).toBe('ready')
  expect((await db.prepare('SELECT state FROM media_assets WHERE id=?').bind(nextId).first<any>()).state).toBe('pending')
  const readPath=`/events/${eventId}/assets/${id}/read-ticket`
  expect((await api(readPath,'GET','',undefined,true)).status).toBe(401)
  expect((await api(readPath,'GET',auth,undefined,true)).status).toBe(200)
  expect((await api(readPath,'GET',auth)).status).toBe(403)
  const list=await api(`/admin/events/${eventId}/assets`,'GET',auth);expect(JSON.stringify(list.data)).not.toMatch(/source_path|display_path|ticket_hash|blob_path|assets\//)
 })
 it('处理中和失败独立状态；失败凭据不可再激活',async()=>{
  const t=token(),saved=await api(`/admin/events/${eventId}/assets`,'POST',auth,reserve(t)),id=saved.data.asset.id,path=`/events/${eventId}/assets/${id}`
  expect((await api(path+'/process','POST',t,{},true)).data.state).toBe('processing')
  expect((await api(path+'/fail','POST',t,{},true)).data.state).toBe('failed')
  expect((await api(path+'/activate','POST',t,metadata(id),true)).status).toBe(401)
 })
 it('过期仍占预算；cleanup限5、保护所有引用版本/ready与跨活动、不可信commit拒绝',async()=>{
  const db=await mf.getD1Database('DB'),expiry=Date.now()-31*60*1000,path=`/admin/events/${eventId}/assets`,ids:string[]=[]
  for(let i=0;i<7;i++){const body=reserve(token()),r=await api(path,'POST',auth,body);ids.push(r.data.asset.id);await db.prepare('UPDATE media_assets SET expires_at=? WHERE id=?').bind(expiry,r.data.asset.id).run()}
  const before=(await api(path+'/usage','GET',auth)).data;expect(before.chargedBytes).toBeGreaterThan(100*7)
  const protectedRow=(await db.prepare('SELECT * FROM media_assets WHERE id=?').bind(ids[0]).first<any>())!,history=structuredClone(pkg);history.event.extensions={convention:{maps:[{assetKey:protectedRow.asset_key}],pois:[],routingGraphs:[]}}
  await db.prepare("INSERT INTO event_versions VALUES(?,99,0,0,'draft',?,?)").bind(eventId,JSON.stringify(history),new Date().toISOString()).run()
  expect((await api(path+'/cleanup-plan','POST',auth,{})).status).toBe(403)
  const plan=(await api(path+'/cleanup-plan','POST',auth,{},true)).data.candidates;expect(plan).toHaveLength(5);expect(plan.map((x:any)=>x.id)).not.toContain(ids[0])
  const ready=(await db.prepare("SELECT id FROM media_assets WHERE state='ready' LIMIT 1").first<any>())!.id
  expect((await api(path+'/cleanup-commit','POST',auth,{assetId:ready},true)).status).toBe(409)
  expect((await api(path+'/cleanup-commit','POST',auth,{assetId:ids[0]},true)).status).toBe(409)
  const eligible=plan[0].id;expect((await api('/admin/events/other/assets/cleanup-commit','POST',auth,{assetId:eligible},true)).status).toBe(409)
  expect((await api(path+'/cleanup-commit','POST',auth,{assetId:eligible})).status).toBe(403)
  expect((await api(path+'/cleanup-commit','POST',auth,{assetId:eligible},true)).status).toBe(200)
  const after=(await api(path+'/usage','GET',auth)).data;expect(after.chargedBytes).toBeLessThan(before.chargedBytes)
  // Fill the budget with conservative failed charges, never auto-grant a new upload.
  await db.prepare("UPDATE media_assets SET declared_size_bytes=12582912 WHERE state='failed'").run()
  for(let i=0;i<20;i++){const r=await api(path,'POST',auth,{...reserve(token()),sizeBytes:12582912});if(r.status!==200){expect(r.status).toBe(413);break}await db.prepare("UPDATE media_assets SET state='failed',expires_at=? WHERE id=?").bind(expiry,r.data.asset.id).run()}
  expect((await api(path,'POST',auth,{...reserve(token()),sizeBytes:12582912})).status).toBe(413)
 })
 it('备份需要admin与Node双证明、仅活动内ready历史资产，不泄露ticket或内部路径到index',async()=>{
  const db=await mf.getD1Database('DB'),r=(await db.prepare("SELECT * FROM media_assets WHERE state='ready' LIMIT 1").first<any>())!,path=`/admin/events/${eventId}/assets`
  expect((await api(path+'/backup-index','GET',auth)).status).toBe(403)
  expect((await api(path+'/backup-index','GET',token(),undefined,true)).status).toBe(401)
  const index=await api(path+'/backup-index','GET',auth,undefined,true);expect(index.status).toBe(200);expect(index.data.assets).toHaveLength(1);expect(JSON.stringify(index.data)).not.toMatch(/ticket_hash|blob_path|source_path|display_path|assets\//)
  expect((await api(path+'/backup-index?expectedRevision=999','GET',auth,undefined,true)).status).toBe(409)
  const file=await api(path+`/backup-file?assetId=${r.id}&kind=source`,'GET',auth,undefined,true);expect(file.status).toBe(200);expect(file.data.pathname).toBe(r.source_path)
  expect((await api(`/admin/events/other/assets/backup-file?assetId=${r.id}&kind=source`,'GET',auth,undefined,true)).status).toBe(404)
  const pending=(await db.prepare("SELECT id FROM media_assets WHERE state='failed' LIMIT 1").first<any>())!.id
  expect((await api(path+`/backup-file?assetId=${pending}&kind=source`,'GET',auth,undefined,true)).status).toBe(404)
 })
 it('已发布并引用资产可公开读取；取消与撤销拒绝读取',async()=>{
  const db=await mf.getD1Database('DB'),r=(await db.prepare("SELECT * FROM media_assets WHERE state='ready' LIMIT 1").first<any>())!,p=structuredClone(pkg)
  p.event.extensions={convention:{maps:[{id:'map',assetKey:r.asset_key,width:64,height:32}],pois:[],routingGraphs:[]}};p.assetManifest=[{assetKey:r.asset_key,sha256:r.sha256,sizeBytes:r.size_bytes}]
  await db.prepare("UPDATE events SET status='published',public_revision=revision WHERE id=?").bind(eventId).run()
  await db.prepare("INSERT INTO event_versions SELECT id,revision,schedule_revision,spatial_revision,status,?,updated_at FROM events WHERE id=?").bind(JSON.stringify(p),eventId).run()
  const path=`/events/${eventId}/assets/${r.id}/read-ticket`
  expect((await api(path,'GET','',undefined,true)).status).toBe(200)
  expect((await api(`/events/${eventId}/assets`)).data).toHaveLength(1)
  await db.prepare("UPDATE events SET status='cancelled' WHERE id=?").bind(eventId).run()
  expect((await api(path,'GET',auth,undefined,true)).status).toBe(404)
  await db.prepare("UPDATE events SET status='published' WHERE id=?").bind(eventId).run();await db.prepare("UPDATE media_assets SET state='revoked' WHERE id=?").bind(r.id).run()
  expect((await api(path,'GET',auth,undefined,true)).status).toBe(404)
 })
})
