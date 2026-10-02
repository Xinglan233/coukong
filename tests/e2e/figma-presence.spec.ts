import {mkdirSync} from 'node:fs'
import {settleTheme} from './figma-visual'
import {test,expect} from '@playwright/test'
import {publishFixture,enter,tab,close,save} from './activity-fixture'

test('Figma在场Sheet：分钟、多时段、步长、未保存编辑恢复及显式不能参加',async({browser})=>{
 test.setTimeout(120_000)
 const pack=await publishFixture(browser,'presence-v11'),context=await browser.newContext({viewport:{width:390,height:900}}),page=await context.newPage()
 await enter(page,pack);await tab(page,'计划')
 const entry=page.getByRole('button',{name:/本日在场时间/})
 await expect(entry).toContainText('尚未确认，点此设置')
 let puts=0;page.on('request',r=>{if(r.method()==='PUT'&&r.url().includes('/personal/'))puts++})
 await entry.click();let d=page.getByRole('dialog',{name:/在场时间/})
 await d.getByLabel('开始时间 1',{exact:true}).fill('13:07');await d.getByLabel('结束时间 1',{exact:true}).fill('13:52')
 await d.getByRole('button',{name:'5 分',exact:true}).click();await expect(d.getByLabel('开始时间 1',{exact:true})).toHaveValue('13:07')
 await d.getByRole('button',{name:'开始时间 1推迟5分钟',exact:true}).click();await expect(d.getByLabel('开始时间 1',{exact:true})).toHaveValue('13:12')
 await d.getByRole('button',{name:'开始时间 1提前5分钟',exact:true}).click()
 await close(page)
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.get;(window as any).restorePresenceRead=()=>{IDBObjectStore.prototype.get=original};IDBObjectStore.prototype.get=function(key){if(typeof key==='string'&&key.startsWith('personal-presence-editor:'))throw new DOMException('隔离读取失败夹具','UnknownError');return original.call(this,key)}})
 await entry.click();d=page.getByRole('dialog',{name:/在场时间/});await expect(d.getByRole('alert')).toContainText('本机草稿未能读取');await expect(d.getByRole('button',{name:'保存',exact:true})).toBeDisabled();await close(page);await page.evaluate(()=>(window as any).restorePresenceRead())
 await page.reload();await entry.click();d=page.getByRole('dialog',{name:/在场时间/})
 await expect(d.getByLabel('开始时间 1',{exact:true})).toHaveValue('13:07');await expect(d.getByLabel('结束时间 1',{exact:true})).toHaveValue('13:52')
 mkdirSync('/tmp/tongye-figma-presence-v11',{recursive:true});for(const width of [375,390,430])for(const scheme of ['light','dark'] as const){await page.setViewportSize({width,height:900});await settleTheme(page,scheme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({animations:'disabled',path:`/tmp/tongye-figma-presence-v11/sheet-${width}-${scheme}.png`})}
 await d.getByRole('button',{name:'添加时段',exact:true}).click();await d.getByLabel('开始时间 2',{exact:true}).fill('23:55');await d.getByLabel('结束时间 2',{exact:true}).fill('24:00')
 await d.getByRole('button',{name:'保存',exact:true}).click();await expect(d).toHaveCount(0);await expect(entry).toContainText('13:07–13:52');await expect(entry).toContainText('23:55–24:00');expect(puts).toBe(0)
 await save(page);await page.reload();await expect(entry).toContainText('13:07–13:52');await page.screenshot({animations:'disabled',path:'/tmp/tongye-figma-presence-v11/plan-430-dark.png'})
 await entry.click();d=page.getByRole('dialog',{name:/在场时间/});await d.getByRole('button',{name:'不能参加',exact:true}).click();await d.getByRole('button',{name:'保存',exact:true}).click();await expect(entry).toContainText('不能参加')
 await save(page);await page.reload();await expect(entry).toContainText('不能参加');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await context.close()
})


