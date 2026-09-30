import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import { build } from 'esbuild'
import { readFileSync, readdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes, createHash } from 'node:crypto'
import { createServer } from 'node:http'

// Every test run has a separate on-disk SQLite database. No Cloudflare account is used; files remain for inspection.
const directory = mkdtempSync(join(tmpdir(), 'coukong-e2e-'))
console.log('Isolated E2E: bundling Worker')
const built = await build({ entryPoints: ['worker/src/index.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' })
const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: built.outputFiles[0].text, compatibilityDate: '2026-09-01', d1Databases: { DB: 'coukong-e2e-isolated' }, resourcePersistencePath: directory, bindings: { CREATION_MODE: 'invite', CREATION_CODE: 'test-create', ADMIN_ROOT_SECRET: process.env.TONGYE_E2E_ADMIN_ROOT || randomBytes(32).toString('hex'), ALLOWED_ORIGINS: 'http://localhost:5173,http://localhost:5174', BUILD_VERSION: 'e2e-isolated' } }))
console.log('Isolated E2E: starting workerd')
const db = await mf.getD1Database('DB')
console.log('Isolated E2E: applying migrations')
for (const migration of readdirSync('worker/migrations').filter(x=>x.endsWith('.sql')).sort()) await db.exec(readFileSync(`worker/migrations/${migration}`, 'utf8').replace(/\n/g, ' '))
const server = createServer(async (incoming, outgoing) => {
  try {
    // Local fixture metadata only. This endpoint never exists in the Worker or dev:all.
    // Bytes are a fixed repository PNG, not a caller supplied path or cloud storage.
    if(incoming.method==='POST'&&incoming.url?.startsWith('/__e2e/seed-fixture?')){
      const eventId=new URL(incoming.url,'http://localhost').searchParams.get('eventId')||''
      if(!/^ui-activity-[a-z0-9-]{1,40}$/.test(eventId)){outgoing.writeHead(400);outgoing.end('{}');return}
      const event=await db.prepare('SELECT revision FROM events WHERE id=?').bind(eventId).first<{revision:number}>()
      if(!event){outgoing.writeHead(404);outgoing.end('{}');return}
      const variant=new URL(incoming.url,'http://localhost').searchParams.get('variant')==='b'?'b':'a'
      const bytes=readFileSync(variant==='b'?'tests/fixtures/maps/version-b.png':'examples/assets/convention-demo.png'),sha=createHash('sha256').update(bytes).digest('hex')
      if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error('Fixed fixture is not PNG')
      const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),id='fixture-'+eventId+(variant==='b'?'-b':''),now=new Date().toISOString()
      if(variant==='b')await db.prepare("UPDATE media_assets SET state='failed' WHERE event_id=? AND asset_key='convention-demo.png'").bind(eventId).run()
      await db.prepare("INSERT INTO media_assets(id,event_id,asset_key,state,mime_type,width,height,size_bytes,sha256,display_size_bytes,revision,expected_event_revision,ticket_hash,expires_at,operation_id,operation_digest,source_path,display_path,display_mime_type,display_width,display_height,source_size_bytes,source_sha256,created_at,updated_at) VALUES(?,?,?,'ready','image/png',?,?,?,?,?,1,?,?,?,?,?,?,?,'image/png',?,?,?,?,?,?)").bind(id,eventId,'convention-demo.png',width,height,bytes.length,sha,bytes.length,event.revision,createHash('sha256').update(id).digest('hex'),Date.now()+3600000,'fixed-fixture','fixed-fixture',`assets/${eventId}/${id}/source-${sha}`,`assets/${eventId}/${id}/display-${sha}.png`,width,height,bytes.length,sha,now,now).run()
      outgoing.writeHead(200,{'Content-Type':'application/json'});outgoing.end(JSON.stringify({data:{id,width,height,sha256:sha,sizeBytes:bytes.length}}));return
    }
    const chunks: Buffer[] = []
    for await (const chunk of incoming) chunks.push(Buffer.from(chunk))
    const response = await mf.dispatchFetch(`http://localhost:8787${incoming.url}`, { method: incoming.method, headers: incoming.headers as Record<string, string>, ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) })
    outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()))
    outgoing.end(Buffer.from(await response.arrayBuffer()))
  } catch { outgoing.writeHead(500); outgoing.end('{"error":{"code":"SERVICE_UNAVAILABLE","message":"测试服务失败"}}') }
})
server.listen(8787, '127.0.0.1', () => console.log(`Isolated real Worker/D1 ready on 8787; SQLite at ${directory}`))
async function close() { server.close(); await mf.dispose(); console.log(`Isolated test database retained at ${directory}`); process.exit(0) }
process.on('SIGINT', close)
process.on('SIGTERM', close)
