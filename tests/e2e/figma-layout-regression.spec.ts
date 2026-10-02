import {test,expect} from '@playwright/test'
import {mkdirSync} from 'node:fs'
import {publishFixture,imageFixture,tab} from './activity-fixture'
import {settleTheme} from './figma-visual'

test('普通入口不展示管理或帮助，底栏与我的文字遵守Figma对齐',async({browser})=>{
 test.setTimeout(120_000)
 const pack=await publishFixture(browser,'layout-regression'),context=await browser.newContext(),page=await context.newPage()
 const evidence=process.env.TONGYE_LAYOUT_EVIDENCE||'/tmp/tongye-figma-layout-after'
 mkdirSync(evidence,{recursive:true})
 await imageFixture(page)
 await page.goto('/')
 expect.soft(await page.getByRole('button',{name:'管理员入口',exact:true}).count()).toBe(0)
 expect.soft(await page.getByRole('button',{name:'帮助',exact:true}).count()).toBe(0)
 const invitationSpacing=await page.locator('.figma-private-entry>.page-sub').evaluate(note=>{
  const form=note.parentElement!.querySelector('form')!,style=getComputedStyle(note)
  return {gap:note.getBoundingClientRect().top-form.getBoundingClientRect().bottom,bottom:style.marginBottom}
 })
 expect(invitationSpacing.gap).toBeGreaterThanOrEqual(8)
 expect(invitationSpacing.bottom).toBe('24px')
 await page.goto(`/events/${pack.event.id}`)
 for(const width of [375,390,430,1440])for(const scheme of ['light','dark'] as const){
  await page.setViewportSize({width,height:900});await settleTheme(page,scheme)
  for(const name of ['探索','计划','同行','我的']){
   await tab(page,name)
   if(name==='计划'){
    await expect(page.getByText('个人计划不要求先加入小队',{exact:true})).toHaveCount(0)
    const contrast=await page.locator('.plan-add').evaluate(button=>{
     const luminance=(value:string)=>{
      const rgb=value.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4)
      return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722
     }
     const text=luminance(getComputedStyle(button).color),background=luminance(getComputedStyle(document.body).backgroundColor)
     return (Math.max(text,background)+.05)/(Math.min(text,background)+.05)
    })
    expect.soft(contrast,`${width}/${scheme}手动添加文字可读`).toBeGreaterThanOrEqual(4.5)
    if(scheme==='dark'){
     const selected=await page.locator('.day-strip .on').evaluate(button=>{
      const luminance=(value:string)=>{
       const rgb=value.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4)
       return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722
      }
      const style=getComputedStyle(button),text=luminance(style.color),background=luminance(style.backgroundColor)
      return {background,contrast:(Math.max(text,background)+.05)/(Math.min(text,background)+.05),pressed:button.getAttribute('aria-pressed')}
     })
     expect.soft(selected.background,`${width}深色日期不形成整条亮白底`).toBeLessThan(.1)
     expect.soft(selected.contrast,`${width}选中日期文字可读`).toBeGreaterThanOrEqual(4.5)
     expect.soft(selected.pressed).toBe('true')
    }
    await page.screenshot({animations:'disabled',path:`${evidence}/plan-${width}-${scheme}.png`})
   }
   const geometry=await page.locator('.tabbar').evaluate(nav=>{
    const n=nav.getBoundingClientRect(),b=nav.querySelector('.on')!.getBoundingClientRect()
    return {top:b.top-n.top,bottom:n.bottom-b.bottom,height:b.height}
   })
   expect.soft(geometry.top,`${width}/${scheme}/${name}顶部留在栏内`).toBeGreaterThanOrEqual(0)
   expect.soft(geometry.bottom,`${width}/${scheme}/${name}底部留在栏内`).toBeGreaterThanOrEqual(0)
   expect.soft(geometry.height).toBe(52)
  }
  const labels=await page.locator('.figma-settings-row .me-row-label').evaluateAll(es=>es.map(e=>({left:e.getBoundingClientRect().left,textAlign:getComputedStyle(e).textAlign})))
  expect.soft(new Set(labels.map(e=>Math.round(e.left))).size,`${width}/${scheme}文字在同一左边线`).toBe(1)
  expect.soft(labels.every(e=>e.textAlign==='left')).toBe(true)
  expect.soft(await page.getByRole('button',{name:/^(管理员入口|帮助|活动资料格式)$/}).count()).toBe(0)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({animations:'disabled',path:`${evidence}/my-${width}-${scheme}.png`})
 }
 await page.goto('/create');await expect(page.getByRole('link',{name:/帮助|新手上路|格式说明/})).toHaveCount(0)
 await page.goto('/admin');await expect(page.getByLabel('管理员密码')).toBeVisible()
 await page.goto('/help/');await expect(page.locator('.help-shell')).toBeVisible()
 await context.close()
})
