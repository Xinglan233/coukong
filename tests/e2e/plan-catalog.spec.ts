import {test,expect} from '@playwright/test'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {API_BASE} from './api-base'
import {adminSession,tab,close,save} from './activity-fixture'
import {download} from './ui-helpers'
import type {EventPackage} from '../../shared/types'

test('真实公布场次带准确日期分钟与位置，跨日进入正确日程且收藏路线不联动',async({page,request})=>{
 const pack=JSON.parse(readFileSync('examples/event-demo.json','utf8')) as EventPackage
 pack.event.id='catalog-session-'+randomUUID();pack.event.title='来源选择隔离场次验收'
 pack.event.endDate='2026-10-04';pack.event.days.push({date:'2026-10-04',openIntervals:[{start:'13:00',end:'18:00'}]})
 pack.event.activities[0].sessions[1].date='2026-10-04'
 const token='b'.repeat(64);await adminSession(request,token)
 const published=await request.post(`${API_BASE}/api/v1/admin/events`,{headers:{Authorization:'Bearer '+token},data:{eventPackage:pack,status:'published',expectedRevision:0,operationId:randomUUID()}})
 expect(published.status()).toBe(200)
 await page.goto('/events/'+pack.event.id)
 await page.locator('.sched-row').filter({hasText:'13:07'}).click()
 await expect(page.getByRole('dialog')).toContainText('2026-10-04 13:07–13:52')
 await page.getByRole('button',{name:'加入个人安排',exact:true}).click()
 await expect(page.getByRole('dialog')).toHaveCount(0)
 await expect(page.locator('.day-strip [aria-pressed=true]')).toHaveText('10/04')
 await expect(page.locator('.figma-plan-timeline')).toContainText('13:07–13:52')
 await save(page);await page.reload()
 await expect(page.locator('.figma-plan-timeline')).toContainText('13:07–13:52')
 await tab(page,'我的');await page.getByRole('button',{name:'恢复与导出',exact:true}).click()
 const backup=JSON.parse(await download(page,'导出个人计划'))
 expect(backup.plan.response.busy).toHaveLength(1)
 expect(backup.plan.response.busy[0]).toMatchObject({source:'session',sessionId:'demo-workshop-1003-02',date:'2026-10-04',start:'13:07',end:'13:52',title:'手作体验示例',location:'示例 A 区'})
 expect(backup.plan.favorites).toEqual([]);expect(backup.plan.routes).toEqual([])
 await close(page);await tab(page,'活动');await page.locator('.sched-row').filter({hasText:'13:07'}).click();await page.getByRole('button',{name:'加入个人安排',exact:true}).click()
 await tab(page,'我的');await page.getByRole('button',{name:'恢复与导出',exact:true}).click()
 expect(JSON.parse(await download(page,'导出个人计划')).plan.response.busy).toHaveLength(1)
})
