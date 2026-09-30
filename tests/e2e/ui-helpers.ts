import type {Page,Locator} from '@playwright/test'
/** Reveal optional UI through real summary clicks; never mutate application DOM/state. */
export async function reveal(locator:Locator){await locator.waitFor({state:'attached'});const details=locator.locator('xpath=ancestor::details');for(let i=await details.count()-1;i>=0;i--){const section=details.nth(i);if(await section.getAttribute('open')===null)await section.locator(':scope > summary').click()}return locator}
export async function field(page:Page,name:string){return reveal(page.getByLabel(name).first())}
export async function action(page:Page,name:string){return reveal(page.getByRole('button',{name,exact:true,includeHidden:true}).first())}
export async function section(page:Page,name:RegExp|string){const summary=page.locator('summary').filter({hasText:name}).first();if(await summary.locator('..').getAttribute('open')===null)await summary.click()}
