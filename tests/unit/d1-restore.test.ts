import {it,expect} from 'vitest'
import {execFileSync} from 'node:child_process'
import {DatabaseSync} from 'node:sqlite'
import {mkdtempSync,writeFileSync,readFileSync,statSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
it('真实导出顺序的前向外键、引号换行和触发器恢复，数据与预算不重复执行',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tongye-restore-')),source=join(dir,'source.sql'),target=join(dir,'restore.sql')
 const sql=`PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE groups(id TEXT PRIMARY KEY, event_id TEXT REFERENCES events(id), title TEXT);
INSERT INTO groups VALUES('g','e','quote ''; semi ;\nline');
CREATE TABLE events(id TEXT PRIMARY KEY);
INSERT INTO events VALUES('e');
CREATE TABLE budget(id INTEGER PRIMARY KEY, used INTEGER);
INSERT INTO budget VALUES(1,10);
CREATE TRIGGER charge AFTER INSERT ON groups BEGIN
 SELECT CASE WHEN NEW.title='' THEN RAISE(ABORT,'blank') END;
 UPDATE budget SET used=used+1 WHERE id=1;
END;
`
 try{
  writeFileSync(source,sql,{mode:0o600});expect(()=>{const db=new DatabaseSync(':memory:');try{db.exec(sql)}finally{db.close()}}).toThrow(/no such table/)
  execFileSync('python3',['scripts/prepare-d1-restore.py',source,target],{stdio:'pipe'});const restored=readFileSync(target,'utf8'),db=new DatabaseSync(':memory:')
  try{db.exec('BEGIN');db.exec(restored);db.exec('COMMIT');expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);expect(db.prepare('SELECT title FROM groups').get()?.title).toBe("quote '; semi ;\nline");expect(db.prepare('SELECT used FROM budget').get()?.used).toBe(10);db.exec("INSERT INTO groups VALUES('g2','e','next')");expect(db.prepare('SELECT used FROM budget').get()?.used).toBe(11)}finally{db.close()}
  expect(readFileSync(source,'utf8')).toBe(sql);expect(statSync(target).mode&0o777).toBe(0o600);expect(()=>execFileSync('python3',['scripts/prepare-d1-restore.py',source,target],{stdio:'pipe'})).toThrow()
  writeFileSync(source,'CREATE TABLE x(id INTEGER);\nDELETE FROM x;\n',{mode:0o600});expect(()=>execFileSync('python3',['scripts/prepare-d1-restore.py',source,join(dir,'rejected.sql')],{stdio:'pipe'})).toThrow()
 }finally{rmSync(dir,{recursive:true,force:true})}
})
