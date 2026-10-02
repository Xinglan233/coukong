import {readFileSync} from 'node:fs'
import {it,expect} from 'vitest'
const css=readFileSync('src/styles.css','utf8')
function contrast(a:string,b:string){const lum=(hex:string)=>{const rgb=hex.match(/[a-f0-9]{2}/gi)!.map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722};const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
it('主要/辅助正文与两种表面、主按钮文字在浅深色达到4.5对比度',()=>{for(const block of [css.match(/:root\s*\{([^}]+)\}/)![1],css.match(/\[data-theme='dark'\]\s*\{([^}]+)\}/)![1]]){const vars=Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[a-f0-9]{6})/gi)].map(m=>[m[1],m[2]]));for(const ink of ['ink','ink-2','ink-3'])for(const surface of ['bg','surface'])expect(contrast(vars[ink],vars[surface]),ink+' on '+surface).toBeGreaterThanOrEqual(4.5);expect(contrast(vars.accent,block.includes('#111317')?'#06231f':'#ffffff')).toBeGreaterThanOrEqual(4.5)}})
