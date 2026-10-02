import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import { build } from 'esbuild'
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let mf: Miniflare
let db: D1Database
let workerScript: string
const token = () => randomBytes(32).toString('hex')
const root = token(), admin = token()
const pack = JSON.parse(readFileSync('examples/event-minimal.json', 'utf8'))
const eventId = 'creation-invite-event'
let source = 0
async function api(path: string, method = 'GET', auth = '', body?: unknown) {
  const res = await mf.dispatchFetch('http://localhost/api/v1' + path, {
    method, headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': 'test-' + (++source), ...(auth ? { Authorization: 'Bearer ' + auth } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return { status: res.status, ...await res.json() as any }
}
const creation = (code: string, id = eventId) => ({ creationCode: code, sourceEventId: id, sourceEventRevision: 1, managerToken: token(), inviteToken: token(), operationId: randomUUID() })
const issuance = (id = eventId) => ({ token: token(), eventId: id, operationId: randomUUID() })
async function issue() {
  const body = issuance(), result = await api('/admin/creation-invites', 'POST', admin, body)
  expect(result.status).toBe(200)
  return { body, data: result.data }
}

beforeAll(async () => {
  const built = await build({ entryPoints: ['worker/src/index.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' })
  workerScript = built.outputFiles[0].text
  mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: workerScript, compatibilityDate: '2026-09-01', d1Databases: ['DB'], bindings: { CREATION_MODE: 'invite', CREATION_CODE: 'test-create', ADMIN_ROOT_SECRET: root, ALLOWED_ORIGINS: 'http://localhost:5173', BUILD_VERSION: 'integration' } }))
  db = await mf.getD1Database('DB') as unknown as D1Database
  for (const file of readdirSync('worker/migrations').filter(x => x.endsWith('.sql')).sort()) await db.exec(readFileSync('worker/migrations/' + file, 'utf8').replace(/\n/g, ' '))
  expect((await api('/admin/session', 'POST', '', { rootSecret: root, sessionToken: admin })).status).toBe(200)
  const eventPackage = structuredClone(pack); eventPackage.event.id = eventId
  expect((await api('/admin/events', 'POST', admin, { eventPackage, status: 'published', expectedRevision: 0, operationId: randomUUID() })).status).toBe(200)
}, 30000)
afterAll(async () => { await mf?.dispose() })

