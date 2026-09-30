import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const escape = (s:string) => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
function render(text:string):string {
 let code=false;let table=false;const result:string[]=[]
 for(const line of text.split('\n')){
  if(line.startsWith('```')){result.push(code?'</code></pre>':'<pre><code>');code=!code;continue}
  if(code){result.push(escape(line)+'\n');continue}
  const heading=line.match(/^(#{1,3}) (.*)$/)
  const inline=(s:string)=>escape(s).replace(/\[([^\]]+)\]\(([^)]+)\)/g,(_,label,url)=>{
    const target=url.startsWith('../examples/')?'/examples/'+url.slice(12):url.startsWith('../schemas/')?'/examples/event-package.v1.schema.json':url.endsWith('.md')?'/help/'+url.replace(/^\.\.\//,'').replace(/^docs\//,'').replace(/\.md$/,'').toLowerCase()+'/':url
    return target.startsWith('/')||target.startsWith('https://')?`<a href="${target}">${label}</a>`:label
   }).replace(/`([^`]+)`/g,'<code>$1</code>')
  if(line.startsWith('|')){if(/^\|[\s:|-]+\|$/.test(line))continue;if(!table){result.push('<div class="table-scroll"><table>');table=true}result.push('<tr>'+line.slice(1,-1).split(/(?<!\\)\|/).map(cell=>'<td>'+inline(cell.trim().replaceAll('\\|','|'))+'</td>').join('')+'</tr>');continue}
  if(table){result.push('</table></div>');table=false}
  if(heading)result.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`)
  else if(line.trim())result.push(`<p>${inline(line)}</p>`)
 }
 if(table)result.push('</table></div>');return result.join('\n')
}
const pages=[['security','../SECURITY.md'],['changelog','../CHANGELOG.md'],['','GETTING_STARTED.md'],['event-json','EVENT_JSON_FORMAT.md'],...readdirSync(resolve(root,'docs')).filter(x=>x.endsWith('.md')).map(x=>[x.replace('.md','').toLowerCase(),x])]
for(const [slug,file] of pages){const dir=resolve(root,'public/help',slug);mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,'index.html'),`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>游 · 帮助</title><link rel="stylesheet" href="/help/help.css"></head><body><nav><a href="/">返回游</a> · <a href="/help/">新手上路</a> · <a href="/help/event-json/">JSON 格式</a> · <a href="/help/readme/">文档中心</a></nav><main>${render(readFileSync(resolve(root,'docs',file),'utf8'))}</main></body></html>`) }
writeFileSync(resolve(root,'public/help/help.css'),'html{color-scheme:light dark}body{max-width:800px;margin:auto;padding:24px;font:16px/1.75 system-ui,sans-serif;overflow-wrap:anywhere}nav{padding-bottom:24px;border-bottom:1px solid #8885}h1{font-size:30px}h2{font-size:23px;margin-top:32px}a{color:#16816b}pre{overflow:auto;padding:16px;background:#8881;border-radius:8px}code{font-size:.9em}p{margin:12px 0}.table-scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}td{border:1px solid #8885;padding:8px;min-width:90px}tr:first-child{font-weight:600}@media(max-width:430px){body{padding:18px}}')
mkdirSync(resolve(root,'public/examples'),{recursive:true})
for(const file of readdirSync(resolve(root,'examples')).filter(x=>x.endsWith('.json')))copyFileSync(resolve(root,'examples',file),resolve(root,'public/examples',file))
copyFileSync(resolve(root,'schemas/event-package.v1.schema.json'),resolve(root,'public/examples/event-package.v1.schema.json'))
console.log('站内帮助与示例已生成')
