import {afterEach,beforeEach,it,expect,vi} from 'vitest'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import type {IncomingMessage,ServerResponse} from 'node:http'
import type {GetBlobResult} from '@vercel/blob'
import backupHandler,{BACKUP_CHUNK_BYTES} from '../../src/server/media-backup'
import {get} from '@vercel/blob'
import {worker} from '../../src/server/media-service'

vi.mock('@vercel/blob',async original=>({...await original<typeof import('@vercel/blob')>(),get:vi.fn()}))
vi.mock('../../src/server/media-service',async original=>({...await original<typeof import('../../src/server/media-service')>(),config:vi.fn(async()=>({storeId:'fixture',oidcToken:'fixture',api:'https://fixture.invalid'})),worker:vi.fn()}))
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex')
const full=Buffer.alloc(BACKUP_CHUNK_BYTES+3,42),offset=BACKUP_CHUNK_BYTES,pathname='assets/event-test/asset-test/source-fixture'
const metadata={pathname,sizeBytes:full.length,sha256:sha(full)}
const stream=(bytes:Buffer)=>new ReadableStream<Uint8Array>({start(c){c.enqueue(bytes);c.close()}})
// The installed SDK types normalize successful HTTP 206 to 200. Model a raw
// partial response separately to verify the handler's compatibility boundary.
function blob(statusCode:number,bytes=full.subarray(offset),headers=new Headers({'content-range':`bytes ${offset}-${full.length-1}/${full.length}`})){
 return {statusCode,stream:stream(bytes),headers,blob:{pathname,size:bytes.length}} as unknown as GetBlobResult
}
async function call(){
 const req={method:'GET',url:`/api/media/backup?eventId=event-test&mode=file&assetId=asset-test&kind=source&offset=${offset}`,headers:{authorization:'Bearer '+'a'.repeat(64)}} as IncomingMessage
 const headers:Record<string,string|number>={},response={statusCode:200,setHeader(k:string,v:string|number){headers[k.toLowerCase()]=v},end(bytes:Buffer|string){response.body=Buffer.from(bytes)},body:Buffer.alloc(0),headers}
 await backupHandler(req,response as unknown as ServerResponse)
 return response
}
beforeEach(()=>{vi.mocked(worker).mockResolvedValue(metadata)})
afterEach(()=>{vi.clearAllMocks();vi.unstubAllGlobals()})
it('handler accepts a bounded HTTP 206 range and returns only that exact chunk with its hash',async()=>{
 vi.mocked(get).mockResolvedValue(blob(206));const result=await call()
 expect(result.statusCode).toBe(200);expect(result.body).toEqual(full.subarray(offset))
 expect(result.headers['x-backup-read-mode']).toBe('range');expect(result.headers['x-backup-chunk-sha256']).toBe(sha(full.subarray(offset)));expect(result.headers['x-backup-sha256']).toBe(metadata.sha256)
})
it('handler accepts SDK-normalized 200 range and verified full 200 fallback',async()=>{
 vi.mocked(get).mockResolvedValue(blob(200));expect((await call()).body).toEqual(full.subarray(offset))
 vi.mocked(get).mockResolvedValue(blob(200,full,new Headers()));const result=await call()
 expect(result.statusCode).toBe(200);expect(result.body).toEqual(full.subarray(offset))
})
it('handler rejects wrong asset paths and oversized partial bodies without emitting a backup chunk',async()=>{
 const wrong=blob(206);wrong.blob.pathname='assets/other-event/asset-test/source-fixture'
 for(const value of [wrong,blob(206,Buffer.alloc(BACKUP_CHUNK_BYTES+1))]){
  vi.mocked(get).mockResolvedValue(value);const result=await call()
  expect([413,503]).toContain(result.statusCode);expect(result.headers['x-backup-chunk-sha256']).toBeUndefined();expect(JSON.parse(result.body.toString()).error).toBeDefined()
 }
})
it.each([302,304,403,503])('handler rejects unexpected storage status %i',async status=>{
 vi.mocked(get).mockResolvedValue(blob(status));const result=await call()
 expect(result.statusCode).toBe(404);expect(JSON.parse(result.body.toString()).error).toBeDefined()
})
it('handler rejects partial responses without a range, wrong ranges, truncated parts and mismatched full hashes',async()=>{
 for(const value of [blob(206,full,new Headers()),blob(206,full.subarray(offset),new Headers({'content-range':'bytes 0-2/3'})),blob(206,Buffer.from([42,42])),blob(200,Buffer.alloc(full.length,43),new Headers())]){
  vi.mocked(get).mockResolvedValue(value);const result=await call();expect(result.statusCode).toBe(503);expect(JSON.parse(result.body.toString()).error).toBeDefined()
 }
})
it('installed SDK maps a real HTTP 206 transport response to 200 and preserves its range',()=>{
 const script=`import {createRequire} from 'node:module';import {get} from '@vercel/blob';const require=createRequire(import.meta.url);const {MockAgent,setGlobalDispatcher}=createRequire(require.resolve('@vercel/blob'))('undici');const agent=new MockAgent();agent.disableNetConnect();setGlobalDispatcher(agent);agent.get('https://fixture.public.blob.vercel-storage.com').intercept({path:'/map',method:'GET'}).reply(206,Buffer.from([42,42,42]),{headers:{'content-range':'bytes 1048576-1048578/1048579','content-length':'3'}});try{const blob=await get('https://fixture.public.blob.vercel-storage.com/map',{access:'public',token:'vercel_blob_rw_fixture_fixture',headers:{Range:'bytes=1048576-1048578'}});process.stdout.write(JSON.stringify({status:blob.statusCode,range:blob.headers.get('content-range'),bytes:Array.from(new Uint8Array(await new Response(blob.stream).arrayBuffer()))}));}finally{await agent.close();}`
 const output=execFileSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:10000})
 expect(JSON.parse(output)).toEqual({status:200,range:'bytes 1048576-1048578/1048579',bytes:[42,42,42]})
})
