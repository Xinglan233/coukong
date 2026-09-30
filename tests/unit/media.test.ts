import { describe,it,expect } from 'vitest'
import sharp from 'sharp'
import { sanitizeImage, boundedBytes } from '../../src/server/media-service'
const image=()=>sharp({create:{width:64,height:32,channels:3,background:'#336699'}})
describe('可信地图图像边界',()=>{
 it('拒绝伪 MIME、SVG、HTML、超限字节',async()=>{
  const png=await image().png().toBuffer()
  await expect(sanitizeImage(png,'image/jpeg')).rejects.toThrow(/类型/)
  await expect(sanitizeImage(Buffer.from('<svg/>'),'image/png')).rejects.toThrow()
  await expect(sanitizeImage(Buffer.from('<html>bad</html>'),'image/png')).rejects.toThrow()
  await expect(sanitizeImage(Buffer.alloc(12*1024*1024+1),'image/png')).rejects.toThrow(/12/)
 })
 it('拒绝超过24MP的图像且拒绝APNG控制块',async()=>{
  const huge=await sharp({create:{width:6000,height:4001,channels:3,background:'white'}}).png().toBuffer()
  await expect(sanitizeImage(huge,'image/png')).rejects.toThrow()
  const png=await image().png().toBuffer(),chunk=Buffer.alloc(20);chunk.writeUInt32BE(8);chunk.write('acTL',4);chunk.writeUInt32BE(2,8)
  await expect(sanitizeImage(Buffer.concat([png.subarray(0,33),chunk,png.subarray(33)]),'image/png')).rejects.toThrow(/动画/)
 })
 it('真实JPEG去EXIF且生成有界可读版本、源图哈希',async()=>{
  const source=await image().jpeg().withExif({IFD0:{Artist:'private location'}}).toBuffer()
  const sanitized=await sanitizeImage(source,'image/jpeg')
  expect(sanitized.width).toBe(64);expect(sanitized.height).toBe(32)
  expect((await sharp(sanitized.source).metadata()).exif).toBeUndefined()
  expect((await sharp(sanitized.display).metadata()).exif).toBeUndefined()
  expect(sanitized.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
  expect(sanitized.display.length).toBeLessThanOrEqual(3*1024*1024)
 })
 it('真实PNG/JPEG/WebP可用，非正方形保持比例且显示长边最多2048px',async()=>{
  for(const format of ['png','jpeg','webp'] as const){const source=await sharp({create:{width:3000,height:1500,channels:3,background:'#996633'}})[format]().toBuffer(),mime=format==='jpeg'?'image/jpeg':'image/'+format,result=await sanitizeImage(source,mime);expect(result.width).toBe(3000);expect(result.height).toBe(1500);expect(result.displayWidth).toBe(2048);expect(result.displayHeight).toBe(1024)}
  const raw=Buffer.alloc(64*64*3);raw.fill(255,64*32*3)
  const animation=await sharp(raw,{raw:{width:64,height:64,channels:3,pageHeight:32}}).webp({loop:0,delay:[100,100]}).toBuffer()
  await expect(sanitizeImage(animation,'image/webp')).rejects.toThrow(/动画/)
 })
 it('流无ContentLength也按实际字节中止',async()=>{
  const stream=new ReadableStream<Uint8Array>({start(c){c.enqueue(new Uint8Array(6));c.enqueue(new Uint8Array(6));c.close()}})
  await expect(boundedBytes(stream,10)).rejects.toThrow(/过大/)
 })
})

import { verifyVercelOIDC } from '../../worker/src/media'
import { generateKeyPairSync,sign } from 'node:crypto'
it('Vercel运行时证明验签且绑定issuer/audience/project/environment/expiry',async()=>{
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048}),now=Math.floor(Date.now()/1000)
 const settings={VERCEL_OIDC_ISSUER:'https://oidc.vercel.com/test',VERCEL_OIDC_AUDIENCE:'https://vercel.com/test',VERCEL_OIDC_SUBJECT:'owner:test:project:maps:environment:production'}
 const claims={iss:settings.VERCEL_OIDC_ISSUER,aud:settings.VERCEL_OIDC_AUDIENCE,sub:settings.VERCEL_OIDC_SUBJECT,iat:now,exp:now+7200}
 const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url'),jwt=(claim:unknown)=>{const input=encode({alg:'RS256',kid:'test-key'})+'.'+encode(claim);return input+'.'+sign('RSA-SHA256',Buffer.from(input),privateKey).toString('base64url')}
 const fetcher=async()=>new Response(JSON.stringify({keys:[{...publicKey.export({format:'jwk'}),kid:'test-key',alg:'RS256',use:'sig'}]}))
 const request=(token:string)=>new Request('https://api.invalid',{headers:{'X-Vercel-OIDC-Token':token}})
 await expect(verifyVercelOIDC(request(jwt(claims)),settings,fetcher as typeof fetch)).resolves.toBeUndefined()
 for(const change of [{sub:'owner:test:project:other:environment:production'},{sub:'owner:test:project:maps:environment:preview'},{iss:'https://evil.invalid'},{aud:'another'},{exp:now-1}])await expect(verifyVercelOIDC(request(jwt({...claims,...change})),settings,fetcher as typeof fetch)).rejects.toThrow()
 const valid=jwt(claims);await expect(verifyVercelOIDC(request(valid.slice(0,-10)+'aaaaaaaaaa'),settings,fetcher as typeof fetch)).rejects.toThrow()
})
