import type { IncomingMessage,ServerResponse } from 'node:http'
import { get } from '@vercel/blob'
import { config,worker,assetPath,boundedBytes,respond,MediaError,DISPLAY_LIMIT } from '../../src/server/media-service'
export default async function read(req:IncomingMessage,res:ServerResponse){try{
 if(req.method!=='GET')throw new MediaError('仅支持GET',405)
 const url=new URL(req.url||'','https://media.invalid'),eventId=url.searchParams.get('eventId'),assetId=url.searchParams.get('assetId')
 if(!eventId||!assetId||!/^[-\w]{1,100}$/.test(eventId)||!/^[-\w]{1,100}$/.test(assetId))throw new MediaError('需要活动与资产ID')
 const auth=typeof req.headers.authorization==='string'?req.headers.authorization.replace(/^Bearer /,''):''
 const ticket=await worker<{displayPath:string;displaySizeBytes:number;displayMimeType:string}>(assetPath(eventId,assetId)+'/read-ticket',auth),c=await config()
 const blob=await get(ticket.displayPath,{access:'private',useCache:false,storeId:c.storeId,oidcToken:c.oidcToken})
 if(!blob||blob.statusCode!==200)throw new MediaError('地图文件不可用',404)
 if(blob.blob.pathname!==ticket.displayPath||blob.blob.size!==ticket.displaySizeBytes||blob.blob.size>DISPLAY_LIMIT){await blob.stream.cancel();throw new MediaError('地图文件无效',503)}
 const bytes=await boundedBytes(blob.stream,DISPLAY_LIMIT)
 if(bytes.length!==ticket.displaySizeBytes)throw new MediaError('地图文件不完整',503)
 res.setHeader('Content-Type','image/webp');res.setHeader('Content-Length',bytes.length);res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Disposition','inline');res.end(bytes)
 }catch(e){respond(res,e)}}
