import { it,expect } from 'vitest'
import { Miniflare,convertV4MiniflareOptions } from 'miniflare'
import { build } from 'esbuild'
import { readFileSync,readdirSync,mkdtempSync,writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes,randomUUID } from 'node:crypto'
const quote=(v:unknown)=>v===null?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'"
it('真实Worker/D1持久重启、SQL导出、隔离恢复后API可运行且分钟值相同',async()=>{
 const source=mkdtempSync(join(tmpdir(),'coukong-backup-source-')),target=mkdtempSync(join(tmpdir(),'coukong-backup-restore-'))
 const built=await build({entryPoints:['worker/src/index.ts'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'})
 const open=(dir:string)=>new Miniflare(convertV4MiniflareOptions({modules:true,script:built.outputFiles[0].text,compatibilityDate:'2026-09-01',d1Databases:{DB:'coukong-backup-test'},resourcePersistencePath:dir,bindings:{CREATION_MODE:'invite',CREATION_CODE:'test-backup-create',ALLOWED_ORIGINS:'http://localhost:5173',BUILD_VERSION:'backup-test'}}))
 const token=()=>randomBytes(32).toString('hex'),manager=token(),invite=token(),memberToken=token()
 async function api(m:Miniflare,path:string,auth:string,method='GET',body?:unknown){const res=await m.dispatchFetch('http://localhost/api/v1'+path,{method,headers:{Authorization:'Bearer '+auth,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});expect(res.status).toBe(200);return (await res.json() as any).data}
 let mf=open(source)
 try{
  let db=await mf.getD1Database('DB');for(const migration of readdirSync('worker/migrations').filter(x=>x.endsWith('.sql')).sort())await db.exec(readFileSync('worker/migrations/'+migration,'utf8').replace(/\n/g,' '))
  const pkg=JSON.parse(readFileSync('examples/event-minimal.json','utf8'))
  const group=await api(mf,'/groups','','POST',{eventPackage:pkg,managerToken:manager,inviteToken:invite,operationId:randomUUID(),creationCode:'test-backup-create'})
  const member=await api(mf,`/groups/${group.id}/join`,invite,'POST',{name:'恢复测试成员',memberToken,operationId:randomUUID()})
  await api(mf,`/groups/${group.id}/members/${member.id}/response`,memberToken,'PUT',{expectedRevision:0,scheduleRevision:0,operationId:randomUUID(),response:{name:'恢复测试成员',presence:[{date:'2026-10-03',intervals:[{start:'13:07',end:'13:52'}]}],busy:[],bufferMinutes:0}})
  const beforeGroup=await api(mf,`/groups/${group.id}`,memberToken),beforeAvailability=await api(mf,`/groups/${group.id}/availability`,memberToken),beforeResponse=await api(mf,`/groups/${group.id}/members/${member.id}/response`,memberToken)
  expect(beforeAvailability.members[0].availability).toEqual([{date:'2026-10-03',start:'13:07',end:'13:52'}])
  await mf.dispose();mf=open(source);db=await mf.getD1Database('DB');expect(await api(mf,`/groups/${group.id}/availability`,memberToken)).toEqual(beforeAvailability)
  const schema=(await db.prepare("SELECT name,type,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END").all<any>()).results
  let sql='PRAGMA foreign_keys=OFF;\n';for(const row of schema.filter(r=>r.type==='table'))sql+=row.sql+';\n'
  for(const row of schema.filter(r=>r.type==='table')){const rows=(await db.prepare('SELECT * FROM "'+row.name+'"').all<any>()).results;for(const data of rows)sql+='INSERT INTO "'+row.name+'" ('+Object.keys(data).map(k=>'"'+k+'"').join(',')+') VALUES ('+Object.values(data).map(quote).join(',')+');\n'}
  for(const row of schema.filter(r=>r.type!=='table'))sql+=row.sql+';\n';sql+='PRAGMA foreign_keys=ON;'
  const backup=join(source,'backup.sql');writeFileSync(backup,sql,{mode:0o600})
  const restored=open(target);try{const restoreDb=await restored.getD1Database('DB');await restoreDb.exec(readFileSync(backup,'utf8').replace(/\n/g,' '));expect(await api(restored,`/groups/${group.id}`,memberToken)).toEqual(beforeGroup);expect(await api(restored,`/groups/${group.id}/availability`,memberToken)).toEqual(beforeAvailability);expect(await api(restored,`/groups/${group.id}/members/${member.id}/response`,memberToken)).toEqual(beforeResponse);expect((await restoreDb.prepare('PRAGMA foreign_key_check').all()).results).toEqual([])}finally{await restored.dispose()}
 }finally{await mf.dispose()}
},30000)
