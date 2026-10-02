import {test,expect} from '@playwright/test'
import {create,presence,submit} from './ui-helpers'

test('活动选择页粘贴真实邀请后，独立队员可加入并提交分钟时间',async({browser})=>{
 const leader=await browser.newContext(),owner=await leader.newPage()
 const invitation=await create(owner,'Figma入口隔离验收')
 const guest=await browser.newContext({viewport:{width:390,height:900}}),page=await guest.newPage()
 await page.goto('/')
 await page.getByLabel('小队邀请链接').fill(invitation)
 await page.getByRole('button',{name:'进入',exact:true}).click()
 await expect(page.getByLabel('怎么称呼')).toBeVisible()
 expect(new URL(page.url()).hash).toBe('')
 await page.getByLabel('怎么称呼').fill('独立队员')
 await page.getByRole('button',{name:'加入小队',exact:true}).click()
 await presence(page,'13:07','13:52')
 await submit(page)
 await page.reload()
 await expect(page.getByRole('button',{name:/本日在场时间/})).toContainText('13:07–13:52')
 await guest.close();await leader.close()
})
