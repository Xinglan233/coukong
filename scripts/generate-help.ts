import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, cpSync, existsSync } from 'node:fs'
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
    const target=url.startsWith('../examples/')?'/examples/'+url.slice(12):url.startsWith('../schemas/')?'/examples/'+url.slice(11):url.endsWith('.md')?'/help/'+url.replace(/^\.\.\//,'').replace(/^docs\//,'').replace(/\.md$/,'').toLowerCase()+'/':url
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
for(const [slug,file] of pages){const dir=resolve(root,'public/help',slug);mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,'index.html'),`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>同野·游 · 帮助</title><link rel="stylesheet" href="/help/help.css"><script src="/help/theme.js"></script></head><body><div class="help-shell"><nav class="help-nav" aria-label="帮助导航"><a class="btn btn-surface" href="/">返回活动</a><a class="btn btn-surface" href="/help/">新手上路</a><a class="btn btn-surface" href="/help/event-json/">活动资料格式</a><a class="btn btn-surface" href="/help/readme/">文档中心</a></nav><main>${render(readFileSync(resolve(root,'docs',file),'utf8'))}</main></div></body></html>`) }
// The app stylesheet is the sole source of colors, type, controls and theme tokens.
writeFileSync(resolve(root,'public/help/help.css'),readFileSync(resolve(root,'src/styles.css'),'utf8')+`
.help-shell{max-width:800px;margin:0 auto;padding:24px 16px calc(64px + env(safe-area-inset-bottom));overflow-wrap:anywhere;line-height:1.7}
.help-nav{display:flex;flex-wrap:wrap;gap:8px;padding-bottom:24px;border-bottom:1px solid var(--line)}
.help-nav .btn{font-weight:500;text-decoration:none}
.help-shell h1{font-size:26px;font-weight:600;line-height:1.4;margin:24px 0 16px}
.help-shell h2{font-size:18px;font-weight:600;line-height:1.5;margin:32px 0 12px}
.help-shell h3{font-size:16px;font-weight:600;margin:24px 0 8px}
.help-shell a:not(.btn){color:var(--accent-ink);text-decoration:underline;text-underline-offset:3px}
.help-shell a:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.help-shell pre{max-width:100%;overflow:auto;padding:16px;background:var(--surface-2);border-radius:var(--radius);line-height:1.6}
.help-shell code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.9em}
.help-shell p{margin:12px 0}
.help-shell .table-scroll{max-width:100%;overflow:auto}
.help-shell table{border-collapse:collapse;width:100%;font-size:14px}
.help-shell td{border:1px solid var(--line);padding:8px;min-width:90px}
.help-shell tr:first-child{font-weight:600}
`)
writeFileSync(resolve(root,'public/help/theme.js'),`(()=>{const media=matchMedia('(prefers-color-scheme: dark)');let theme='auto';try{theme=localStorage.getItem('coukong-theme')||'auto'}catch{}const apply=()=>{document.documentElement.dataset.theme=theme==='dark'||theme==='auto'&&media.matches?'dark':'light';document.documentElement.style.colorScheme=document.documentElement.dataset.theme};apply();media.addEventListener('change',apply)})();\n`)
mkdirSync(resolve(root,'public/examples'),{recursive:true})
for(const file of readdirSync(resolve(root,'examples')).filter(x=>x.endsWith('.json')))copyFileSync(resolve(root,'examples',file),resolve(root,'public/examples',file))
for(const file of readdirSync(resolve(root,'schemas')).filter(x=>/^event-package\.v\d+\.schema\.json$/.test(x)))copyFileSync(resolve(root,'schemas',file),resolve(root,'public/examples',file))
if(existsSync(resolve(root,'examples/assets')))cpSync(resolve(root,'examples/assets'),resolve(root,'public/examples/assets'),{recursive:true})
console.log('站内帮助与示例已生成')
