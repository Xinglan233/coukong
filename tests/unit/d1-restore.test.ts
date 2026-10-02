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
it('大JSON恢复每条SQL低于D1限制，Unicode和引号无损且预算触发器最后恢复',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tongye-restore-large-')),source=join(dir,'source.sql'),target=join(dir,'restore.sql')
 const value=JSON.stringify({note:"汉字 quote ';\nline ".repeat(16000)}),literal="'"+value.replaceAll("'","''")+"'"
 const sql=`CREATE TABLE budget(id INTEGER PRIMARY KEY,used INTEGER);\nINSERT INTO budget VALUES(1,12);\nCREATE TABLE documents(id INTEGER PRIMARY KEY,body TEXT NOT NULL,second TEXT NOT NULL);\nINSERT INTO documents VALUES(1,${literal},${literal});\nCREATE TRIGGER charge AFTER INSERT ON documents BEGIN UPDATE budget SET used=used+1 WHERE id=1; END;\n`
 try{
  writeFileSync(source,sql,{mode:0o600});execFileSync('python3',['scripts/prepare-d1-restore.py',source,target],{stdio:'pipe'})
  const sizes=JSON.parse(execFileSync('python3',['-c',"import sqlite3,json,sys; b=''; sizes=[]\nfor line in open(sys.argv[1]):\n b+=line\n if sqlite3.complete_statement(b): sizes.append(len(b.encode('utf-8'))); b=''\nprint(json.dumps(sizes))",target],{encoding:'utf8'}))
  expect(Math.max(...sizes)).toBeLessThanOrEqual(80*1024)
  const db=new DatabaseSync(':memory:');try{db.exec('BEGIN');db.exec(readFileSync(target,'utf8'));db.exec('COMMIT');expect(db.prepare('SELECT body,second FROM documents WHERE id=1').get()).toEqual({body:value,second:value});expect(db.prepare('SELECT used FROM budget').get()?.used).toBe(12);expect(db.prepare("SELECT name FROM sqlite_master WHERE name LIKE '__tongye_restore_%'").all()).toEqual([]);db.exec("INSERT INTO documents VALUES(2,'next','next')");expect(db.prepare('SELECT used FROM budget').get()?.used).toBe(13)}finally{db.close()}
  expect(readFileSync(source,'utf8')).toBe(sql);expect(statSync(target).mode&0o777).toBe(0o600)
 }finally{rmSync(dir,{recursive:true,force:true})}
})
