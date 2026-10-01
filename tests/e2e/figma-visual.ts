import {expect,type Page} from '@playwright/test'

export async function settleTheme(page:Page,scheme:'light'|'dark'){
 await page.emulateMedia({colorScheme:scheme})
 await expect(page.locator('html')).toHaveAttribute('data-theme',scheme)
 await expect.poll(()=>page.evaluate(()=>document.getAnimations().filter(animation=>animation.constructor.name==='CSSTransition'&&animation.playState==='running').length)).toBe(0)
 // Theme variables change immediately, while shared button backgrounds transition.
 // Capture the settled rendered state rather than a light/dark transition frame.
 await expect.poll(()=>page.evaluate(()=>{
  const buttons=Array.from(document.querySelectorAll('.btn-surface'))
  const hex=getComputedStyle(document.documentElement).getPropertyValue('--surface').trim()
  if(!/^#[a-f\d]{6}$/i.test(hex))return false
  const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ')
  return buttons.every(button=>getComputedStyle(button).backgroundColor===`rgb(${rgb})`)
 })).toBe(true)
 await expect.poll(()=>page.evaluate(()=>{
  const selected=document.querySelector('.figma-shell>.tabbar .on');if(!selected)return true
  const hex=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
  const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ')
  return getComputedStyle(selected).backgroundColor===`rgb(${rgb})`
 })).toBe(true)
}
