const DB = 'coukong-online-v1'
const pendingWrites=new Set<Promise<void>>()
const failedWrites=new Set<string>()
export async function flushLocalWrites(){await Promise.all([...pendingWrites]);if(failedWrites.size)throw new Error('本机保存失败，请先导出草稿，暂不能更新页面。')}
function track(key:string,p:Promise<void>):Promise<void>{pendingWrites.add(p);p.then(()=>{pendingWrites.delete(p);failedWrites.delete(key)},()=>{pendingWrites.delete(p);failedWrites.add(key)});return p}
function database(): Promise<IDBDatabase> { return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('records');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}) }
export async function readLocal<T>(key:string):Promise<T|undefined>{const db=await database();return new Promise((resolve,reject)=>{const r=db.transaction('records').objectStore('records').get(key);r.onsuccess=()=>{resolve(r.result);db.close()};r.onerror=()=>reject(r.error)})}
export function writeLocal(key:string,value:unknown){return track(key,(async()=>{const db=await database();await new Promise<void>((resolve,reject)=>{const t=db.transaction('records','readwrite');t.objectStore('records').put(value,key);t.oncomplete=()=>{db.close();resolve()};t.onerror=()=>reject(t.error)})})())}
export async function removeLocal(key:string){const db=await database();return new Promise<void>((resolve,reject)=>{const t=db.transaction('records','readwrite');t.objectStore('records').delete(key);t.oncomplete=()=>{db.close();resolve()};t.onerror=()=>reject(t.error)})}
export function download(name:string,value:unknown){const blob=new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
// Clear one activity in a single IndexedDB transaction after outstanding writes.
// Group identities, other activities, preferences and legacy data stay independent.
export async function removeLocalWhere(matches:(key:string)=>boolean):Promise<void>{
 await Promise.allSettled([...pendingWrites]);const db=await database()
 await new Promise<void>((resolve,reject)=>{const t=db.transaction('records','readwrite'),r=t.objectStore('records').openKeyCursor();r.onsuccess=()=>{const cursor=r.result;if(cursor){if(typeof cursor.key==='string'&&matches(cursor.key))t.objectStore('records').delete(cursor.key);cursor.continue()}};t.oncomplete=()=>{db.close();for(const key of failedWrites)if(matches(key))failedWrites.delete(key);resolve()};t.onerror=()=>{db.close();reject(t.error)};t.onabort=()=>{db.close();reject(t.error||new Error('本机清理失败'))}})
}
