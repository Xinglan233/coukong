/** Isolated real-preview drill. Inputs and credentials remain in private Mac files. */
import {chromium,expect,type Page} from '@playwright/test'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import type {EventPackage} from '../shared/types'
const accessFile=process.env.TONGYE_PREVIEW_ACCESS_FILE,secretFile=process.env.TONGYE_DRILL_SECRET_FILE
if(!accessFile||!secretFile)throw new Error('Set private preview-access and staging-secret file paths')
const access=JSON.parse(readFileSync(accessFile,'utf8')) as {url:string;deploymentUrl:string;expiresAt:string}
const base=new URL(access.deploymentUrl).origin
if(!base.endsWith('-xinglan233s-projects.vercel.app')||!new URL(access.url).searchParams.has('_vercel_share')||Date.parse(access.expiresAt)<=Date.now())throw new Error('Valid scoped temporary preview access required')
const rootSecret=JSON.parse(readFileSync(secretFile,'utf8')).ADMIN_ROOT_SECRET as string
if(!rootSecret)throw new Error('Staging administrator secret missing')
const output=process.env.TONGYE_DRILL_OUTPUT||'/tmp/tongye-meet-private/activity-cloud-evidence';mkdirSync(output,{recursive:true,mode:0o700})
const id='cloud-media-drill-'+randomUUID(),title='虚构活动：图片与个人计划演练'
const report={deployment:base,eventId:id,startedAt:new Date().toISOString(),checks:[] as string[],result:'running',error:''}
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE})
const contexts=await Promise.all([390,375,430].map(width=>browser.newContext({viewport:{width,height:900},serviceWorkers:'allow'})))
const [admin,a,b]=await Promise.all(contexts.map(c=>c.newPage()))
const close=async(p:Page)=>p.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click()
const tab=async(p:Page,name:string)=>p.locator('.tabbar').getByRole('button',{name,exact:true}).click()
const save=async(p:Page)=>{const reply=p.waitForResponse(r=>r.request().method()==='PUT'&&/\/personal\//.test(r.url()));await p.getByRole('button',{name:'保存个人计划',exact:true}).click();expect((await reply).status()).toBe(200);await expect(p.locator('p[role=status]')).toContainText('已保存到云端')}
try{
 for(const page of [admin,a,b])await page.goto(access.url)
 await admin.goto(base+'/admin');await admin.getByLabel('管理员密码').fill(rootSecret);await admin.getByRole('button',{name:'进入管理',exact:true}).click()
 const pack=JSON.parse(readFileSync('examples/convention-demo.v2.json','utf8')) as EventPackage
 pack.event.id=id;pack.event.title=title;pack.assetManifest=[];pack.event.extensions!.convention.maps=[];pack.event.extensions!.convention.routingGraphs=[]
 pack.event.extensions!.convention.pois.forEach(p=>{delete p.position;delete p.routeNodeId})
 await admin.getByRole('button',{name:'新建活动',exact:true}).click();await admin.getByRole('dialog').getByRole('button',{name:'导入或导出活动文件'}).click();await admin.getByLabel('或粘贴 JSON').fill(JSON.stringify(pack));await admin.getByRole('button',{name:'校验并使用'}).click();await admin.getByRole('button',{name:'预览保存'}).click();await admin.getByRole('button',{name:'确认保存'}).click();await expect(admin.getByRole('dialog')).toHaveCount(0)
 report.checks.push('Administrator visibly imported and persisted an explicitly fictional draft in remote staging D1')
 await admin.getByRole('button',{name:new RegExp(title)}).click();await admin.locator('summary').filter({hasText:'地图与通道'}).click();await admin.locator('summary').filter({hasText:'上传或替换地图'}).click();await admin.getByLabel('地图名称',{exact:true}).fill('虚构地图测试');await admin.getByLabel('地图来源与授权').fill('项目隔离测试样例；不代表真实园区或官方通道')
 await admin.getByLabel('地图文件',{exact:true}).setInputFiles('examples/assets/convention-demo.png');await expect(admin.getByText('地图已上传，请预览并保存活动资料。',{exact:true})).toBeVisible({timeout:90000})
 report.checks.push('Browser directly uploaded a real PNG to private staging Blob; Node processed it and activated remote D1 metadata')
 await admin.getByLabel('活动状态').selectOption('published');await admin.getByRole('button',{name:'预览保存'}).click();await admin.getByRole('button',{name:'确认保存'}).click();await expect(admin.getByRole('dialog')).toHaveCount(0)
 for(const [page,name] of [[a,'个人甲'],[b,'个人乙']] as const){await page.goto(base+'/');await page.getByRole('button',{name:new RegExp(title)}).click();await expect(page.getByRole('group',{name:'活动地图，可平移与缩放'})).toBeVisible();await expect(page.locator('svg image')).toHaveAttribute('href',/^blob:/);await tab(page,'我的');await page.getByLabel('个人称呼').fill(name);await tab(page,'计划');await page.getByRole('button',{name:'安排',exact:true}).click();await page.getByRole('button',{name:'手动添加',exact:true}).click();await page.getByRole('dialog').getByLabel('活动名').fill(name+'分钟安排');await page.getByRole('dialog').getByLabel('开始时间',{exact:true}).fill('13:07');await page.getByRole('dialog').getByLabel('结束时间',{exact:true}).fill('13:52');await page.getByRole('dialog').getByRole('button',{name:'保存安排',exact:true}).click();await save(page);await page.reload();await page.getByRole('button',{name:'安排',exact:true}).click();await expect(page.locator('.sched-row').filter({hasText:name+'分钟安排'})).toContainText('13:07');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
 report.checks.push('Two independent anonymous identities read the real Blob image and saved/reloaded exact 13:07–13:52 through Vercel UI and remote D1')
 await a.screenshot({path:output+'/personal-plan-375.png',animations:'disabled'});await b.screenshot({path:output+'/personal-plan-430.png',animations:'disabled'})
 await tab(a,'我的');await a.getByRole('button',{name:'恢复与导出'}).click();const download=a.waitForEvent('download');await a.getByRole('button',{name:'导出个人计划',exact:true}).click();const exported=JSON.parse(readFileSync((await (await download).path())!,'utf8'));expect(exported.plan.response.busy[0]).toMatchObject({start:'13:07',end:'13:52'});expect(JSON.stringify(exported)).not.toMatch(/Bearer|personalToken|adminToken/);await close(a)
 report.checks.push('Personal export preserved minutes and excluded access credentials')
 report.result='passed'
}catch(e){report.result='failed';report.error=(e instanceof Error?e.message:String(e)).replaceAll(rootSecret,'[redacted]').replaceAll(access.url,'[private preview link]').replace(/_vercel_share=[^\s"&]+/g,'_vercel_share=[redacted]').replace(/[a-f0-9]{64}/g,'[redacted]');process.exitCode=1}
finally{writeFileSync(output+'/result.json',JSON.stringify({...report,finishedAt:new Date().toISOString()},null,2),{mode:0o600});await Promise.all(contexts.map(c=>c.close()));await browser.close();console.log(JSON.stringify({result:report.result,checks:report.checks.length,evidence:output+'/result.json'}))}
