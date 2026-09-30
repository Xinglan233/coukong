import type { IncomingMessage,ServerResponse } from 'node:http'
import { issueSignedToken } from '@vercel/blob'
import { handleUploadPresigned,type HandleUploadPresignedBody } from '@vercel/blob/client'
import { config,scope,worker,assetPath,jsonBody,respond,MediaError,type Ticket } from '../../src/server/media-service'
export default async function upload(req:IncomingMessage,res:ServerResponse){try{
 if(req.method!=='POST')throw new MediaError('仅支持POST',405)
 const body=await jsonBody(req) as HandleUploadPresignedBody
 const result=await handleUploadPresigned({body,request:req,getSignedToken:async(pathname,clientPayload,multipart)=>{
  if(multipart)throw new MediaError('不支持分片上传')
  let payload;try{payload=JSON.parse(clientPayload||'')}catch{throw new MediaError('上传资料无效')}
  const s=scope(payload),ticket=await worker<Ticket>(assetPath(s.eventId,s.assetId)+'/ticket',s.uploadToken,{}),c=await config()
  if(ticket.pathname!==pathname||ticket.asset.state!=='pending')throw new MediaError('上传路径或状态无效',409)
  return {token:await issueSignedToken({storeId:c.storeId,oidcToken:c.oidcToken,pathname,operations:['put'],validUntil:ticket.expiresAt,allowedContentTypes:[ticket.mimeType],maximumSizeInBytes:ticket.sizeBytes}),urlOptions:{access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:ticket.mimeType,cacheControlMaxAge:60}}
 }})
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result))
 }catch(e){respond(res,e)}}
