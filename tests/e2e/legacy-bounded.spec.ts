import {test,expect} from '@playwright/test'
import LZ from 'lz-string'
test('legacy worker accepts minute payload and rejects expansion bomb without blocking page',async({page})=>{
 await page.goto('/help')
 const payload={v:1,name:'旧朋友',days:['10-03'],bookings:[{id:'b',day:'10-03',start:'13:07',end:'13:52',title:'私密',source:'manual'}],generatedAt:1}
 const values=[LZ.compressToEncodedURIComponent(JSON.stringify(payload)),LZ.compressToEncodedURIComponent(JSON.stringify({...payload,name:'a'.repeat(600000)}))]
 const decoded=await page.evaluate(async(values)=>{
  const {decodePayload}=await import('/src/lib/codec.ts')
  return Promise.all(values.map(v=>decodePayload(v)))
 },values)
 expect(decoded[0]).toEqual(payload);expect(decoded[1]).toBeNull()
 await expect(page.locator('body')).toBeVisible()
})