describe.sequential('真实D1：管理员单次建队文字码', () => {
  it('管理员生成默认24小时文字码；数据库和状态接口没有明文', async () => {
    const { body, data } = await issue()
    expect(data).toMatchObject({ eventId, maxUses: 1, usedCount: 0, status: 'available', revision: 0 })
    expect(Date.parse(data.expiresAt) - Date.parse(data.createdAt)).toBe(24 * 3600000)
    expect((await api('/admin/creation-invites')).status).toBe(401)
    const rows = (await api('/admin/creation-invites', 'GET', admin)).data
    expect(JSON.stringify(rows)).not.toContain(body.token)
    expect(JSON.stringify(rows)).not.toContain(createHash('sha256').update(body.token).digest('hex'))
    const row = await db.prepare('SELECT * FROM creation_invites WHERE id=?').bind(data.id).first<any>()
    expect(row.token_hash).toBe(createHash('sha256').update(body.token).digest('hex'))
    expect(JSON.stringify(row)).not.toContain(body.token)
    expect((await api('/admin/creation-invites', 'POST', admin, body)).data.id).toBe(data.id)
    expect((await api('/admin/creation-invites', 'POST', admin, { ...body, ttlHours: 12 })).status).toBe(409)
  })
  it('码只能创建绑定活动的一队；响应丢失重试不会多建或重放管理秘密', async () => {
    const { body, data } = await issue(), request = creation(body.token)
    const created = await api('/groups', 'POST', '', request)
    expect(created.status).toBe(200)
    expect(created.data.sourceEventId).toBe(eventId)
    expect(JSON.stringify(created.data)).not.toContain(request.managerToken)
    expect((await api('/groups', 'POST', '', request)).data.id).toBe(created.data.id)
    expect((await api('/groups', 'POST', '', { ...request, title: '修改内容' })).status).toBe(409)
    expect((await api('/groups', 'POST', '', creation(body.token))).status).toBe(403)
    expect((await api('/admin/creation-invites', 'GET', admin)).data.find((x: any) => x.id === data.id)).toMatchObject({ status: 'used', usedCount: 1, usedGroupId: created.data.id })
    expect((await api(`/groups/${created.data.id}`, 'GET', body.token)).status).toBe(401)
    expect((await api('/admin/groups', 'GET', body.token)).status).toBe(401)
    expect((await api(`/groups/${created.data.id}`, 'DELETE', request.managerToken, { expectedRevision: 0, operationId: randomUUID(), confirm: created.data.id })).status).toBe(200)
    expect((await api('/groups', 'POST', '', creation(body.token))).status).toBe(403)
  })
  it('错误活动、手工活动、旧活动版本都不烧掉码；随后正确请求成功', async () => {
    const { body } = await issue()
    expect((await api('/groups', 'POST', '', creation(body.token, 'other-event'))).status).toBe(403)
    const manual = { ...creation(body.token), sourceEventId: undefined, eventPackage: pack }
    expect((await api('/groups', 'POST', '', manual)).status).toBe(403)
    expect((await api('/groups', 'POST', '', { ...creation(body.token), sourceEventRevision: 0 })).status).toBe(409)
    expect((await api('/groups', 'POST', '', creation(body.token))).status).toBe(200)
  })
  it('两个不同建队请求竞态只消费一次，不留未授权小队', async () => {
    const { body, data } = await issue(), a = creation(body.token), b = creation(body.token)
    const results = await Promise.all([api('/groups', 'POST', '', a), api('/groups', 'POST', '', b)])
    expect(results.map(r => r.status).sort()).toEqual([200, 403])
    const winner = results.find(r => r.status === 200)!.data
    expect((await db.prepare('SELECT used_group_id,revision FROM creation_invites WHERE id=?').bind(data.id).first<any>())).toEqual({ used_group_id: winner.id, revision: 1 })
    expect((await db.prepare('SELECT COUNT(*) AS n FROM groups WHERE manager_hash IN (?,?)').bind(...[a, b].map(x => createHash('sha256').update(x.managerToken).digest('hex'))).first<any>())!.n).toBe(1)
  })
  it('同一建队请求并发或使用后过期仍可安全回读原结果', async () => {
    const { body, data } = await issue(), request = creation(body.token)
    const results = await Promise.all([api('/groups', 'POST', '', request), api('/groups', 'POST', '', request)])
    expect(results.map(x => x.status)).toEqual([200, 200])
    expect(results[0].data.id).toBe(results[1].data.id)
    await db.prepare('UPDATE creation_invites SET expires_at=? WHERE id=?').bind('2000-01-01T00:00:00.000Z', data.id).run()
    expect((await api('/groups', 'POST', '', request)).data.id).toBe(results[0].data.id)
    expect((await api('/groups', 'POST', '', creation(body.token))).status).toBe(403)
  })
  it('强制旧grant读取与另一请求成功交错时，同一请求仍幂等回读', async () => {
    const { body } = await issue(), request = creation(body.token)
    let observed!: () => void, release!: () => void
    const started = new Promise<void>(resolve => { observed = resolve }), gate = new Promise<void>(resolve => { release = resolve })
    // Real D1 query, delayed after reading its real snapshot. B runs through
    // workerd normally. Only A's scheduling is controlled; no fake SQL results.
    const delayedDB = new Proxy(db, { get(target, key) {
      if (key === 'prepare') return (sql: string) => {
        const statement = target.prepare(sql)
        if (sql !== 'SELECT * FROM creation_invites WHERE token_hash=?') return statement
        const wrap = (stmt: D1PreparedStatement): D1PreparedStatement => new Proxy(stmt, { get(t, k) {
          if (k === 'bind') return (...args: any[]) => wrap(t.bind(...args))
          if (k === 'first') return async (column?: string) => { const row = await t.first(column); observed(); await gate; return row }
          const value = Reflect.get(t, k); return typeof value === 'function' ? value.bind(t) : value
        } })
        return wrap(statement)
      }
      const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value
    } })
    const worker = (await import('../../worker/src/index')).default
    const waiting = worker.fetch(new Request('http://localhost/api/v1/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) }), { DB: delayedDB, CREATION_MODE: 'invite', CREATION_CODE: 'test-create', ADMIN_ROOT_SECRET: root, ALLOWED_ORIGINS: 'http://localhost:5173', BUILD_VERSION: 'forced-race' })
    await started
    const completed = await api('/groups', 'POST', '', request)
    expect(completed.status).toBe(200); release()
    const replay = await waiting
    expect(replay.status).toBe(200)
    expect((await replay.json() as any).data.id).toBe(completed.data.id)
    expect((await api('/groups', 'POST', '', { ...request, managerToken: token() })).status).toBe(403)
  })
  it('撤销需管理员且幂等；撤销或过期码不能创建', async () => {
    const { body, data } = await issue(), revoke = { operationId: randomUUID(), expectedRevision: 0 }
    expect((await api(`/admin/creation-invites/${data.id}`, 'DELETE', body.token, revoke)).status).toBe(401)
    expect((await api(`/admin/creation-invites/${data.id}`, 'DELETE', admin, revoke)).data.status).toBe('revoked')
    expect((await api(`/admin/creation-invites/${data.id}`, 'DELETE', admin, revoke)).data.status).toBe('revoked')
    expect((await api(`/admin/creation-invites/${data.id}`, 'DELETE', admin, { ...revoke, expectedRevision: 1 })).status).toBe(409)
    const deniedRevoked=await api('/groups', 'POST', '', creation(body.token));expect(deniedRevoked.status).toBe(403);expect(deniedRevoked.error.code).toBe('CREATION_INVITE_REVOKED')
    const expired = await issue()
    await db.prepare('UPDATE creation_invites SET expires_at=? WHERE id=?').bind('2000-01-01T00:00:00.000Z', expired.data.id).run()
    const deniedExpired=await api('/groups', 'POST', '', creation(expired.body.token));expect(deniedExpired.status).toBe(403);expect(deniedExpired.error.code).toBe('CREATION_INVITE_EXPIRED')
    expect((await api('/admin/creation-invites', 'GET', admin)).data.find((x: any) => x.id === expired.data.id).status).toBe('expired')
  })
  it('撤销和消费竞态只有一个赢；不存在已撤销却新建的小队', async () => {
    const { body, data } = await issue(), request = creation(body.token)
    const [created, revoked] = await Promise.all([api('/groups', 'POST', '', request), api(`/admin/creation-invites/${data.id}`, 'DELETE', admin, { operationId: randomUUID(), expectedRevision: 0 })])
    expect([created.status, revoked.status]).toSatisfy((s: number[]) => (s[0] === 200 && s[1] === 409) || (s[0] === 403 && s[1] === 200))
    const row = await db.prepare('SELECT used_group_id,revoked_at FROM creation_invites WHERE id=?').bind(data.id).first<any>()
    expect(Boolean(row.used_group_id)).toBe(!row.revoked_at)
  })
  it('SQL异常回滚小队和消费，从属写入不能留下半成功', async () => {
    const { body, data } = await issue(), request = creation(body.token)
    await db.exec("CREATE TRIGGER creation_invite_test_abort BEFORE UPDATE OF used_group_id ON creation_invites BEGIN SELECT RAISE(ABORT,'isolated failure'); END")
    expect((await api('/groups', 'POST', '', request)).status).toBe(503)
    await db.exec('DROP TRIGGER creation_invite_test_abort')
    expect((await db.prepare('SELECT COUNT(*) AS n FROM groups WHERE manager_hash=?').bind(createHash('sha256').update(request.managerToken).digest('hex')).first<any>())!.n).toBe(0)
    expect((await db.prepare('SELECT used_group_id FROM creation_invites WHERE id=?').bind(data.id).first<any>())!.used_group_id).toBeNull()
    expect((await api('/groups', 'POST', '', request)).status).toBe(200)
  })
  it('生成校验目标、时效、token与权限作用域，不接受扩权字段', async () => {
    expect((await api('/admin/creation-invites', 'POST', token(), issuance())).status).toBe(401)
    for (const changes of [{ eventId: undefined }, { eventId: 'missing' }, { ttlHours: 0 }, { ttlHours: 169 }, { ttlHours: null }, { token: '123456' }, { maxUses: 2 }, { scope: 'any-authorized-event' }, { token: root }, { token: admin }]) {
      expect((await api('/admin/creation-invites', 'POST', admin, { ...issuance(), ...changes })).status).toBeGreaterThanOrEqual(400)
    }
    const draft = structuredClone(pack); draft.event.id = 'unpublished-target'
    expect((await api('/admin/events', 'POST', admin, { eventPackage: draft, status: 'draft', operationId: randomUUID() })).status).toBe(200)
    expect((await api('/admin/creation-invites', 'POST', admin, issuance(draft.event.id))).status).toBe(409)
  })
  it('原站点创建码仍支持私人活动，小队码不授权私人活动创建', async () => {
    const { body } = await issue()
    const privateBody = { eventPackage: pack, ownerToken: token(), personalToken: token(), name: '本人', operationId: randomUUID(), creationCode: body.token }
    expect((await api('/private-events', 'POST', '', privateBody)).status).toBe(403)
    const privateEvent = await api('/private-events', 'POST', '', { ...privateBody, creationCode: 'test-create' })
    expect(privateEvent.status).toBe(200)
    const request = { ...creation('test-create', privateEvent.data.activity.id), sourceEventToken: privateBody.ownerToken }
    expect((await api('/groups', 'POST', '', request)).status).toBe(200)
    expect((await api('/admin/creation-invites', 'POST', admin, issuance(privateEvent.data.activity.id))).status).toBe(409)
  })
  it('发布状态改变后不建队也不消费，已有队伍快照不受影响', async () => {
    const isolated = structuredClone(pack); isolated.event.id = 'archived-grant-event'
    expect((await api('/admin/events', 'POST', admin, { eventPackage: isolated, status: 'published', operationId: randomUUID() })).status).toBe(200)
    const body = issuance(isolated.event.id), grant = await api('/admin/creation-invites', 'POST', admin, body)
    expect(grant.status).toBe(200)
    expect((await api('/admin/events', 'POST', admin, { eventPackage: isolated, status: 'archived', expectedRevision: 1, operationId: randomUUID() })).status).toBe(200)
    expect((await api('/groups', 'POST', '', creation(body.token, isolated.event.id))).status).toBe(409)
    expect((await db.prepare('SELECT used_group_id FROM creation_invites WHERE id=?').bind(grant.data.id).first<any>())!.used_group_id).toBeNull()
  })
  it('建队码不阻碍正常三人填写，确认与分钟精度沿用原合同', async () => {
    const { body } = await issue(), request = creation(body.token), created = await api('/groups', 'POST', '', request)
    expect(created.status).toBe(200)
    for (const name of ['队长', '队员A', '队员B']) {
      const memberToken = token(), joined = await api(`/groups/${created.data.id}/join`, 'POST', request.inviteToken, { name, memberToken, operationId: randomUUID() })
      expect(joined.status).toBe(200)
      const response = { name, presence: [{ date: '2026-10-03', intervals: [{ start: '13:07', end: '13:52' }] }], busy: [], bufferMinutes: 0 }
      expect((await api(`/groups/${created.data.id}/members/${joined.data.id}/response`, 'PUT', memberToken, { response, expectedRevision: 0, scheduleRevision: 0, operationId: randomUUID() })).status).toBe(200)
      expect((await api(`/groups/${created.data.id}/members/${joined.data.id}/response`, 'GET', memberToken)).data.response.presence[0].intervals).toEqual([{ start: '13:07', end: '13:52' }])
    }
    const members = (await api(`/groups/${created.data.id}/availability`, 'GET', request.managerToken)).data.members
    expect(members).toHaveLength(3)
    expect(members.every((m: any) => m.status === 'confirmed' && JSON.stringify(m.availability) === '[{"date":"2026-10-03","start":"13:07","end":"13:52"}]')).toBe(true)
  })
  it('有效建队码预算在SQL层有界，拒绝后仍能读取和管理已有记录', async () => {
    // Isolated budget fixture: reach the actual 100-active boundary without
    // spending 100 administrator requests or disabling the request limiter.
    const count = (await db.prepare("SELECT count(*) AS n FROM creation_invites WHERE used_group_id IS NULL AND revoked_at IS NULL AND expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')").first<any>())!.n
    await db.prepare("WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<?) INSERT INTO creation_invites(id,token_hash,event_id,event_title,admin_hash,create_op,create_digest,created_at,expires_at) SELECT 'budget-'||i,printf('%064x',i),?,'隔离测试','budget-admin','budget-op-'||i,'digest',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'2100-01-01T00:00:00.000Z' FROM n").bind(100 - count, eventId).run()
    const result = await api('/admin/creation-invites', 'POST', admin, issuance())
    expect(result.status).toBe(429)
    expect(result.error.code).toBe('LIMIT_EXCEEDED')
    expect((await api('/admin/creation-invites?limit=100', 'GET', admin)).data.length).toBeGreaterThan(0)
    // Release only this isolated fixture's active entries, not actual groups.
    await db.prepare("UPDATE creation_invites SET revoked_at='2026-10-01T00:00:00.000Z' WHERE id LIKE 'budget-%'").run()
    expect((await api('/admin/creation-invites', 'POST', admin, issuance())).status).toBe(200)
  })
  it('管理员生成按会话限流，超限不会新增记录', async () => {
    const session = token()
    expect((await api('/admin/session', 'POST', '', { rootSecret: root, sessionToken: session })).status).toBe(200)
    const before = (await db.prepare('SELECT count(*) AS n FROM creation_invites').first<any>())!.n
    // Invalid bodies count too, so failed validation cannot evade throttling.
    for (let i = 0; i < 30; i++) expect((await api('/admin/creation-invites', 'POST', session, { ...issuance(), ttlHours: 0 })).status).toBe(400)
    expect((await api('/admin/creation-invites', 'POST', session, issuance())).status).toBe(429)
    expect((await db.prepare('SELECT count(*) AS n FROM creation_invites').first<any>())!.n).toBe(before)
  })
  it('实际SQL备份隔离恢复保留已用码，且消费触发器恢复后仍有效', async () => {
    const session = token()
    expect((await api('/admin/session', 'POST', '', { rootSecret: root, sessionToken: session })).status).toBe(200)
    const used = issuance(), available = issuance()
    expect((await api('/admin/creation-invites', 'POST', session, used)).status).toBe(200)
    expect((await api('/admin/creation-invites', 'POST', session, available)).status).toBe(200)
    const request = creation(used.token), group = await api('/groups', 'POST', '', request)
    expect(group.status).toBe(200)
    const schema = (await db.prepare("SELECT name,type,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all<any>()).results
    const quote = (v: unknown) => v === null ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replaceAll("'", "''") + "'"
    // Table-by-table export deliberately places group rows before their grant
    // rows, matching the forward-FK ordering the real restore helper handles.
    let sql = 'PRAGMA defer_foreign_keys=TRUE;\n'
    for (const row of schema.filter(r => r.type === 'table')) {
      sql += row.sql + ';\n'
      for (const data of (await db.prepare('SELECT * FROM "' + row.name + '"').all<any>()).results) sql += 'INSERT INTO "' + row.name + '" (' + Object.keys(data).map(k => '"' + k + '"').join(',') + ') VALUES (' + Object.values(data).map(quote).join(',') + ');\n'
    }
    for (const row of schema.filter(r => r.type !== 'table')) sql += row.sql + ';\n'
    const dir = mkdtempSync(join(tmpdir(), 'tongye-creation-restore-')), sourceFile = join(dir, 'source.sql'), target = join(dir, 'restore.sql')
    const restored = new Miniflare(convertV4MiniflareOptions({ modules: true, script: workerScript, compatibilityDate: '2026-09-01', d1Databases: ['DB'], bindings: { CREATION_MODE: 'invite', CREATION_CODE: 'test-create', ADMIN_ROOT_SECRET: root, ALLOWED_ORIGINS: 'http://localhost:5173', BUILD_VERSION: 'restore-test' } }))
    try {
      writeFileSync(sourceFile, sql, { mode: 0o600 })
      execFileSync('python3', ['scripts/prepare-d1-restore.py', sourceFile, target], { stdio: 'pipe' })
      const restoredDB = await restored.getD1Database('DB')
      const statements: string[] = JSON.parse(execFileSync('python3', ['-c', "import sqlite3,json,sys; result=[]; text=''\nfor line in open(sys.argv[1]):\n text+=line\n if sqlite3.complete_statement(text): result.append(text); text=''\nassert not text.strip()\nprint(json.dumps(result))", target], { encoding: 'utf8' }))
      expect(statements.every(s => Buffer.byteLength(s) <= 80 * 1024)).toBe(true)
      await restoredDB.batch(statements.map(s => restoredDB.prepare(s)))
      expect((await restoredDB.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])
      const states = 'SELECT id,used_group_id,used_at,revoked_at,expires_at,revision FROM creation_invites ORDER BY id'
      expect((await restoredDB.prepare(states).all()).results).toEqual((await db.prepare(states).all()).results)
      expect((await restoredDB.prepare('SELECT * FROM visitor_storage_budget').all()).results).toEqual((await db.prepare('SELECT * FROM visitor_storage_budget').all()).results)
      const call = async (body: unknown) => {
        const res = await restored.dispatchFetch('http://localhost/api/v1/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        return { status: res.status, ...await res.json() as any }
      }
      expect((await call(request)).data.id).toBe(group.data.id)
      expect((await call(creation(used.token))).status).toBe(403)
      const newGroup = await call(creation(available.token))
      expect(newGroup.status).toBe(200)
      expect((await restoredDB.prepare('SELECT used_group_id,revision FROM creation_invites WHERE token_hash=?').bind(createHash('sha256').update(available.token).digest('hex')).first<any>())).toEqual({ used_group_id: newGroup.data.id, revision: 1 })
    } finally { await restored.dispose(); rmSync(dir, { recursive: true, force: true }) }
  }, 30000)
})
