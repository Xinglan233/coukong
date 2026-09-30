import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { parseEventPackage, parseStrictJSON } from '../shared/event-validation'
import { LIMITS } from '../shared/types'
const root=resolve(import.meta.dirname,'..')
const read=(p:string)=>readFileSync(resolve(root,p),'utf8')
const schema=JSON.parse(read('schemas/event-package.v1.schema.json'))
const ajv=new Ajv2020({strict:false,allErrors:true});addFormats(ajv);const valid=ajv.compile(schema)
const validators=new Map([[1,valid]])
for(const file of readdirSync(resolve(root,'schemas')).filter(f=>/^event-package\.v[2-9]\.schema\.json$/.test(f))){const next=JSON.parse(read('schemas/'+file));validators.set(next.properties.schemaVersion.const,ajv.compile(next));assert.equal(read('public/examples/'+file),read('schemas/'+file),`${file}: Schema 下载漂移`)}
const docs=['README.md','SECURITY.md','CHANGELOG.md',...readdirSync(resolve(root,'docs')).filter(f=>f.endsWith('.md')).map(f=>'docs/'+f)]
let links=0
for(const file of docs){for(const m of read(file).matchAll(/\[[^\]]+\]\(([^)]+)\)/g)){
 const target=m[1].split('#')[0];if(!target||/^https?:/.test(target))continue
 assert(existsSync(resolve(dirname(resolve(root,file)),target)),`${file}: 缺少链接目标 ${target}`);links++
}}
let examples=0
for(const file of readdirSync(resolve(root,'examples')).filter(f=>f.endsWith('.json'))){
 const raw=read('examples/'+file);const data=parseEventPackage(raw)
 const schemaCheck=validators.get(data.schemaVersion);assert(schemaCheck,`${file}: 未知结构版本`);assert(schemaCheck(data),`${file}: Schema 失败`)
 for(const asset of data.assetManifest||[]){
  assert(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(asset.assetKey),`${file}: 不安全资产键`)
  const assetPath=resolve(root,'examples/assets',asset.assetKey);assert(existsSync(assetPath),`${file}: 缺资产 ${asset.assetKey}`)
  const bytes=readFileSync(assetPath);assert.equal(bytes.length,asset.sizeBytes,`${file}: 资产大小漂移`);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,`${file}: 资产哈希漂移`)
  assert.deepEqual(readFileSync(resolve(root,'public/examples/assets',asset.assetKey)),bytes,`${file}: 资产下载漂移`)
 }
 assert.deepEqual(parseEventPackage(JSON.stringify(data)),data,`${file}: 回导漂移`)
 assert.equal(read('public/examples/'+file),raw,`${file}: 站内下载漂移`)
 assert(!/"(?:token|managerToken|memberToken|inviteToken|note|participant)"\s*:/.test(raw),`${file}: 示例含私人字段`)
 examples++
}
const expected=JSON.parse(read('tests/fixtures/expected-results.json')) as Record<string,{stage:string}>
assert.equal(Object.keys(expected).length,9)
for(const [file,expect] of Object.entries(expected)){
 const raw=read('tests/fixtures/invalid/'+file);let stage='accept';let parsed:unknown
 try{parsed=parseStrictJSON(raw)}catch{stage='parse'}
 if(stage==='accept'){if(!valid(parsed))stage='schema';else{try{parseEventPackage(raw)}catch{stage='semantic'}}}
 assert.equal(stage,expect.stage,`${file}: 错误阶段不一致`)
 assert.throws(()=>parseEventPackage(raw),`${file}: 共享校验未拒绝`)
}
assert.equal(read('public/examples/event-package.v1.schema.json'),read('schemas/event-package.v1.schema.json'))
assert.equal(schema.$defs.event.properties.days.maxItems,LIMITS.days)
assert.equal(schema.$defs.event.properties.activities.maxItems,LIMITS.activities)
assert.equal(schema.$defs.activity.properties.sessions.maxItems,LIMITS.sessions)
assert.equal(schema.$defs.day.properties.openIntervals.maxItems,LIMITS.intervals)
const sharedTypes=read('shared/types.ts')
for(const def of ['event','activity','session','day','interval','meta'])for(const field of Object.keys(schema.$defs[def].properties))assert(new RegExp('\\b'+field+'\\??\\s*:').test(sharedTypes),`Schema/共享类型字段漂移 ${def}.${field}`)
const red=parseEventPackage(read('examples/redland-2026-template.json'))
assert.match(red.meta?.sourceNote||'',/待确认/);assert.equal(red.event.activities.length,0)
for(const file of readdirSync(resolve(root,'public/help'),{recursive:true}).filter(x=>String(x).endsWith('.html'))){
 const html=read('public/help/'+file);assert(!/<script\b|\son\w+=/i.test(html),'帮助不能含可执行内联内容')
 for(const m of html.matchAll(/href="([^"#]+)"/g)){
  const url=m[1];if(url==='/'||/^https:/.test(url))continue
  if(url.startsWith('/'))assert(existsSync(resolve(root,'public','.'+url))||existsSync(resolve(root,'public','.'+url,'index.html')),`${file}: 帮助目标缺失 ${url}`)
 }
}
const pkg=JSON.parse(read('package.json'))
for(const script of ['dev','dev:all','build','typecheck','lint','test','test:integration','test:e2e','docs:check','verify'])assert.equal(typeof pkg.scripts[script],'string',`缺少命令 ${script}`)
const frontendFiles=readdirSync(resolve(root,'src'),{recursive:true}).filter(x=>/\.(ts|tsx)$/.test(String(x)))
const frontend=frontendFiles.map(f=>read('src/'+f)).join('\n')
assert(frontend.includes('VITE_API_URL'),'前端 API 环境变量漂移')
const worker=read('worker/src/index.ts')
for(const name of ['CREATION_MODE','CREATION_CODE','ADMIN_ROOT_SECRET','ALLOWED_ORIGINS','BUILD_VERSION'])assert(worker.includes(name),`Worker 环境变量漂移 ${name}`)
assert(read('.env.example').includes('VITE_API_URL'))
for(const name of ['CREATION_CODE','ADMIN_ROOT_SECRET'])assert(read('worker/.dev.vars.example').includes(name))
for(const route of ['/health','/ready','/templates','/admin/session','/groups'])assert(worker.includes(route)&&read('docs/API.md').includes(route),`API 文档漂移 ${route}`)
console.log(`docs:check 通过：${docs.length} 文档、${links} 本地链接、${examples} 示例、9 错误夹具、Schema/往返/帮助/配置检查`)
