import {test,expect,type Page} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {API_BASE} from './api-base'
import {tab} from './activity-fixture'
import type {PersonalCapability,PersonalDTO} from '../../shared/activity-contract'
import type {PersonalDraft} from '../../src/online/activity/personal-state'

async function records(page:Page,eventId:string){return page.evaluate(async id=>{const path='/src/online/storage.ts',s=await import(path);return{cap:await s.readLocal('activity-cap:'+id),owner:await s.readLocal('activity-owner:'+id),draft:await s.readLocal('activity-personal:'+id)}},eventId) as Promise<{cap:PersonalCapability;owner:{token:string};draft:PersonalDraft}>}
async function createPrivate(page:Page){await page.goto('/create?personal=1');await page.getByLabel('活动名称').fill('恢复入口隔离活动');await page.getByLabel('站点创建码').fill('test-create');await page.getByRole('button',{name:'确认创建',exact:true}).click();await expect(page).toHaveURL(/\/events\/[^/?#]+/);const id=new URL(page.url()).pathname.split('/')[2];await expect.poll(async()=>!!(await records(page,id)).cap?.personId).toBe(true);await tab(page,'我的');await expect(page.locator('p[role=status]')).toContainText('已保存到云端');await page.evaluate(async id=>{const path='/src/online/storage.ts',s=await import(path),draft=await s.readLocal('activity-personal:'+id);await s.writeLocal('activity-personal:'+id,{...draft,dirty:true,generation:draft.generation+1,plan:{...draft.plan,response:{...draft.plan.response,busy:[{id:'retained-minute',source:'manual',title:'保留的分钟草稿',date:'2026-10-03',start:'13:07',end:'13:52'}]}}})},id);return id}

test('错误、已删除个人恢复和错误owner链接保留原本机有效能力与分钟草稿',async({page})=>{
 test.setTimeout(90000);const id=await createPrivate(page),before=await records(page,id)
 const restore=async(fragment:string)=>{await page.goto('about:blank');await page.goto(`/events/${id}#${fragment}`);await expect.poll(()=>new URL(page.url()).hash).toBe('');await expect.poll(async()=>JSON.stringify((await records(page,id)).cap)).toBe(JSON.stringify(before.cap));await expect.poll(async()=>JSON.stringify((await records(page,id)).owner)).toBe(JSON.stringify(before.owner));const after=await records(page,id);expect(after.draft).toEqual(before.draft);await tab(page,'计划');await expect(page.getByText('保留的分钟草稿',{exact:true})).toBeVisible()}
 await restore(`personal=${'d'.repeat(64)}&personId=${before.cap.personId}`)
 const created=await page.request.post(`${API_BASE}/api/v1/events/${id}/personal`,{headers:{Authorization:'Bearer '+before.owner.token},data:{personalToken:'e'.repeat(64),operationId:randomUUID(),name:'已删除隔离身份'}});expect(created.status()).toBe(200);const personal=(await created.json()).data as PersonalDTO
 const deleted=await page.request.delete(`${API_BASE}/api/v1/events/${id}/personal/${personal.id}`,{headers:{Authorization:'Bearer '+ 'e'.repeat(64)},data:{expectedRevision:personal.revision,operationId:randomUUID()}});expect(deleted.status()).toBe(200)
 await restore(`personal=${'e'.repeat(64)}&personId=${personal.id}`)
 await restore(`owner=${'f'.repeat(64)}`)
 await restore(`owner=${before.cap.token}`)
})

test('合法本人和owner恢复先验证资源再保存，成功立即清理fragment',async({page})=>{
 test.setTimeout(90000);const id=await createPrivate(page),before=await records(page,id)
 await page.evaluate(async id=>{const path='/src/online/storage.ts',s=await import(path);await s.removeLocal('activity-cap:'+id);await s.removeLocal('activity-owner:'+id)},id)
 await page.goto('about:blank');await page.goto(`/events/${id}#personal=${before.cap.token}&personId=${before.cap.personId}&owner=${before.owner.token}`);await expect.poll(()=>new URL(page.url()).hash).toBe('');await expect.poll(async()=>((await records(page,id)).cap?.personId)).toBe(before.cap.personId);const after=await records(page,id);expect(after.cap.token).toBe(before.cap.token);expect(after.owner).toEqual(before.owner);expect(after.draft).toEqual(before.draft);await tab(page,'我的');await expect(page.getByRole('button',{name:'编辑活动资料',exact:true})).toBeVisible();await tab(page,'计划');await expect(page.getByText('保留的分钟草稿',{exact:true})).toBeVisible()
})

test('活动文件选择器接受512KiB到1MiB的合法v2，v1仍保留512KiB限制',async({page})=>{
 const v2=readFileSync('examples/convention-demo.v2.json','utf8'),v1=readFileSync('examples/event-minimal.json','utf8'),pad=' '.repeat(600*1024)
 await page.goto('/create');await page.getByRole('button',{name:'导入活动文件',exact:true}).click();await page.getByLabel('上传 JSON').setInputFiles({name:'valid-large-v2.json',mimeType:'application/json',buffer:Buffer.from(pad+v2)})
 await expect.poll(()=>page.getByLabel('或粘贴 JSON').inputValue().then(value=>value.length)).toBe((pad+v2).length);await page.getByRole('button',{name:'预览',exact:true}).click();await expect(page.getByRole('heading',{name:'虚构漫展地图与通道示例',exact:true})).toBeVisible()
 await page.getByLabel('上传 JSON').setInputFiles({name:'too-large-v1.json',mimeType:'application/json',buffer:Buffer.from(pad+v1)});await expect.poll(()=>page.getByLabel('或粘贴 JSON').inputValue().then(value=>value.length)).toBe((pad+v1).length);await page.getByRole('button',{name:'预览',exact:true}).click();await expect(page.getByRole('alert')).toContainText('v1文件不能超过512KiB')
 await page.getByLabel('上传 JSON').setInputFiles({name:'over-limit.json',mimeType:'application/json',buffer:Buffer.alloc(1024*1024+1,32)});await expect(page.getByRole('alert')).toContainText('1 MiB')
})
