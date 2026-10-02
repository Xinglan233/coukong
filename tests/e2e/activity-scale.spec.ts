import {test,expect} from '@playwright/test'
import {randomBytes,randomUUID} from 'node:crypto'
import {mkdirSync,writeFileSync} from 'node:fs'
import {performance} from 'node:perf_hooks'
import {scalePackage} from '../../scripts/measure-activity-scale'
import {API_BASE} from './api-base'
import {adminSession,imageFixture,close} from './activity-fixture'

test('千地点场次实际浏览器缩放筛选与键盘详情，375/390/430/桌面不横向溢出',async({browser,request})=>{
 test.setTimeout(90000)
 const pack=scalePackage();pack.event.id='ui-activity-scale-browser';const token=randomBytes(32).toString('hex');await adminSession(request,token)
 const headers={Authorization:'Bearer '+token}
 const draft=await request.post(`${API_BASE}/api/v1/admin/events`,{headers,data:{eventPackage:pack,status:'draft',expectedRevision:0,operationId:randomUUID()}});expect(draft.status()).toBe(200)
 expect((await request.post(`${API_BASE}/__e2e/seed-fixture?eventId=${pack.event.id}`)).status()).toBe(200)
 const publish=await request.post(`${API_BASE}/api/v1/admin/events`,{headers,data:{eventPackage:pack,status:'published',expectedRevision:1,operationId:randomUUID()}});expect(publish.status()).toBe(200)
 const directory='/tmp/tongye-activity-scale-browser';mkdirSync(directory,{recursive:true})
 const measurements:unknown[]=[]
 for(const width of [375,390,430,1440]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();await imageFixture(page)
  const start=performance.now();await page.goto(`/events/${pack.event.id}`);await expect(page.locator('svg image')).toHaveAttribute('href',/^blob:/);await expect(page.locator('[data-poi]')).toHaveCount(1000);const readyMs=performance.now()-start
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  const zoom=performance.now();await page.getByRole('button',{name:'放大地图',exact:true}).click();await page.getByRole('button',{name:'放大地图',exact:true}).click();await expect(page.locator('svg text').first()).toBeVisible();const zoomMs=performance.now()-zoom
  const filter=performance.now();await page.getByLabel('搜索地点',{exact:true}).fill('虚构地点999');await expect(page.locator('[data-poi]')).toHaveCount(1);const filterMs=performance.now()-filter
  const detail=performance.now();await page.locator('[data-poi="p999"]').focus();await page.locator('[data-poi="p999"]').press('Enter');await expect(page.getByRole('dialog')).toContainText('虚构地点999');const detailMs=performance.now()-detail
  await close(page);await page.getByLabel('搜索地点',{exact:true}).fill('');await expect(page.locator('[data-poi]')).toHaveCount(1000);await page.getByRole('button',{name:'回到全图',exact:true}).click();await page.screenshot({path:`${directory}/map-${width}.png`,animations:'disabled'})
  measurements.push({width,height:900,markers:1000,sessions:1000,readyMs,zoomMs,filterMs,keyboardDetailMs:detailMs,wholePageOverflow:false});await context.close()
 }
 writeFileSync(`${directory}/measurements.json`,JSON.stringify({scope:'Real local Chromium plus isolated Worker/D1; repository fictional PNG fixture, no Blob upload or physical mobile-device/Cloudflare CPU claims',createdAt:new Date().toISOString(),measurements},null,2),{mode:0o600})
})
