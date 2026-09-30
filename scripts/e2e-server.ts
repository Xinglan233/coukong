import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import { build } from 'esbuild'
import { readFileSync, readdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
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
