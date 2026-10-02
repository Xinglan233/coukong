import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseEventPackage, parseStrictJSON, validateResponse } from '../../shared/event-validation'
const read = (name: string) => readFileSync(name, 'utf8')
const demo = () => parseEventPackage(read('examples/event-demo.json'))
describe('活动包结构与业务合同', () => {
  for (const file of readdirSync('examples').filter(f => f.endsWith('.json'))) it(`有效示例 ${file} 无损回导`, () => {
    const p = parseEventPackage(read(`examples/${file}`))
    expect(parseEventPackage(JSON.stringify(p))).toEqual(p)
  })
  for (const file of readdirSync('tests/fixtures/invalid')) it(`拒绝错误夹具 ${file}`, () => expect(() => parseEventPackage(read(`tests/fixtures/invalid/${file}`))).toThrow())
  it('日期真实性、时区、多余权限字段、总量与DST限制', () => {
    for (const mutate of [
      (p: ReturnType<typeof demo>) => { p.event.startDate = '2026-02-30' },
      (p: ReturnType<typeof demo>) => { p.event.timezone = 'fake/timezone' },
      (p: ReturnType<typeof demo>) => { Object.assign(p, { adminToken: 'evil' }) },
      (p: ReturnType<typeof demo>) => { p.event.activities.push(structuredClone(p.event.activities[0])) },
      (p: ReturnType<typeof demo>) => { p.event.timezone = 'America/New_York'; p.event.startDate = p.event.endDate = p.event.days[0].date = '2026-11-01'; p.event.activities = [] },
    ]) { const p = demo(); mutate(p); expect(() => parseEventPackage(JSON.stringify(p))).toThrow() }
  })
  it('并行场次合法，分钟数据不取整，24:00只允许结束', () => {
    const p = demo(); const a = structuredClone(p.event.activities[0]); a.id = 'parallel'; a.sessions.forEach(s => { s.id += '-parallel' }); p.event.activities.push(a)
    expect(parseEventPackage(JSON.stringify(p)).event.activities[0].sessions[1]).toMatchObject({start:'13:07',end:'13:52'})
    p.event.days[0].openIntervals[1].end = '24:00'; expect(() => parseEventPackage(JSON.stringify(p))).not.toThrow()
    p.event.days[0].openIntervals[1].start = '24:00'; expect(() => parseEventPackage(JSON.stringify(p))).toThrow()
  })
  it('严格JSON拒绝注释、尾逗号、重复键、过深与超量', () => {
    for (const s of ['{"x":1,"x":2}', '{"x":1,}', '//x\n{}', '['.repeat(34)+'0'+']'.repeat(34), ' '.repeat(512*1024+1)]) expect(() => parseStrictJSON(s)).toThrow()
    expect(parseStrictJSON('{"__proto__":{"x":1}}')).toHaveProperty('__proto__')
  })
  it('本人回复严格校验，空确认有效，篡改场次快照拒绝', () => {
    const p = demo(), r = { name: '成员', presence: [], busy: [], bufferMinutes: 0 }
    expect(validateResponse(r, p.event)).toEqual(r)
    expect(() => validateResponse({...r, admin:true}, p.event)).toThrow()
    expect(() => validateResponse({...r, busy:[{id:'a',date:'2026-10-03',start:'13:07',end:'13:52',title:'体验',source:'session',sessionId:'wrong'}]}, p.event)).toThrow()
  })
})
