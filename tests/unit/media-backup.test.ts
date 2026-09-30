import {it,expect} from 'vitest'
import sharp from 'sharp'
import {createHash,randomBytes} from 'node:crypto'
import {mkdtempSync,readFileSync,statSync,rmSync,existsSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {backupOffset,backupSlice,readBackupPart,BACKUP_CHUNK_BYTES} from '../../src/server/media-backup'
import {backupEvent,validateIndex,type BackupIndex,type BackupResponse} from '../../scripts/media-backup'
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex'),stream=(b:Buffer)=>new ReadableStream<Uint8Array>({start(c){c.enqueue(b);c.close()}})
it('备份偏移和1MiB限制，Range校验及完整读取降级',async()=>{
 for(const value of [null,'','-1','1.5','Infinity','9007199254740992'])expect(()=>backupOffset(value)).toThrow()
 const full=Buffer.alloc(BACKUP_CHUNK_BYTES+3,42),metadata={sizeBytes:full.length,sha256:sha(full)}
 expect(backupSlice(full,0)).toHaveLength(BACKUP_CHUNK_BYTES);expect(()=>backupSlice(full,full.length)).toThrow()
 const range=await readBackupPart(stream(full.subarray(0,BACKUP_CHUNK_BYTES)),new Headers({'content-range':`bytes 0-${BACKUP_CHUNK_BYTES-1}/${full.length}`}),metadata,0);expect(range.readMode).toBe('range');expect(range.bytes).toHaveLength(BACKUP_CHUNK_BYTES)
 const fallback=await readBackupPart(stream(full),new Headers(),metadata,BACKUP_CHUNK_BYTES);expect(fallback.readMode).toBe('full');expect(fallback.bytes).toEqual(full.subarray(BACKUP_CHUNK_BYTES))
 await expect(readBackupPart(stream(full),new Headers({'content-range':'bytes 1-3/4'}),metadata,0)).rejects.toThrow()
 await expect(readBackupPart(stream(full),new Headers(),{...metadata,sha256:'a'.repeat(64)},0)).rejects.toThrow()
})
it('真实本机SQL+源/显示bytes受控备份，全文件/历史hash匹配且文件600目录700',async()=>{
 const parent=mkdtempSync(join(tmpdir(),'tongye-media-backup-')),source=await sharp(randomBytes(900*500*3),{raw:{width:900,height:500,channels:3}}).png().toBuffer(),display=await sharp(source).webp({quality:90}).toBuffer(),sourceHash=sha(source),displayHash=sha(display),assets=[{id:'asset-test',assetKey:'map-test',sourceSizeBytes:source.length,sourceSha256:sourceHash,mimeType:'image/png',displaySizeBytes:display.length,displaySha256:displayHash}],index:BackupIndex={format:'tongye.media-backup.v1',eventId:'event-test',revision:1,publicRevision:1,refs:[{revision:1,assetKey:'map-test',sha256:sourceHash}],assets}
 const event={event:{extensions:{convention:{maps:[{assetKey:'map-test'}]}}},assetManifest:[{assetKey:'map-test',sha256:sourceHash}]},sql=Buffer.from(`CREATE TABLE events(id TEXT,revision INTEGER,public_revision INTEGER); INSERT INTO events VALUES('event-test',1,1); CREATE TABLE event_versions(event_id TEXT,revision INTEGER,event_json TEXT);INSERT INTO event_versions VALUES('event-test',1,'${JSON.stringify(event)}');CREATE TABLE media_assets(id TEXT,event_id TEXT,state TEXT,asset_key TEXT,source_path TEXT,source_sha256 TEXT,sha256 TEXT,source_size_bytes INTEGER,size_bytes INTEGER,display_path TEXT,display_size_bytes INTEGER,revision INTEGER);INSERT INTO media_assets VALUES('asset-test','event-test','ready','map-test','assets/event-test/asset-test/source-${sourceHash}','${sourceHash}','${sourceHash}',${source.length},${source.length},'assets/event-test/asset-test/display-${displayHash}.webp',${display.length},1);`)
 const request=async(p:Record<string,string>):Promise<BackupResponse>=>{if(p.mode==='index')return {status:200,headers:{},bytes:Buffer.from(JSON.stringify({data:index}))};const data=p.kind==='source'?source:display,offset=Number(p.offset),bytes=data.subarray(offset,offset+BACKUP_CHUNK_BYTES);return {status:200,bytes,headers:{'x-backup-sha256':sha(data),'x-backup-offset':p.offset,'x-backup-total-bytes':String(data.length),'x-backup-chunk-sha256':sha(bytes),'x-backup-read-mode':'range'}}}
 try{const out=join(parent,'complete'),result=await backupEvent({eventId:'event-test',output:out,database:sql,request});expect(result.files).toBe(2);expect((await sharp(readFileSync(join(out,'asset-test.source.png'))).metadata()).width).toBe(900);expect((await sharp(readFileSync(join(out,'asset-test.display.webp'))).metadata()).height).toBe(500);expect(readFileSync(join(out,'asset-test.source.png'))).toEqual(source);expect(readFileSync(join(out,'asset-test.display.webp'))).toEqual(display);expect(readFileSync(join(out,'database.sql'))).toEqual(sql);expect(statSync(out).mode&0o777).toBe(0o700);expect(statSync(join(out,'manifest.json')).mode&0o777).toBe(0o600);expect(existsSync(join(out,'COMPLETE'))).toBe(true)
  expect(()=>validateIndex({...index,refs:[{revision:1,assetKey:'missing',sha256:sourceHash}]},'event-test')).toThrow()
  const broken=join(parent,'broken');await expect(backupEvent({eventId:'event-test',output:broken,database:sql,request:async p=>{const r=await request(p);return p.mode==='file'?{...r,bytes:Buffer.from('wrong')}:r}})).rejects.toThrow();expect(existsSync(join(broken,'COMPLETE'))).toBe(false)
  await expect(backupEvent({eventId:'event-test',output:join(parent,'wrong-sql'),database:Buffer.from(sql.toString().replace("VALUES('event-test',1,1)","VALUES('event-test',2,1)")),request})).rejects.toThrow();expect(existsSync(join(parent,'wrong-sql'))).toBe(false)
 }finally{rmSync(parent,{recursive:true,force:true})}
})
