import {test,expect,type Page} from '@playwright/test'
import {mkdirSync} from 'node:fs'
import {settleTheme} from './figma-visual'
import {publishFixture,loginAdmin,close} from './activity-fixture'

test('V18真实长建队码：管理员生成复制、队长一次建队、历史状态与撤销',async({browser})=>{
 test.setTimeout(180_000)
 const pack=await publishFixture(browser,'creation-invite-ui')
 const adminContext=await browser.newContext({permissions:['clipboard-read','clipboard-write'],viewport:{width:390,height:900}})
 const leaderContext=await browser.newContext({permissions:['clipboard-read','clipboard-write'],viewport:{width:375,height:900}})
 const admin=await adminContext.newPage(),leader=await leaderContext.newPage()
 await admin.goto('/admin');await loginAdmin(admin);await admin.getByRole('button',{name:new RegExp(pack.event.title)}).click()
 await admin.getByRole('button',{name:'建队码',exact:true}).click()
 const issued=admin.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/admin/creation-invites'))
 await admin.getByRole('button',{name:'生成建队码',exact:true}).click();expect((await issued).status()).toBe(200)
 await admin.getByRole('button',{name:'复制长文字码',exact:true}).click()
 const code=await admin.evaluate(()=>navigator.clipboard.readText());expect(code).toMatch(/^[a-f0-9]{64}$/)
 const directory='/tmp/tongye-meet-private/creation-invites-checkpoint/v18-ui-screens';mkdirSync(directory,{recursive:true})
 async function screen(label:string,page:Page){for(const width of [375,390,430,1440])for(const theme of ['light','dark'] as const){await page.setViewportSize({width,height:900});await settleTheme(page,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`${directory}/${label}-${width}-${theme}.png`,animations:'disabled',mask:[page.getByLabel('新建队码'),page.getByLabel('建队码',{exact:true}),page.getByLabel('管理恢复链接')]})}}
 await screen('admin-code',admin)
 await leader.goto(`/events/${pack.event.id}?view=companions`)
 await expect(leader.getByRole('button',{name:'创建',exact:true})).toBeDisabled()
 await leader.getByLabel('建队码',{exact:true}).fill(code);await leader.getByLabel('小队标题',{exact:true}).fill('真实文字码小队')
 await screen('create',leader)
 const accepted=leader.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/groups'))
 await leader.getByRole('button',{name:'创建',exact:true}).click();expect((await accepted).status()).toBe(200)
 await leader.getByLabel('怎么称呼').fill('队长');await leader.getByRole('button',{name:'加入小队',exact:true}).click()
 await leader.getByRole('button',{name:'邀请队员',exact:true}).click();const dialog=leader.getByRole('dialog',{name:'管理小队'})
 await expect(dialog.locator('svg[width="180"]')).toHaveCount(0)
 await expect(dialog.getByLabel('邀请链接')).toHaveCount(0)
 await screen('manager',leader)
 await dialog.getByRole('button',{name:'复制链接',exact:true}).click();const invite=await leader.evaluate(()=>navigator.clipboard.readText());expect(invite).toContain('#invite=')
 await dialog.getByRole('button',{name:'更换成员邀请',exact:true}).click();await expect(leader.getByRole('dialog',{name:'更换邀请链接'})).toBeVisible()
 await leader.getByRole('button',{name:'取消',exact:true}).click();await expect(dialog).toBeVisible();await close(leader)
 await close(admin);await admin.getByRole('button',{name:new RegExp(pack.event.title)}).click();await admin.getByRole('button',{name:'建队码',exact:true}).click()
 await expect(admin.locator('.creation-invite-history').getByText('已使用',{exact:true})).toBeVisible();await expect(admin.locator('.creation-invite-history')).not.toContainText(code)
 await admin.getByRole('button',{name:'生成建队码',exact:true}).click();await expect(admin.getByRole('button',{name:'撤销该码',exact:true}).first()).toBeVisible()
 await admin.getByRole('button',{name:'复制长文字码',exact:true}).click();const revokedCode=await admin.evaluate(()=>navigator.clipboard.readText())
 await admin.getByRole('button',{name:'撤销该码',exact:true}).first().click();await expect(admin.getByRole('dialog',{name:'撤销建队码'})).toBeVisible()
 await admin.getByRole('button',{name:'取消',exact:true}).click();await expect(admin.getByRole('button',{name:'撤销该码',exact:true}).first()).toBeVisible()
 await admin.getByRole('button',{name:'撤销该码',exact:true}).first().click();const revoked=admin.waitForResponse(r=>r.request().method()==='DELETE'&&r.url().includes('/admin/creation-invites/'))
 await admin.getByRole('button',{name:'确认撤销',exact:true}).click();expect((await revoked).status()).toBe(200)
 await expect(admin.locator('.creation-invite-history').getByText('已撤销',{exact:true})).toBeVisible()
 const outsider=await browser.newContext(),other=await outsider.newPage();await other.goto(`/events/${pack.event.id}?view=companions`);await other.getByLabel('小队标题').fill('被拒绝的小队');await other.getByLabel('建队码',{exact:true}).fill(code)
 await other.getByRole('button',{name:'创建',exact:true}).click();await expect(other.getByRole('alert')).toContainText('已被使用')
 await other.getByLabel('建队码',{exact:true}).fill(revokedCode);await other.getByRole('button',{name:'创建',exact:true}).click();await expect(other.getByRole('alert')).toContainText('已被撤销');await outsider.close()
 expect(await leader.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await Promise.all([adminContext.close(),leaderContext.close()])
})

