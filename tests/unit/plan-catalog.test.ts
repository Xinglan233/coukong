import {readFileSync} from 'node:fs'
import {expect,it} from 'vitest'
import type {EventData,EventPackage} from '../../shared/types'
import {validateResponse} from '../../shared/event-validation'
import {planCatalog,sessionArrangement,poiArrangement} from '../../src/online/activity/plan-catalog'

function event():EventData{return (JSON.parse(readFileSync('examples/convention-demo.v2.json','utf8')) as EventPackage).event}

it('计划来源限当前活动和所选日期，搜索覆盖真实活动名/地点/展位号',()=>{
 const e=event();e.extensions!.convention.pois[3].boothCode='A-03'
 expect(planCatalog(e,'2026-10-03','A-03').sessions.map(s=>s.sessionId)).toEqual(['demo-workshop-1003-01'])
 expect(planCatalog(e,'2026-10-03','手作').sessions.map(s=>s.start)).toEqual(['09:05','13:07'])
 expect(planCatalog(e,'2026-10-04','').sessions).toEqual([])
 e.extensions!.convention.pois[0].closed=true
 expect(planCatalog(e,'2026-10-03','').pois.some(p=>p.id==='poi-a')).toBe(false)
})

it('选择场次原样带时间/稳定ID和实际位置，保存/JSON往返不舍入',()=>{
 const e=event();e.activities[0].sessions[1].poiId='poi-d';e.extensions!.convention.pois[3].boothCode='A-03'
 const b=sessionArrangement(e,'demo-workshop-1003-02','new-busy')
 expect(b).toMatchObject({id:'new-busy',source:'session',sessionId:'demo-workshop-1003-02',title:'手作体验示例',date:'2026-10-03',start:'13:07',end:'13:52',location:'示例 A 区'})
 expect(JSON.parse(JSON.stringify(b))).toEqual(b)
 expect(validateResponse({name:'本人',presence:[],busy:[b],bufferMinutes:0},e).busy[0]).toEqual(b)
 expect(()=>sessionArrangement(e,'other-event-session','busy')).toThrow()
})

it('场次位置依次采用已公布场次位置、活动位置、实际地点/展位信息，不编位置',()=>{
 const e=event(),s=e.activities[0].sessions[0];s.location='官方场次地点'
 expect(sessionArrangement(e,s.id,'b').location).toBe('官方场次地点')
 delete s.location;delete e.activities[0].location;e.extensions!.convention.pois[3].boothCode='A-03'
 expect(sessionArrangement(e,s.id,'b').location).toBe('示例地点 D · A-03')
 delete s.poiId
 expect(sessionArrangement(e,s.id,'b').location).toBeUndefined()
})

it('选择无时间地点只带真实快照，不虚构分钟、不改收藏路线或权限合同',()=>{
 const e=event();e.extensions!.convention.pois[0].boothCode='A-01'
 const b=poiArrangement(e,'poi-a','2026-10-03','new-busy')
 expect(b).toEqual({id:'new-busy',source:'manual',date:'2026-10-03',title:'示例地点 A',location:'示例地点 A · A-01',start:'',end:''})
 expect(()=>validateResponse({name:'本人',presence:[],busy:[b],bufferMinutes:0},e)).toThrow()
 expect(()=>poiArrangement(e,'poi-a','2026-10-04','b')).toThrow()
 expect(()=>poiArrangement(e,'other-event-poi','2026-10-03','b')).toThrow()
 e.extensions!.convention.pois[0].closed=true
 expect(()=>poiArrangement(e,'poi-a','2026-10-03','b')).toThrow()
})
