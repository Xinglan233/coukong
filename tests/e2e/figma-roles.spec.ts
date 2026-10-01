import {settleTheme} from './figma-visual'
import {test,expect,type Page} from '@playwright/test'
import {mkdirSync} from 'node:fs'
import {publishFixture,tab,close} from './activity-fixture'

test('Figma同行接三独立身份：未提交不显示全员空闲，邀请和成员权限分开',async({browser})=>{
 test.setTimeout(120_000)
 const pack=await publishFixture(browser,'figma-roles')
 const contexts=await Promise.all([0,1,2].map(()=>browser.newContext({viewport:{width:390,height:900}})))
 const [leader,a,b]=await Promise.all(contexts.map(c=>c.newPage()))
 await leader.goto(`/events/${pack.event.id}?view=companions`)
 await expect(leader.locator('.figma-companions-entry')).toBeVisible()
 await leader.getByLabel('小队邀请链接').fill('123456');await leader.getByRole('button',{name:'加入',exact:true}).click();await expect(leader.getByRole('alert')).toContainText('完整邀请链接')
 await leader.getByRole('button',{name:'创建小队',exact:true}).click();await leader.getByLabel('小队标题').fill('真实三身份小队');await leader.getByLabel('站点创建码').fill('test-create');await leader.getByRole('button',{name:'确认创建',exact:true}).click()
 await leader.getByLabel('怎么称呼').fill('队长');await leader.getByRole('button',{name:'加入小队',exact:true}).click()
 await leader.getByRole('button',{name:'邀请队员',exact:true}).click();const invitation=await leader.getByLabel('邀请链接').inputValue();await close(leader)
 for(const [page,name] of [[a,'队员 A'],[b,'队员 B']] as const){await page.goto(invitation);await page.getByLabel('怎么称呼').fill(name);await page.getByRole('button',{name:'加入小队',exact:true}).click();await expect(page.getByRole('button',{name:'邀请队员',exact:true})).toHaveCount(0)}
 await leader.getByRole('button',{name:'凑空',exact:true}).click();await leader.getByRole('button',{name:'刷新',exact:true}).click();await expect(leader.getByText(/等待 .*队员 A.*队员 B.*提交/)).toBeVisible();await expect(leader.locator('.free-row')).toHaveCount(0)
 async function confirmTime(page:Page){await page.getByRole('button',{name:'日程',exact:true}).click();await page.getByRole('button',{name:/^我可以来/}).click();const d=page.getByRole('dialog');await d.getByRole('button',{name:'添加区间',exact:true}).click();await d.getByLabel('开始时间 1',{exact:true}).fill('13:07');await d.getByLabel('结束时间 1',{exact:true}).fill('13:52');await d.getByRole('button',{name:'完成',exact:true}).click();const reply=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().endsWith('/response'));await page.getByRole('button',{name:'提交',exact:true}).click();expect((await reply).status()).toBe(200)}
 for(const page of [leader,a,b])await confirmTime(page)
 await leader.getByRole('button',{name:'凑空',exact:true}).click();await leader.getByRole('button',{name:'刷新',exact:true}).click();await expect(leader.locator('.free-range').filter({hasText:'13:07–13:52'})).toBeVisible()
 await leader.getByRole('button',{name:'成员',exact:true}).click();await expect(leader.locator('.figma-crew-member')).toHaveCount(3);await expect(leader.locator('.figma-crew-member').filter({hasText:'未提交'})).toHaveCount(0)
 mkdirSync('/tmp/tongye-figma-product-roles',{recursive:true})
 for(const width of [375,390,430])for(const scheme of ['light','dark'] as const){await leader.setViewportSize({width,height:900});await settleTheme(leader,scheme);expect(await leader.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await leader.screenshot({animations:'disabled',path:`/tmp/tongye-figma-product-roles/companions-${width}-${scheme}.png`})}
 await tab(a,'同行');await a.getByRole('button',{name:'成员',exact:true}).click();await expect(a.getByRole('button',{name:'管理小队',exact:true})).toHaveCount(0);await expect(a.getByRole('button',{name:/^移除 队/})).toHaveCount(0)
 await Promise.all(contexts.map(c=>c.close()))
})
