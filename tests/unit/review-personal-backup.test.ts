import {it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {personalBackup,readPersonalBackup} from '../../src/online/activity/activity-tools'
import type {ActivityDTO,PersonalPlan} from '../../shared/activity-contract'

const activity:ActivityDTO={id:'migrated-template',revision:1,scheduleRevision:0,spatialRevision:0,status:'published',updatedAt:'2026-10-02T00:00:00Z',eventPackage:JSON.parse(readFileSync('examples/event-minimal.json','utf8'))}
const plan:PersonalPlan={response:{name:'本人',presence:[],busy:[{id:'minute-a',date:'2026-10-03',start:'13:07',end:'13:52',title:'分钟安排',source:'manual'}],bufferMinutes:0},favorites:[],routes:[]}
it('0005迁移的revision 0活动可无损导出回导，不舍入分钟',()=>{const raw=JSON.stringify(personalBackup(activity,plan,'person-a'));expect(readPersonalBackup(raw,activity,'person-a',plan)).toEqual(plan)})
it('revision 0兼容不放宽负数、非整数、身份、活动和当前版本门禁',()=>{const backup=personalBackup(activity,plan,'person-a');for(const change of [{scheduleRevision:-1},{spatialRevision:-1},{spatialRevision:.5},{scheduleRevision:'0'},{personId:'person-b'},{eventId:'event-b'},{scheduleRevision:1},{spatialRevision:1}])expect(()=>readPersonalBackup(JSON.stringify({...backup,...change}),activity,'person-a',plan)).toThrow()})