test('个人在场摘要在成功保存并刷新后显示云端状态，不冒充小队确认',async({browser})=>{
 const pack=await publishFixture(browser,'presence-cloud-state'),context=await browser.newContext(),page=await context.newPage()
 await enter(page,pack);await tab(page,'计划')
 const entry=page.getByRole('button',{name:/本日在场时间/})
 await entry.click();const d=page.getByRole('dialog',{name:/在场时间/})
 await d.getByLabel('开始时间 1',{exact:true}).fill('13:07');await d.getByLabel('结束时间 1',{exact:true}).fill('13:52')
 await d.getByRole('button',{name:'保存',exact:true}).click()
 await expect(entry).toContainText('未保存到云端')
 await save(page);await expect(entry).toContainText('已保存到云端');await expect(entry).not.toContainText('已确认')
 await page.reload();await expect(entry).toContainText('已保存到云端');await context.close()
})

test('不能参加的空回复与上次在场时段分开保存，刷新取消不恢复参与',async({browser})=>{
 test.setTimeout(120_000)
 const pack=await publishFixture(browser,'presence-absent-memory',undefined,pack=>{pack.event.endDate='2026-10-04';pack.event.days.push({date:'2026-10-04',openIntervals:[{start:'10:00',end:'18:00'}]})}),context=await browser.newContext(),page=await context.newPage()
 await enter(page,pack);await tab(page,'计划');const entry=page.getByRole('button',{name:/本日在场时间/})
 await entry.click();let d=page.getByRole('dialog',{name:/在场时间/})
 await d.getByLabel('开始时间 1',{exact:true}).fill('13:07');await d.getByLabel('结束时间 1',{exact:true}).fill('13:52')
 await d.getByRole('button',{name:'添加时段',exact:true}).click();await d.getByLabel('开始时间 2',{exact:true}).fill('17:03');await d.getByLabel('结束时间 2',{exact:true}).fill('17:49')
 // First save creates the personal identity while the editor changes storage scope.
 await d.getByRole('button',{name:'不能参加',exact:true}).click();await d.getByRole('button',{name:'保存',exact:true}).click();const absentSaved=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().includes('/personal/'));await save(page);expect((await absentSaved).request().postDataJSON().plan.response.presence[0].intervals).toEqual([]);await page.reload()
 await expect(entry).toContainText('不能参加');await entry.click();d=page.getByRole('dialog',{name:/在场时间/})
 await expect(d.getByRole('button',{name:'不能参加',exact:true})).toHaveAttribute('aria-pressed','true')
 await d.getByRole('button',{name:'在场',exact:true}).click()
 await expect(d.getByLabel('开始时间 1',{exact:true})).toHaveValue('13:07');await expect(d.getByLabel('结束时间 1',{exact:true})).toHaveValue('13:52')
 await expect(d.getByLabel('开始时间 2',{exact:true})).toHaveValue('17:03');await expect(d.getByLabel('结束时间 2',{exact:true})).toHaveValue('17:49')
 await close(page);await page.reload();await expect(entry).toContainText('不能参加')
 const response=await page.evaluate(async eventId=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('coukong-online-v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return await new Promise<any>((resolve,reject)=>{const r=db.transaction('records').objectStore('records').get(`activity-personal:${eventId}`);r.onsuccess=()=>resolve(r.result.plan.response);r.onerror=()=>reject(r.error)})},pack.event.id)
 expect(response.presence[0].intervals).toEqual([])
 await page.locator('.day-strip').getByRole('button',{name:'10/04',exact:true}).click();await entry.click();d=page.getByRole('dialog',{name:/在场时间/});await expect(d.getByLabel('开始时间 1',{exact:true})).toHaveValue('10:00');await expect(d.getByLabel('开始时间 2',{exact:true})).toHaveCount(0);await close(page);await page.locator('.day-strip').getByRole('button',{name:'10/03',exact:true}).click()
 await entry.click();d=page.getByRole('dialog',{name:/在场时间/});await d.getByRole('button',{name:'在场',exact:true}).click();await d.getByRole('button',{name:'保存',exact:true}).click();await save(page);await page.reload()
 await expect(entry).toContainText('13:07–13:52');await expect(entry).toContainText('17:03–17:49')
 const other=await browser.newContext(),otherPage=await other.newPage();await enter(otherPage,pack);await tab(otherPage,'计划');await otherPage.getByRole('button',{name:/本日在场时间/}).click();await expect(otherPage.getByLabel('开始时间 1',{exact:true})).toHaveValue('09:00');await expect(otherPage.getByLabel('开始时间 2',{exact:true})).toHaveCount(0)
 await other.close();await context.close()
})
