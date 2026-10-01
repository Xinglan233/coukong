import {API_BASE} from './api-base'
import {test,expect} from '@playwright/test'
import {readFileSync} from 'node:fs'
import {randomUUID,createHash} from 'node:crypto'
import {publishFixture,tab,adminSession} from './activity-fixture'
// Fixed isolated PNGs + real local Worker/D1. This does not prove production Blob uploads.
test('同一图片键新旧版本不能混合底图和位置',async({browser,request})=>{test.setTimeout(120000);
 const pack=await publishFixture(browser,'image-identity'),old=await browser.newContext({viewport:{width:390,height:900}}),page=await old.newPage(),reads:string[]=[];
 const a=readFileSync('examples/assets/convention-demo.png'),b=readFileSync('tests/fixtures/maps/version-b.png');
 await page.route('**/api/media/read?**',route=>{const id=new URL(route.request().url()).searchParams.get('assetId')||'';reads.push(id);return route.fulfill({contentType:'image/png',body:id.endsWith('-b')?b:a})});
 // enter installs the ordinary fixture reader; replace it with the explicit version reader.
 await page.goto('/');await page.getByRole('button',{name:new RegExp(pack.event.title)}).click();await expect(page.locator('svg image')).toHaveAttribute('href',/^blob:/);
 const hashImage=()=>page.locator('svg image').evaluate(async e=>{const bytes=await (await fetch(e.getAttribute('href')!)).arrayBuffer();return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('')});
 expect(await hashImage()).toBe(createHash('sha256').update(a).digest('hex'));const poi=pack.event.extensions!.convention.pois[0];await expect(page.locator(`[data-poi="${poi.id}"] circle`)).toHaveAttribute('cx',String(poi.position!.x*2000));await tab(page,'我的');
 const token='d'.repeat(64);await adminSession(request,token);const headers={Authorization:'Bearer '+token};
 const asset=(await (await request.post(`${API_BASE}/__e2e/seed-fixture?eventId=${pack.event.id}&variant=b`)).json()).data;
 const next=structuredClone(pack);Object.assign(next.assetManifest![0],{sha256:asset.sha256,sizeBytes:asset.sizeBytes});next.event.extensions!.convention.maps[0].revision=2;next.event.extensions!.convention.maps[0].needsReview=true;
 const draft=await request.post(`${API_BASE}/api/v1/admin/events`,{headers,data:{eventPackage:next,status:'draft',expectedRevision:2,operationId:randomUUID()}});expect(draft.ok()).toBe(true);
 const before=reads.length;await tab(page,'探索');await expect(page.getByText(/地图版本与活动资料不一致/)).toBeVisible();await expect(page.locator('svg image')).toHaveCount(0);expect(reads.slice(before)).not.toContain(asset.id);
 next.event.extensions!.convention.maps[0].needsReview=false;for(const p of next.event.extensions!.convention.pois)if(p.position){p.position.mapRevision=2;if(p.id===poi.id)p.position.x=.6}for(const g of next.event.extensions!.convention.routingGraphs){g.mapRevision=2;g.revision++;}
 const publish=await request.post(`${API_BASE}/api/v1/admin/events`,{headers,data:{eventPackage:next,status:'published',expectedRevision:3,operationId:randomUUID()}});expect(publish.ok()).toBe(true);
 // B is now genuinely public; the old browser still holds the v1 ActivityDTO.
 const visibleAssets=await request.get(`${API_BASE}/api/v1/events/${pack.event.id}/assets`);expect(visibleAssets.ok()).toBe(true);expect((await visibleAssets.json()).data.map((x:{id:string})=>x.id)).toContain(asset.id);await tab(page,'我的');const afterPublishReads=reads.length;await tab(page,'探索');await expect(page.getByText(/地图版本与活动资料不一致/)).toBeVisible();await expect(page.locator('svg image')).toHaveCount(0);expect(reads.slice(afterPublishReads)).not.toContain(asset.id);
 const fresh=await browser.newContext({viewport:{width:390,height:900}}),newPage=await fresh.newPage(),newReads:string[]=[];await newPage.route('**/api/media/read?**',route=>{const id=new URL(route.request().url()).searchParams.get('assetId')||'';newReads.push(id);return route.fulfill({contentType:'image/png',body:id===asset.id?b:a})});await newPage.goto('/');await newPage.getByRole('button',{name:new RegExp(pack.event.title)}).click();await expect(newPage.locator('svg image')).toHaveAttribute('href',/^blob:/);expect(newReads).toContain(asset.id);await expect(newPage.locator(`[data-poi="${poi.id}"] circle`)).toHaveAttribute('cx','1200');expect(await newPage.locator('svg image').evaluate(async e=>{const bytes=await (await fetch(e.getAttribute('href')!)).arrayBuffer();return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('')})).toBe(createHash('sha256').update(b).digest('hex'));await fresh.close();await old.close();
})
