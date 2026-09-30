/** Administrator-only backup. Access grants and capabilities are read from private files. */
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync,readFileSync,writeFileSync,openSync,writeSync,closeSync,statSync,realpathSync } from 'node:fs'
import { resolve,relative,isAbsolute,join,dirname,basename } from 'node:path'
import { pathToFileURL } from 'node:url'
export interface BackupIndex {format:string;eventId:string;revision:number;publicRevision:number|null;refs:{revision:number;assetKey:string;sha256:string|null}[];assets:{id:string;assetKey:string;sourceSizeBytes:number;sourceSha256:string;mimeType:string;displaySizeBytes:number;displaySha256:string}[]}
export interface BackupResponse {status:number;headers:Record<string,string>;bytes:Buffer}
export type BackupRequest=(parameters:Record<string,string>)=>Promise<BackupResponse>
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex'),max=1024*1024
const keyPattern=/^[-\w]{1,100}$/,hashPattern=/^[a-f0-9]{64}$/
export function validateIndex(index:BackupIndex,eventId:string){if(index.format!=='tongye.media-backup.v1'||index.eventId!==eventId||!Number.isInteger(index.revision)||!Array.isArray(index.assets)||index.assets.length>50||!Array.isArray(index.refs)||index.refs.length>10000)throw new Error('备份索引无效');const ids=new Set<string>();for(const a of index.assets){if(!keyPattern.test(a.id)||ids.has(a.id)||!['image/png','image/jpeg','image/webp'].includes(a.mimeType)||!hashPattern.test(a.sourceSha256)||!hashPattern.test(a.displaySha256)||!Number.isInteger(a.sourceSizeBytes)||a.sourceSizeBytes<1||a.sourceSizeBytes>12*max||!Number.isInteger(a.displaySizeBytes)||a.displaySizeBytes<1||a.displaySizeBytes>3*max)throw new Error('备份资产元数据无效');ids.add(a.id)}for(const ref of index.refs)if(!index.assets.some(a=>a.assetKey===ref.assetKey&&(!ref.sha256||a.sourceSha256===ref.sha256)))throw new Error('历史引用缺少媒体，不可标为完整备份')}
export function verifyDatabase(sql:Buffer,index:BackupIndex){
 if(sql.length>128*max)throw new Error('数据库备份超过128 MiB本机校验限制')
 const db=new DatabaseSync(':memory:')
 try{db.exec('BEGIN');db.exec(sql.toString('utf8'));db.exec('COMMIT');if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('数据库外键不完整');const event=db.prepare('SELECT revision,public_revision FROM events WHERE id=?').get(index.eventId);if(!event||event.revision!==index.revision||event.public_revision!==index.publicRevision)throw new Error('数据库和媒体索引版本不一致')
  const refs=db.prepare("SELECT v.revision,json_extract(m.value,'$.assetKey') AS assetKey,json_extract(a.value,'$.sha256') AS sha256 FROM event_versions v JOIN json_each(v.event_json,'$.event.extensions.convention.maps') m LEFT JOIN json_each(v.event_json,'$.assetManifest') a ON json_extract(a.value,'$.assetKey')=json_extract(m.value,'$.assetKey') WHERE v.event_id=? ORDER BY v.revision").all(index.eventId)
  if(JSON.stringify(refs)!==JSON.stringify(index.refs))throw new Error('数据库历史引用和媒体索引不一致')
  const rows=db.prepare("SELECT id,asset_key,source_sha256,sha256,source_size_bytes,size_bytes,source_path,display_path,display_size_bytes FROM media_assets WHERE event_id=? AND state IN ('ready','revoked') AND source_path IS NOT NULL AND display_path IS NOT NULL ORDER BY revision,id").all(index.eventId)
  if(rows.length!==index.assets.length)throw new Error('数据库历史媒体数量不一致')
  for(const a of index.assets){const row=rows.find(r=>r.id===a.id);if(!row||row.asset_key!==a.assetKey||(row.source_sha256||row.sha256)!==a.sourceSha256||(row.source_size_bytes||row.size_bytes)!==a.sourceSizeBytes||row.display_size_bytes!==a.displaySizeBytes||row.source_path!==`assets/${index.eventId}/${a.id}/source-${a.sourceSha256}`||row.display_path!==`assets/${index.eventId}/${a.id}/display-${a.displaySha256}.webp`)throw new Error('数据库和媒体文件元数据不一致')}
 }catch{throw new Error('私密SQL与媒体索引校验失败，未形成完整备份')}finally{db.close()}
}
export async function backupEvent(options:{eventId:string;output:string;database:Buffer;request:BackupRequest}){
 const {eventId,request,database}=options;if(!keyPattern.test(eventId))throw new Error('活动ID无效')
 const response=await request({eventId,mode:'index'});if(response.status!==200||response.bytes.length>max)throw new Error('管理员媒体索引读取失败')
 const index=JSON.parse(response.bytes.toString('utf8')).data as BackupIndex;validateIndex(index,eventId);verifyDatabase(database,index)
 const output=join(realpathSync(dirname(resolve(options.output))),basename(resolve(options.output))),repo=realpathSync(process.cwd()),difference=relative(repo,output);if(!difference.startsWith('..')&&!isAbsolute(difference))throw new Error('备份目录必须位于仓库之外')
 mkdirSync(output,{mode:0o700});writeFileSync(join(output,'database.sql'),database,{mode:0o600,flag:'wx'})
 const files:{assetId:string;kind:string;file:string;sizeBytes:number;sha256:string;rangeReads:number;fullReads:number}[]=[]
 for(const asset of index.assets)for(const kind of ['source','display'] as const){const sizeBytes=kind==='source'?asset.sourceSizeBytes:asset.displaySizeBytes,expectedHash=kind==='source'?asset.sourceSha256:asset.displaySha256,name=asset.id+'.'+kind+'.'+(kind==='display'?'webp':({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[asset.mimeType])),fd=openSync(join(output,name),'wx',0o600),digest=createHash('sha256');let offset=0,rangeReads=0,fullReads=0
  try{while(offset<sizeBytes){const part=await request({eventId,mode:'file',assetId:asset.id,kind,offset:String(offset),expectedRevision:String(index.revision)}),h=part.headers,expectedLength=Math.min(max,sizeBytes-offset);if(part.status!==200||part.bytes.length!==expectedLength||part.bytes.length>max||h['x-backup-sha256']!==expectedHash||Number(h['x-backup-offset'])!==offset||Number(h['x-backup-total-bytes'])!==sizeBytes||sha(part.bytes)!==h['x-backup-chunk-sha256'])throw new Error('备份分块或哈希校验失败');writeSync(fd,part.bytes);digest.update(part.bytes);offset+=part.bytes.length;if(h['x-backup-read-mode']==='range')rangeReads++;else fullReads++}
   if(digest.digest('hex')!==expectedHash)throw new Error('备份完整文件哈希不符')
  }finally{closeSync(fd)}
  files.push({assetId:asset.id,kind,file:name,sizeBytes,sha256:expectedHash,rangeReads,fullReads})
 }
 const after=await request({eventId,mode:'index',expectedRevision:String(index.revision)});if(after.status!==200||JSON.stringify(JSON.parse(after.bytes.toString('utf8')).data)!==JSON.stringify(index))throw new Error('备份期间活动或媒体索引发生变化')
 const manifest={...index,database:{file:'database.sql',sizeBytes:database.length,sha256:sha(database)},files,completedAt:new Date().toISOString()}
 writeFileSync(join(output,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600,flag:'wx'});writeFileSync(join(output,'COMPLETE'),'Hashes, SQL metadata and all historical references verified.\n',{mode:0o600,flag:'wx'})
 return {assets:files.length/2,files:files.length,verifiedReferences:index.refs.length,databaseSha256:manifest.database.sha256}
}
function privateFile(file:string){const resolved=resolve(file);if((statSync(resolved).mode&0o077)!==0)throw new Error('凭据和SQL文件须只有持有人可读（600权限）');return readFileSync(resolved)}
async function main(){const args=process.argv.slice(2),value=(name:string)=>{const i=args.indexOf(name);if(i<0||!args[i+1])throw new Error('缺少备份参数');return args[i+1]},access=JSON.parse(privateFile(value('--access-file')).toString('utf8')),session=privateFile(value('--session-file')).toString('utf8').trim(),grant=new URL(access.url)
 if(grant.protocol!=='https:'||!grant.hostname.endsWith('.vercel.app')||grant.username||grant.password||!/^[a-f0-9]{64}$/.test(session))throw new Error('私密预览授权或管理员会话无效')
 const {request}=await import('@playwright/test'),context=await request.newContext({baseURL:grant.origin})
 try{const bootstrap=await context.get(grant.toString());if(bootstrap.status()!==200)throw new Error('临时预览授权不可用')
  const fetchPart:BackupRequest=async(parameters)=>{const result=await context.get('/api/media/backup?'+new URLSearchParams(parameters),{headers:{Authorization:'Bearer '+session},timeout:60000});return {status:result.status(),headers:result.headers(),bytes:await result.body()}}
  const result=await backupEvent({eventId:value('--event'),output:value('--out'),database:privateFile(value('--db-file')),request:fetchPart});console.log(JSON.stringify({complete:true,...result}))
 }finally{await context.dispose()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(()=>{console.error('媒体备份失败；请检查私密授权、数据库版本和分块校验。未生成COMPLETE的目录不能视为完整备份。');process.exitCode=1})
