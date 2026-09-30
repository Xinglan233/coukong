import sharp from 'sharp'
import { getVercelOidcToken } from '@vercel/oidc'
import { createHash } from 'node:crypto'
import type { IncomingMessage,ServerResponse } from 'node:http'
import { get,put,del,list } from '@vercel/blob'
import { ACTIVITY_LIMITS } from '../../shared/activity-contract.js'
export class MediaError extends Error { constructor(message:string,public status=400,public code='INVALID_MEDIA'){super(message)} }
export const DISPLAY_LIMIT=3*1024*1024
export async function boundedBytes(stream:ReadableStream<Uint8Array>,max:number):Promise<Buffer>{const reader=stream.getReader(),parts:Uint8Array[]=[];let size=0;try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new MediaError('文件过大',413)}parts.push(value)}return Buffer.concat(parts)}finally{reader.releaseLock()}}
function animatedPNG(bytes:Buffer){if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')return false;let at=8;while(at+12<=bytes.length){const size=bytes.readUInt32BE(at);if(at+size+12>bytes.length)throw new MediaError('PNG结构无效');if(bytes.toString('ascii',at+4,at+8)==='acTL')return true;at+=size+12}return false}
const sha=(data:Buffer)=>createHash('sha256').update(data).digest('hex')
export async function sanitizeImage(bytes:Buffer,declaredMime:string){
 if(!bytes.length||bytes.length>ACTIVITY_LIMITS.sourceBytes)throw new MediaError('源图须小于等于12 MiB',413)
 if(animatedPNG(bytes))throw new MediaError('不支持动画地图')
 const sourceImage=sharp(bytes,{limitInputPixels:ACTIVITY_LIMITS.pixels,failOn:'warning',animated:true}),meta=await sourceImage.metadata()
 const mime=({png:'image/png',jpeg:'image/jpeg',webp:'image/webp'} as Record<string,string>)[meta.format||'']
 if(!mime||mime!==declaredMime)throw new MediaError('文件真实类型与声明类型不符')
 if((meta.pages??1)>1)throw new MediaError('不支持动画地图')
 if(!meta.width||!meta.height||meta.width*meta.height>ACTIVITY_LIMITS.pixels)throw new MediaError('图像超过24百万像素')
 // Re-encoding removes EXIF/XMP/ICC and applies EXIF orientation before establishing coordinates.
 const sourcePipeline=sharp(bytes,{limitInputPixels:ACTIVITY_LIMITS.pixels,failOn:'warning'}).autoOrient()
 const source=await (meta.format==='jpeg'?sourcePipeline.jpeg({quality:100,chromaSubsampling:'4:4:4'}):meta.format==='webp'?sourcePipeline.webp({lossless:true}):sourcePipeline.png()).toBuffer()
 if(source.length>ACTIVITY_LIMITS.sourceBytes)throw new MediaError('净化后的源图超过12 MiB，请先缩小图片',413)
 const original=await sharp(source).metadata(),width=original.width!,height=original.height!
 const resized=sharp(source).resize({width:2048,height:2048,fit:'inside',withoutEnlargement:true})
 let display=await resized.clone().webp({lossless:true}).toBuffer(),displayEncoding='lossless'
 if(display.length>DISPLAY_LIMIT){display=await resized.clone().webp({quality:90,effort:4,smartSubsample:true}).toBuffer();displayEncoding='quality-90'}
 if(display.length>DISPLAY_LIMIT)throw new MediaError('显示图超过3 MiB，无法保证可读性，请提供较小的地图',413)
 const dm=await sharp(display).metadata()
 return {source,display,width,height,mimeType:mime,sourceSha256:sha(source),displayWidth:dm.width!,displayHeight:dm.height!,displayEncoding}
}
export async function config(){const api=process.env.ACTIVITY_API_URL,storeId=process.env.BLOB_STORE_ID,oidcToken=await getVercelOidcToken();if(!api||!storeId||!oidcToken)throw new MediaError('媒体服务尚未配置',503,'SERVICE_UNAVAILABLE');const parsed=new URL(api);if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw new MediaError('媒体服务配置无效',503);return {api:api.replace(/\/$/,''),storeId,oidcToken}}
export async function worker<T>(path:string,auth='',body?:unknown):Promise<T>{const c=await config(),response=await fetch(c.api+'/api/v1'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+auth,'X-Vercel-OIDC-Token':c.oidcToken,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000),cache:'no-store'});const data=await response.json() as {data:T;error?:{message:string;code:string}};if(!response.ok)throw new MediaError(data.error?.message||'地图请求失败',response.status,data.error?.code);return data.data}
export interface Ticket {asset:{id:string;eventId:string;assetKey:string;state:string};pathname:string;expiresAt:number;mimeType:string;sizeBytes:number}
export function scope(data:unknown){const b=data as Record<string,unknown>;if(!b||typeof b.eventId!=='string'||!/^[-\w]{1,100}$/.test(b.eventId)||typeof b.assetId!=='string'||!/^[-\w]{1,100}$/.test(b.assetId)||typeof b.uploadToken!=='string'||!/^[a-f0-9]{64}$/.test(b.uploadToken))throw new MediaError('上传凭据无效',401,'INVALID_CAPABILITY');return {eventId:b.eventId,assetId:b.assetId,uploadToken:b.uploadToken}}
export function assetPath(eventId:string,assetId:string){return `/events/${encodeURIComponent(eventId)}/assets/${encodeURIComponent(assetId)}`}
export async function finishImage(data:unknown){const s=scope(data),path=assetPath(s.eventId,s.assetId),ticket=await worker<Ticket>(path+'/ticket',s.uploadToken,{});if(ticket.asset.state==='ready')return ticket.asset
 const c=await config(),blob=await get(ticket.pathname,{access:'private',useCache:false,storeId:c.storeId,oidcToken:c.oidcToken})
 if(!blob||blob.statusCode!==200)throw new MediaError('尚未收到图片，请重试',409)
 if(blob.blob.pathname!==ticket.pathname||blob.blob.size!==ticket.sizeBytes||blob.blob.size>ACTIVITY_LIMITS.sourceBytes){await blob.stream.cancel();throw new MediaError('上传图像大小或路径不符')}
 const raw=await boundedBytes(blob.stream,ACTIVITY_LIMITS.sourceBytes)
 if(raw.length!==ticket.sizeBytes)throw new MediaError('上传图像字节数不符')
 await worker(path+'/process',s.uploadToken,{})
 let clean:Awaited<ReturnType<typeof sanitizeImage>>
 try{clean=await sanitizeImage(raw,ticket.mimeType)}catch(e){await worker(path+'/fail',s.uploadToken,{}).catch(()=>undefined);throw e}
 const base=ticket.pathname.replace(/\/pending$/,'')
 // Stable content-addressed immutable paths make finish retries safe without overwriting a good asset.
 const sourcePath=base+'/source-'+clean.sourceSha256,displayPath=base+'/display-'+sha(clean.display)+'.webp',options={access:'private' as const,storeId:c.storeId,oidcToken:c.oidcToken,addRandomSuffix:false,allowOverwrite:false,cacheControlMaxAge:60}
 const save=async(pathname:string,bytes:Buffer,contentType:string)=>{try{await put(pathname,bytes,{...options,contentType})}catch(e){const existing=await get(pathname,{access:'private',useCache:false,storeId:c.storeId,oidcToken:c.oidcToken});if(!existing||existing.statusCode!==200)throw e;const data=await boundedBytes(existing.stream,ACTIVITY_LIMITS.sourceBytes);if(sha(data)!==sha(bytes))throw e}}
 await save(sourcePath,clean.source,clean.mimeType);await save(displayPath,clean.display,'image/webp')
 const result=await worker(path+'/activate',s.uploadToken,{sourcePath,displayPath,mimeType:clean.mimeType,width:clean.width,height:clean.height,sizeBytes:clean.source.length,sha256:clean.sourceSha256,displaySizeBytes:clean.display.length,displayMimeType:'image/webp',displayWidth:clean.displayWidth,displayHeight:clean.displayHeight})
 // Raw is temporary and contains metadata; it is removed only after activation succeeds.
 await del(ticket.pathname,{storeId:c.storeId,oidcToken:c.oidcToken}).catch(()=>undefined)
 return {...result as object,displayEncoding:clean.displayEncoding}
}
export function checkOrigin(req:IncomingMessage){
 const origin=req.headers.origin,host=req.headers.host
 if(req.headers['sec-fetch-site']==='cross-site')throw new MediaError('来源未获允许',403,'FORBIDDEN')
 if(origin){let url:URL;try{url=new URL(origin)}catch{throw new MediaError('来源无效',403,'FORBIDDEN')}
  if(url.origin!==origin||!host||url.host!==host||!['https:','http:'].includes(url.protocol))throw new MediaError('来源未获允许',403,'FORBIDDEN')
 }
}
export async function jsonBody(req:IncomingMessage,max=16*1024){
 if(Number(req.headers['content-length'])>max)throw new MediaError('请求过大',413)
 if(!/^application\/json(?:;|$)/i.test(String(req.headers['content-type']||'')))throw new MediaError('需要JSON请求',415)
 const parse=(bytes:Buffer)=>{if(bytes.length>max)throw new MediaError('请求过大',413);try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{throw new MediaError('JSON无效')}}
 // /api Node handlers may receive Vercel's already parsed body, while local Node has a stream.
 const preset=(req as IncomingMessage&{body?:unknown}).body
 if(preset!==undefined){if(Buffer.isBuffer(preset))return parse(preset);if(typeof preset==='string')return parse(Buffer.from(preset));try{const encoded=JSON.stringify(preset);if(typeof encoded!=='string')throw new Error();return parse(Buffer.from(encoded))}catch(e){if(e instanceof MediaError)throw e;throw new MediaError('JSON无效')}}
 let length=0;const chunks:Buffer[]=[];for await(const part of req){const bytes=Buffer.isBuffer(part)?part:Buffer.from(part);length+=bytes.length;if(length>max)throw new MediaError('请求过大',413);chunks.push(bytes)}return parse(Buffer.concat(chunks))
}
export interface CleanupCandidate {id:string;eventId:string;prefix:string}
interface CleanupStorage {scan:(prefix:string)=>Promise<{pathnames:string[];hasMore:boolean}>;remove:(path:string)=>Promise<void>}
export async function cleanCandidate(candidate:CleanupCandidate,storage:CleanupStorage){
 const prefix=`assets/${candidate.eventId}/${candidate.id}/`
 if(candidate.prefix!==prefix||!/^[-\w]{1,100}$/.test(candidate.eventId)||!/^[-\w]{1,100}$/.test(candidate.id))throw new MediaError('清理作用域无效')
 const allowed=(pathname:string)=>pathname.startsWith(prefix)&&/^(pending|source-[a-f0-9]{64}|display-[a-f0-9]{64}\.webp)$/.test(pathname.slice(prefix.length))
 const items=await storage.scan(prefix)
 if(items.hasMore||items.pathnames.length>20||items.pathnames.some(p=>!allowed(p)))throw new MediaError('资产目录异常，未进行删除',409)
 let deletedObjects=0
 for(const pathname of items.pathnames){await storage.remove(pathname);deletedObjects++}
 const remaining=await storage.scan(prefix)
 if(remaining.hasMore||remaining.pathnames.length)throw new MediaError('清理尚未完成，请重试',409)
 return deletedObjects
}
export async function cleanupMedia(eventId:string,adminToken:string){
 if(!/^[-\w]{1,100}$/.test(eventId)||!/^([a-f0-9]{64})$/.test(adminToken))throw new MediaError('管理员清理凭据无效',401)
 const path=`/admin/events/${eventId}/assets`,plan=await worker<{candidates:CleanupCandidate[]}>(path+'/cleanup-plan',adminToken,{}),c=await config(),storage:CleanupStorage={scan:async(prefix)=>{const result=await list({prefix,limit:20,storeId:c.storeId,oidcToken:c.oidcToken});return {pathnames:result.blobs.map(b=>b.pathname),hasMore:result.hasMore}},remove:pathname=>del(pathname,{storeId:c.storeId,oidcToken:c.oidcToken})}
 const results:{assetId:string;cleaned:boolean;deletedObjects?:number}[]=[]
 for(const candidate of plan.candidates){try{const deletedObjects=await cleanCandidate(candidate,storage);await worker(path+'/cleanup-commit',adminToken,{assetId:candidate.id});results.push({assetId:candidate.id,cleaned:true,deletedObjects})}catch{results.push({assetId:candidate.id,cleaned:false})}}
 return {results,usage:await worker(path+'/usage',adminToken)}
}
export function respond(res:ServerResponse,error?:unknown,data?:unknown){res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Type','application/json; charset=utf-8');if(error){const e=error instanceof MediaError?error:new MediaError('媒体服务暂不可用，请保留图片后重试',503,'SERVICE_UNAVAILABLE');res.statusCode=e.status;res.end(JSON.stringify({error:{code:e.code,message:e.message}}))}else res.end(JSON.stringify({data}))}