test('管理员发码响应丢失后同操作重试，不重复签发；复制失败不显示成功',async({browser})=>{
 const pack=await publishFixture(browser,'creation-response-loss'),context=await browser.newContext(),page=await context.newPage()
 await page.goto('/admin');await loginAdmin(page);await page.getByRole('button',{name:new RegExp(pack.event.title)}).click();await page.getByRole('button',{name:'建队码',exact:true}).click()
 const requests:unknown[]=[];let dropped=false
 await page.route('**/admin/creation-invites',async route=>{if(route.request().method()!=='POST')return route.continue();requests.push(route.request().postDataJSON());const response=await route.fetch();expect(response.status()).toBe(200);if(!dropped){dropped=true;return route.abort('failed')}await route.fulfill({response})})
 await page.getByRole('button',{name:'生成建队码',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('连接失败');await expect(page.getByLabel('新建队码')).toHaveCount(0)
 await page.getByRole('button',{name:'生成建队码',exact:true}).click();await expect(page.getByLabel('新建队码')).toBeVisible();expect(requests).toHaveLength(2);expect(requests[1]).toEqual(requests[0]);await expect(page.locator('.figma-code-history-row')).toHaveCount(1)
 await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('test clipboard denied')}}})})
 await page.getByRole('button',{name:'复制长文字码',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('复制失败');await expect(page.getByText('建队码已复制',{exact:true})).toHaveCount(0)
 await close(page);await page.getByRole('button',{name:new RegExp(pack.event.title)}).click();await page.getByRole('button',{name:'建队码',exact:true}).click();await expect(page.getByLabel('新建队码')).toHaveCount(0);await expect(page.locator('.figma-code-history-row')).toHaveCount(1);await context.close()
})

test('创建中离开同行页不被晚到响应拉回，小队恢复权限仍保存',async({browser})=>{
 const pack=await publishFixture(browser,'creation-leave-pending'),context=await browser.newContext(),page=await context.newPage()
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve});let observed!:()=>void;const written=new Promise<void>(resolve=>{observed=resolve})
 await page.route('**/api/v1/groups',async route=>{if(route.request().method()!=='POST')return route.continue();const response=await route.fetch();expect(response.status()).toBe(200);observed();await gate;await route.fulfill({response})})
 await page.goto(`/events/${pack.event.id}?view=companions`);await page.getByLabel('建队码',{exact:true}).fill('test-create');await page.getByLabel('小队标题').fill('晚到创建的小队');await page.getByRole('button',{name:'创建',exact:true}).click();await written
 try{await expect(page.getByRole('button',{name:'创建中',exact:true})).toBeDisabled();await expect(page.getByLabel('建队码',{exact:true})).toBeDisabled();await page.locator('.tabbar').getByRole('button',{name:'我的',exact:true}).click()}finally{release()}
 await expect(page.getByRole('heading',{name:'我的',exact:true})).toBeVisible();await expect(page.getByLabel('怎么称呼')).toHaveCount(0)
 await expect.poll(()=>page.evaluate(()=>location.search)).toContain('view=me')
 await page.locator('.tabbar').getByRole('button',{name:'同行',exact:true}).click();await expect(page.getByRole('button',{name:'晚到创建的小队',exact:true})).toBeVisible();await context.close()
})
