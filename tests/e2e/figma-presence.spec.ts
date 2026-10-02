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
 await close(page);await page.reload();await entry.click();d=page.getByRole('dialog',{name:/在场时间/})
 await expect(d.getByLabel('开始时间 1',{exact:true})).toHaveValue('13:07');await expect(d.getByLabel('结束时间 1',{exact:true})).toHaveValue('13:52')
 mkdirSync('/tmp/tongye-figma-presence-v11',{recursive:true});for(const width of [375,390,430])for(const scheme of ['light','dark'] as const){await page.setViewportSize({width,height:900});await settleTheme(page,scheme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({animations:'disabled',path:`/tmp/tongye-figma-presence-v11/sheet-${width}-${scheme}.png`})}
 await d.getByRole('button',{name:'添加时段',exact:true}).click();await d.getByLabel('开始时间 2',{exact:true}).fill('23:55');await d.getByLabel('结束时间 2',{exact:true}).fill('24:00')
 await d.getByRole('button',{name:'保存',exact:true}).click();await expect(d).toHaveCount(0);await expect(entry).toContainText('13:07–13:52');await expect(entry).toContainText('23:55–24:00');expect(puts).toBe(0)
 await save(page);await page.reload();await expect(entry).toContainText('13:07–13:52');await page.screenshot({animations:'disabled',path:'/tmp/tongye-figma-presence-v11/plan-430-dark.png'})
 await entry.click();d=page.getByRole('dialog',{name:/在场时间/});await d.getByRole('button',{name:'不能参加',exact:true}).click();await d.getByRole('button',{name:'保存',exact:true}).click();await expect(entry).toContainText('不能参加')
 await save(page);await page.reload();await expect(entry).toContainText('不能参加');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await context.close()
})
