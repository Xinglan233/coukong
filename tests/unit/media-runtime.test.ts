import { it,expect } from 'vitest'
import ts from 'typescript'
import { readFileSync,mkdirSync,writeFileSync,mkdtempSync,symlinkSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join,dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
it('Node ES模块转译后四个媒体函数可启动并返回真实4xx',()=>{
 const root=mkdtempSync(join(tmpdir(),'tongye-media-esm-'))
 try{
  const files=['api/media/read.ts','api/media/upload.ts','api/media/finish.ts','api/media/cleanup.ts','api/media/backup.ts','src/server/media-backup.ts','src/server/media-service.ts','shared/activity-contract.ts']
  for(const file of files){const target=join(root,file.replace(/\.ts$/,'.js'));mkdirSync(dirname(target),{recursive:true});writeFileSync(target,ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)}
  writeFileSync(join(root,'package.json'),'{"type":"module"}');symlinkSync(join(process.cwd(),'node_modules'),join(root,'node_modules'),'dir')
  const script=`const statuses=[];for(const route of ['read','upload','finish','cleanup','backup']){const module=await import('./api/media/'+route+'.js');const req={method:'GET',url:'/api/media/'+route,headers:{}};let body='';const res={statusCode:200,setHeader(){},end(value){body=value}};await module.default(req,res);statuses.push(res.statusCode);if(!JSON.parse(body).error)throw new Error('expected structured 4xx')}process.stdout.write(JSON.stringify(statuses))`
  const result=execFileSync(process.execPath,['--input-type=module','-e',script],{cwd:root,encoding:'utf8',timeout:20000})
  expect(JSON.parse(result)).toEqual([400,405,405,405,401])
 }finally{rmSync(root,{recursive:true,force:true})}
})
