import {previewAdminSave} from './ui-helpers'
import {API_BASE} from './api-base'
import {test,expect,type Browser,type Page,type APIRequestContext} from '@playwright/test'
import {readFileSync,mkdirSync} from 'node:fs'
import type {EventPackage} from '../../shared/types'
const evidence='/tmp/tongye-activity-user-evidence';mkdirSync(evidence,{recursive:true})
export async function close(page:Page){await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0)}
export async function tab(page:Page,name:string){await page.locator('.tabbar').getByRole('button',{name,exact:true}).click()}
export async function imageFixture(page:Page){await page.route('**/api/media/read?**',route=>route.fulfill({contentType:'image/png',body:readFileSync('examples/assets/convention-demo.png')}))}
export async function publishFixture(browser:Browser,suffix:string,base=process.env.TONGYE_E2E_BASE_URL||'http://localhost:5173',customize?:(pack:EventPackage)=>void){const context=await browser.newContext(),page=await context.newPage();const pack=JSON.parse(readFileSync('examples/convention-demo.v2.json','utf8')) as EventPackage;pack.event.id=`ui-activity-${suffix}`;pack.event.title=`虚构活动视觉验收-${suffix}`;customize?.(pack);pack.event.extensions!.convention.pois[0].tags=['手作','角色','测试标签'];await imageFixture(page);await page.goto(base+'/admin');await page.getByLabel('管理员密码').fill('a'.repeat(64));let login=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/admin/session'));await page.getByRole('button',{name:'进入管理'}).click();let response=await login;if(response.status()===429){test.setTimeout(test.info().timeout+65000);await new Promise(resolve=>setTimeout(resolve,60000-Date.now()%60000+150));login=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/admin/session'));await page.getByRole('button',{name:'进入管理'}).click();response=await login}expect(response.status()).toBe(200);await page.getByRole('button',{name:'新建活动',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'导入或导出活动文件'}).click();await page.getByLabel('或粘贴 JSON').fill(JSON.stringify(pack));await page.getByRole('button',{name:'校验并使用'}).click();await previewAdminSave(page);await page.getByRole('button',{name:'确认保存'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect((await page.request.post(`${API_BASE}/__e2e/seed-fixture?eventId=${pack.event.id}`)).status()).toBe(200);await page.getByRole('button',{name:new RegExp(pack.event.title)}).click();await page.getByRole('dialog').getByLabel('活动状态').selectOption('published');await previewAdminSave(page);await page.getByRole('button',{name:'确认保存'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await page.setViewportSize({width:390,height:900});await page.screenshot({animations:'disabled',path:`${evidence}/admin-${suffix}.png`});await context.close();return pack}
export async function enter(page:Page,pack:EventPackage,base=process.env.TONGYE_E2E_BASE_URL||'http://localhost:5173'){await imageFixture(page);await page.goto(base+'/');await page.locator('.activity-list-group').getByRole('button',{name:new RegExp(pack.event.title)}).click();await expect(page.locator('.tabbar').getByRole('button',{name:'探索',exact:true})).toBeVisible();if((page.viewportSize()?.width||0)<900)await page.getByRole('button',{name:'列表',exact:true}).click()}
export async function save(page:Page){const accepted=page.waitForResponse(r=>r.request().method()==='PUT'&&/\/personal\//.test(r.url()));await page.getByRole('button',{name:'保存个人计划',exact:true}).click();expect((await accepted).status()).toBe(200);await expect(page.locator('p[role=status]')).toContainText('已保存到云端')}

export async function loginAdmin(page:Page){
 await page.getByLabel('管理员密码').fill('a'.repeat(64))
 const login=()=>page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/admin/session'))
 let pending=login();await page.getByRole('button',{name:'进入管理'}).click();let response=await pending
 if(response.status()===429){
  test.setTimeout(test.info().timeout+65_000)
  const wait=Math.min(60_000,60_000-Date.now()%60_000+150)
  console.log('隔离管理员登录达到真实限流，等待当前分钟窗口结束后重试一次')
  await new Promise(resolve=>setTimeout(resolve,wait))
  pending=login();await page.getByRole('button',{name:'进入管理'}).click();response=await pending
 }
 expect(response.status()).toBe(200)
}

// Respect the production authentication limiter; do not weaken it for the test run.
export async function adminSession(request:APIRequestContext,sessionToken:string){
 const body={rootToken:'a'.repeat(64),sessionToken};let reply=await request.post(`${API_BASE}/api/v1/admin/session`,{data:body});
 if(reply.status()===429){await new Promise(resolve=>setTimeout(resolve,60000-Date.now()%60000+100));reply=await request.post(`${API_BASE}/api/v1/admin/session`,{data:body})}
 expect(reply.status()).toBe(200);return reply;
}
