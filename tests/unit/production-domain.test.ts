import { readFileSync } from 'node:fs'
import type { IncomingMessage } from 'node:http'
import { describe, expect, it } from 'vitest'
import worker from '../../worker/src/index'
import { checkOrigin } from '../../src/server/media-service'

const production = JSON.parse(readFileSync('worker/wrangler.production.jsonc', 'utf8'))
const staging = JSON.parse(readFileSync('worker/wrangler.staging.jsonc', 'utf8'))
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
  rewrites: { source: string; destination: string; has?: { type: string; value: string }[] }[]
}
const productionHosts = ['coukong.vercel.app', 'tongye-meet-xinglan233s-projects.vercel.app', 'meet.tongye.ink']
function apiDestination(host: string) {
  return vercel.rewrites.find(rule => rule.source === '/api/v1/:path*' &&
    (rule.has || []).every(condition => condition.type === 'host' && condition.value === host))?.destination
}

describe('正式域名与预览环境隔离', () => {
  it('新域名可通过正式Worker写入预检', async () => {
    const response = await worker.fetch(new Request('https://worker.invalid/api/v1/events', {
      method: 'OPTIONS', headers: { Origin: 'https://meet.tongye.ink', 'Access-Control-Request-Method': 'PUT' }
    }), { ...production.vars, DB: undefined as never })
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://meet.tongye.ink')
  })
  for (const host of productionHosts) it(`${host}读取正式API且允许携带身份的写入预检`, async () => {
    expect(apiDestination(host)).toBe('https://tongye-meet-api.xinglan233.workers.dev/api/v1/:path*')
    const origin = `https://${host}`
    const response = await worker.fetch(new Request('https://worker.invalid/api/v1/events', {
      method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'authorization,content-type' }
    }), { ...production.vars, DB: undefined as never })
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin)
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('PUT')
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization')
  })

  it('未知、预览及相似域名不会转到正式API或获得正式CORS权限', async () => {
    for (const host of ['tongye-meet-preview-xinglan233s-projects.vercel.app', 'other.tongye.ink', 'meet.tongye.ink.evil.invalid']) {
      expect(apiDestination(host)).toBe('https://tongye-meet-api-staging.xinglan233.workers.dev/api/v1/:path*')
      const response = await worker.fetch(new Request('https://worker.invalid/api/v1/events', {
        method: 'OPTIONS', headers: { Origin: `https://${host}` }
      }), { ...production.vars, DB: undefined as never })
      expect(response.status).toBe(403)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
    }
  })

  it('测试Worker不接受正式自定义域名', async () => {
    const response = await worker.fetch(new Request('https://worker.invalid/api/v1/events', {
      method: 'OPTIONS', headers: { Origin: 'https://meet.tongye.ink' }
    }), { ...staging.vars, DB: undefined as never })
    expect(response.status).toBe(403)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('正式Worker拒绝HTTP来源，不允许明文携带权限凭据', async () => {
    const response = await worker.fetch(new Request('https://worker.invalid/api/v1/events', {
      method: 'OPTIONS', headers: { Origin: 'http://meet.tongye.ink' }
    }), { ...production.vars, DB: undefined as never })
    expect(response.status).toBe(403)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('图片写入口接受新域名同源请求并拒绝跨域伪造', () => {
    const request = (origin: string, host: string, site = 'same-origin') => ({
      headers: { origin, host, 'sec-fetch-site': site }
    }) as unknown as IncomingMessage
    expect(() => checkOrigin(request('https://meet.tongye.ink', 'meet.tongye.ink'))).not.toThrow()
    expect(() => checkOrigin(request('https://evil.invalid', 'meet.tongye.ink'))).toThrow()
    expect(() => checkOrigin(request('https://meet.tongye.ink', 'meet.tongye.ink', 'cross-site'))).toThrow()
  })
})
