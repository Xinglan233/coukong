import { createHash } from 'node:crypto'
import type { IncomingMessage,ServerResponse } from 'node:http'
import { get } from '@vercel/blob'
import { config,worker,boundedBytes,respond,MediaError } from './media-service.js'
export const BACKUP_CHUNK_BYTES=1024*1024
export function backupOffset(value:string|null){if(value===null||!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))||Number(value)<0)throw new MediaError('备份偏移无效');return Number(value)}
export function backupSlice(bytes:Buffer,offset:number){if(offset>=bytes.length)throw new MediaError('备份偏移超出文件',416);return bytes.subarray(offset,Math.min(bytes.length,offset+BACKUP_CHUNK_BYTES))}
const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex')
export async function readBackupPart(stream:ReadableStream<Uint8Array>,headers:Headers,metadata:{sizeBytes:number;sha256:string},offset:number){
 const end=Math.min(metadata.sizeBytes-1,offset+BACKUP_CHUNK_BYTES-1),range=headers.get('content-range')
 if(range){if(range!==`bytes ${offset}-${end}/${metadata.sizeBytes}`){await stream.cancel();throw new MediaError('存储分块范围不符',503)}const bytes=await boundedBytes(stream,BACKUP_CHUNK_BYTES);if(bytes.length!==end-offset+1)throw new MediaError('备份分块不完整',503);return {bytes,readMode:'range'}}
 const full=await boundedBytes(stream,metadata.sizeBytes);if(full.length!==metadata.sizeBytes||hash(full)!==metadata.sha256)throw new MediaError('历史媒体哈希或大小不符',503);return {bytes:backupSlice(full,offset),readMode:'full'}
}
export default async function backupHandler(req:IncomingMessage,res:ServerResponse){try{
 if(req.method!=='GET')throw new MediaError('仅支持GET',405)
 const params=new URL(req.url||'','https://backup.invalid').searchParams,eventId=params.get('eventId'),mode=params.get('mode'),auth=String(req.headers.authorization||'').replace(/^Bearer /,'')
 if(!eventId||!/^[-\w]{1,100}$/.test(eventId)||!/^([a-f0-9]{64})$/.test(auth))throw new MediaError('需要本活动管理员备份凭据',401)
 const expected=params.get('expectedRevision'),path=`/admin/events/${eventId}/assets`,query=(items:Record<string,string>)=>'?'+new URLSearchParams({...items,...(expected?{expectedRevision:expected}:{})}).toString()
 if(mode==='index'){const data=await worker(path+'/backup-index'+query({}),auth);if(Buffer.byteLength(JSON.stringify({data}))>BACKUP_CHUNK_BYTES)throw new MediaError('媒体索引超过1 MiB上限',413);respond(res,undefined,data);return}
 const offset=backupOffset(params.get('offset'));let bytes:Buffer,total:number,sha256:string,readMode='full'
 if(mode==='file'){
  const assetId=params.get('assetId'),kind=params.get('kind');if(!assetId||!/^[-\w]{1,100}$/.test(assetId)||!['source','display'].includes(kind||''))throw new MediaError('备份文件请求无效')
  const metadata=await worker<{pathname:string;sizeBytes:number;sha256:string}>(path+'/backup-file'+query({assetId,kind:kind!}),auth)
  if(offset>=metadata.sizeBytes)throw new MediaError('备份偏移超出文件',416)
  const c=await config(),end=Math.min(metadata.sizeBytes-1,offset+BACKUP_CHUNK_BYTES-1),blob=await get(metadata.pathname,{access:'private',useCache:false,storeId:c.storeId,oidcToken:c.oidcToken,headers:{Range:`bytes=${offset}-${end}`},abortSignal:AbortSignal.timeout(30000)})
  if(!blob||blob.statusCode!==200)throw new MediaError('历史媒体文件缺失',404)
  if(blob.blob.pathname!==metadata.pathname){await blob.stream.cancel();throw new MediaError('历史媒体文件范围无效',503)}
  const part=await readBackupPart(blob.stream,blob.headers as unknown as Headers,metadata,offset);bytes=part.bytes;readMode=part.readMode;total=metadata.sizeBytes;sha256=metadata.sha256
 }else throw new MediaError('备份模式无效')
 res.setHeader('Content-Type','application/octet-stream');res.setHeader('Content-Length',bytes.length);res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Backup-Total-Bytes',total);res.setHeader('X-Backup-Offset',offset);res.setHeader('X-Backup-SHA256',sha256);res.setHeader('X-Backup-Chunk-SHA256',hash(bytes));res.setHeader('X-Backup-Read-Mode',readMode);res.end(bytes)
 }catch(e){respond(res,e)}}
