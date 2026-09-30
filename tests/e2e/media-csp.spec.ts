import {test,expect} from '@playwright/test'
import {readFileSync} from 'node:fs'
// Exercise the deployed CSP path rule in Chromium. The body is isolated; no Blob write is made.
test('CSP允许官方Blob实际带斜线端点并拒绝其他来源',async({page})=>{
 const config=JSON.parse(readFileSync('vercel.json','utf8'));const policy=config.headers[0].headers.find((h:{key:string})=>h.key==='Content-Security-Policy').value;
 await page.route('**/__media-csp-proof',r=>r.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':policy},body:'<!doctype html><html><body>隔离CSP路径测试</body></html>'}));
 await page.route('https://vercel.com/api/blob/**',r=>r.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:'{"isolated":true}'}));
 await page.route('https://example.invalid/**',r=>r.fulfill({body:'must not be reachable'}));await page.goto('/__media-csp-proof');
 const result=await page.evaluate(async()=>{const violations:string[]=[];document.addEventListener('securitypolicyviolation',e=>violations.push(e.effectiveDirective));let allowed=false;try{allowed=(await (await fetch('https://vercel.com/api/blob/?pathname=isolated')).json()).isolated===true}catch{}let denied=false;try{await fetch('https://example.invalid/')}catch{denied=true}await new Promise(r=>setTimeout(r,100));return {allowed,denied,violations}});
 expect(result.allowed).toBe(true);expect(result.denied).toBe(true);expect(result.violations).toEqual(['connect-src']);
})
