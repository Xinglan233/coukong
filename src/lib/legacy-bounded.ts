import {parseStrictJSON} from '../../shared/event-validation'
import {validateTimeRange} from '../../shared/time'
import type {SharePayload} from '../types'
export const LEGACY_OUTPUT_BYTES=512*1024
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$'
// LZ-string URI bitstream decoder. Dictionary and output allocations are bounded
// before concatenation/append; the browser executes this only in a terminable worker.
export function decompressLegacyBounded(encoded:string):string {
 if(typeof encoded!=='string'||encoded.length>65536||!encoded.length)throw new Error('旧分享码过大或为空')
 const input=encoded.trim().replace(/ /g,'+')
 if(!/^[A-Za-z0-9+\-$]+$/.test(input))throw new Error('旧分享码编码无效')
 let index=0,mask=32,current=alphabet.indexOf(input[0]),dictSize=4,numBits=3,enlarge=4,outputBytes=0,dictionaryUnits=0
 const dictionary:string[]=[];const result:string[]=[]
 function bits(n:number){let value=0;for(let power=1;power<2**n;power*=2){if(index>=input.length)throw new Error('旧分享码不完整');if(current&mask)value+=power;mask>>=1;if(!mask){mask=32;index++;current=alphabet.indexOf(input[index]||'A')}}return value}
 function put(code:number,value:string){dictionaryUnits+=value.length;if(dictionaryUnits>LEGACY_OUTPUT_BYTES*4||value.length>LEGACY_OUTPUT_BYTES)throw new Error('旧分享码字典超过上限');dictionary[code]=value}
 function append(value:string){outputBytes+=new TextEncoder().encode(value).length;if(outputBytes>LEGACY_OUTPUT_BYTES)throw new Error('旧分享码解压超过512KiB');result.push(value)}
 const first=bits(2);if(first===2)return '';if(first!==0&&first!==1)throw new Error('旧分享码无效')
 let w=String.fromCharCode(bits(first===0?8:16));put(3,w);append(w)
 while(true){let code=bits(numBits);if(code===2)return result.join('');if(code===0||code===1){put(dictSize++,String.fromCharCode(bits(code===0?8:16)));code=dictSize-1;enlarge--}
 if(enlarge===0){enlarge=2**numBits;numBits++}if(numBits>20)throw new Error('旧分享码字典过大')
 let entry=dictionary[code];if(entry===undefined){if(code!==dictSize)throw new Error('旧分享码无效');if(w.length+1>LEGACY_OUTPUT_BYTES)throw new Error('旧分享码过大');entry=w+w[0]}
 append(entry);if(w.length+1>LEGACY_OUTPUT_BYTES)throw new Error('旧分享码过大');put(dictSize++,w+entry[0]);enlarge--;w=entry;if(enlarge===0){enlarge=2**numBits;numBits++}
 }
}
const days=['10-02','10-03','10-04','10-05','10-06']
function object(value:unknown,allowed:string[],required:string[]):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('旧分享结构无效');const v=value as Record<string,unknown>;if(Object.keys(v).some(k=>!allowed.includes(k))||required.some(k=>!Object.prototype.hasOwnProperty.call(v,k)))throw new Error('旧分享字段无效');return v}
function text(value:unknown,max:number,blank=false){if(typeof value!=='string'||value.length>max||(!blank&&!value.trim()))throw new Error('旧分享文字无效')}
export function decodeLegacyBounded(encoded:string):SharePayload {
 const v=object(parseStrictJSON(decompressLegacyBounded(encoded),LEGACY_OUTPUT_BYTES),['v','name','days','bookings','generatedAt'],['v','name','days','bookings','generatedAt'])
 if(v.v!==1||typeof v.generatedAt!=='number'||!Number.isFinite(v.generatedAt)||v.generatedAt<0)throw new Error('旧分享版本无效');text(v.name,100)
 if(!Array.isArray(v.days)||v.days.length>5||new Set(v.days).size!==v.days.length||v.days.some(d=>!days.includes(d)))throw new Error('旧分享日期无效')
 if(!Array.isArray(v.bookings)||v.bookings.length>500)throw new Error('旧分享安排数量无效')
 const ids=new Set<string>();for(const entry of v.bookings){const b=object(entry,['id','day','start','end','booth','ip','title','note','source'],['id','day','start','end','title','source']);text(b.id,200);text(b.title,100);if(ids.has(b.id as string))throw new Error('重复安排ID');ids.add(b.id as string);if(!days.includes(b.day as string)||!['catalog','manual','ocr'].includes(b.source as string)||!validateTimeRange({start:b.start as string,end:b.end as string}))throw new Error('旧分享安排无效');for(const key of ['booth','ip','note'])if(b[key]!==undefined)text(b[key],key==='note'?5000:200,true)}
 return v as unknown as SharePayload
}
