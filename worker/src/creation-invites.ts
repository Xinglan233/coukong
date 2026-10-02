import { loadPublicActivity, type ActivityContext } from './activity'
import type { CreationInviteDTO } from '../../shared/creation-invites'

type Row = Record<string, any>
export function creationInviteDTO(row: Row): CreationInviteDTO {
 return { id: row.id, eventId: row.event_id, eventTitle: row.event_title, maxUses: 1, usedCount: row.used_group_id ? 1 : 0,
  status: row.used_group_id ? 'used' : row.revoked_at ? 'revoked' : Date.parse(row.expires_at) <= Date.now() ? 'expired' : 'available',
  createdAt: row.created_at, expiresAt: row.expires_at, usedGroupId: row.used_group_id, revision: row.revision }
}
export async function handleCreationInvites(ctx: ActivityContext, reservedHashes: string[]) {
 const { DB, path, method, authHash, now } = ctx
 if (path !== '/admin/creation-invites' && !/^\/admin\/creation-invites\/[^/]+$/.test(path)) return { handled: false }
 await ctx.admin()
 const first = (sql: string, ...args: any[]) => DB.prepare(sql).bind(...args).first<Row>()
 if (path === '/admin/creation-invites' && method === 'GET') {
  const url = new URL(ctx.req.url), offset = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 50)
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000 || !Number.isInteger(limit) || limit < 1 || limit > 100) ctx.fail('INVALID_REQUEST', '分页范围无效')
  const eventId=url.searchParams.get('eventId')
  if(eventId!==null&&!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(eventId))ctx.fail('INVALID_REQUEST','活动标识无效')
  const rows=eventId===null?await DB.prepare('SELECT * FROM creation_invites ORDER BY created_at DESC,id LIMIT ? OFFSET ?').bind(limit,offset).all<Row>():await DB.prepare('SELECT * FROM creation_invites WHERE event_id=? ORDER BY created_at DESC,id LIMIT ? OFFSET ?').bind(eventId,limit,offset).all<Row>()
  return { handled: true, data: rows.results.map(creationInviteDTO) }
 }
 if (path === '/admin/creation-invites' && method === 'POST') {
  await ctx.limited('creation-invite:' + authHash, 30)
  const b = await ctx.body()
  if (Object.keys(b).some(k => !['token', 'operationId', 'eventId', 'ttlHours'].includes(k))) ctx.fail('INVALID_REQUEST', '建队码不接受额外权限或次数设置')
  const tokenHash = await ctx.hash(ctx.token(b.token)), operation = ctx.op(b.operationId), digest = await ctx.hash(JSON.stringify(b))
  if (typeof b.eventId !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(b.eventId)) ctx.fail('INVALID_REQUEST', '请选择一个公开活动')
  const hours = b.ttlHours === undefined ? 24 : b.ttlHours
  if (!Number.isInteger(hours) || hours < 1 || hours > 168) ctx.fail('INVALID_REQUEST', '有效期须为1–168小时')
  const prior = await first('SELECT * FROM creation_invites WHERE admin_hash=? AND create_op=?', authHash, operation)
  if (prior) { if (prior.create_digest !== digest) ctx.fail('VERSION_CONFLICT', '同一操作内容发生变化', 409); return { handled: true, data: creationInviteDTO(prior) } }
  // Do not turn another known capability or secret into a creation capability.
  const collision = await first('SELECT 1 AS found WHERE EXISTS(SELECT 1 FROM admin_sessions WHERE hash=?) OR EXISTS(SELECT 1 FROM groups WHERE manager_hash=? OR invite_hash=?) OR EXISTS(SELECT 1 FROM members WHERE token_hash=?) OR EXISTS(SELECT 1 FROM personal_plans WHERE token_hash=?) OR EXISTS(SELECT 1 FROM personal_tombstones WHERE token_hash=?) OR EXISTS(SELECT 1 FROM events WHERE owner_hash=?)', tokenHash, tokenHash, tokenHash, tokenHash, tokenHash, tokenHash, tokenHash)
  if (reservedHashes.includes(tokenHash) || collision) ctx.fail('INVALID_CAPABILITY', '建队码必须独立生成，不能复用其他密码或恢复码')
  const activity = await loadPublicActivity(DB, b.eventId)
  if (!activity || activity.status !== 'published') ctx.fail('EVENT_UNAVAILABLE', '活动未公开发布，不能生成建队码', 409)
  const id = crypto.randomUUID(), expires = new Date(Date.parse(now) + hours * 3600000).toISOString()
  const result = await DB.prepare("INSERT INTO creation_invites(id,token_hash,event_id,event_title,admin_hash,create_op,create_digest,created_at,expires_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM admin_sessions WHERE hash=? AND expires_at>?) AND EXISTS(SELECT 1 FROM events e JOIN event_versions v ON v.event_id=e.id AND v.revision=e.public_revision WHERE e.id=? AND e.visibility='public' AND v.status='published') ON CONFLICT DO NOTHING")
   .bind(id, tokenHash, b.eventId, activity!.eventPackage.event.title, authHash, operation, digest, now, expires, authHash, Date.now(), b.eventId).run()
  if (!result.meta.changes) {
   const replay = await first('SELECT * FROM creation_invites WHERE admin_hash=? AND create_op=?', authHash, operation)
   if (replay?.create_digest === digest) return { handled: true, data: creationInviteDTO(replay) }
   ctx.fail('VERSION_CONFLICT', '操作、建队码、活动或管理员会话已变化', 409)
  }
  return { handled: true, data: creationInviteDTO((await first('SELECT * FROM creation_invites WHERE id=?', id))!) }
 }
 const match = path.match(/^\/admin\/creation-invites\/([^/]+)$/)
 if (match && method === 'DELETE') {
  await ctx.limited('creation-invite-revoke:' + authHash, 60)
  const b = await ctx.body(), operation = ctx.op(b.operationId), digest = await ctx.hash(JSON.stringify(b))
  if (Object.keys(b).some(k => !['operationId', 'expectedRevision'].includes(k)) || !Number.isInteger(b.expectedRevision) || b.expectedRevision < 0) ctx.fail('INVALID_REQUEST', '需要当前建队码版本')
  const row = await first('SELECT * FROM creation_invites WHERE id=?', match[1])
  if (!row) ctx.fail('NOT_FOUND', '建队码不存在', 404)
  if (row!.revoke_op === operation) { if (row!.revoke_digest !== digest) ctx.fail('VERSION_CONFLICT', '同一撤销操作内容发生变化', 409); return { handled: true, data: creationInviteDTO(row!) } }
  const result = await DB.prepare("UPDATE creation_invites SET revoked_at=?,revoke_op=?,revoke_digest=?,revision=revision+1 WHERE id=? AND revision=? AND used_group_id IS NULL AND revoked_at IS NULL AND EXISTS(SELECT 1 FROM admin_sessions WHERE hash=? AND expires_at>?)").bind(now, operation, digest, match[1], b.expectedRevision, authHash, Date.now()).run()
  if (!result.meta.changes) {
   const replay = await first('SELECT * FROM creation_invites WHERE id=?', match[1])
   if (replay?.revoke_op === operation && replay.revoke_digest === digest) return { handled: true, data: creationInviteDTO(replay) }
   ctx.fail('VERSION_CONFLICT', '建队码已使用、已撤销或版本已变化', 409)
  }
  return { handled: true, data: creationInviteDTO((await first('SELECT * FROM creation_invites WHERE id=?', match[1]))!) }
 }
 ctx.fail('NOT_FOUND', '接口不存在', 404)
}
