import {it,expect} from 'vitest'
import LZ from 'lz-string'
import {decodeLegacyBounded} from '../../src/lib/legacy-bounded'
const p={v:1,name:'朋友',days:['10-03'],bookings:[{id:'1',day:'10-03',start:'13:07',end:'13:52',title:'预约',source:'manual'}],generatedAt:1}
it('legal legacy roundtrip keeps minutes',()=>expect(decodeLegacyBounded(LZ.compressToEncodedURIComponent(JSON.stringify(p)))).toEqual(p))
it('compression bomb is rejected during expansion',()=>expect(()=>decodeLegacyBounded(LZ.compressToEncodedURIComponent(JSON.stringify({...p,name:'a'.repeat(600000)})))).toThrow())
it('rejects versions fields duplicates depth and invalid bookings',()=>{for(const raw of [JSON.stringify({...p,v:2}),JSON.stringify({...p,token:'x'}),JSON.stringify({...p,bookings:[{...p.bookings[0],start:'24:00'}]}),'{"v":1,"v":1}', '['.repeat(40)+'0'+']'.repeat(40)])expect(()=>decodeLegacyBounded(LZ.compressToEncodedURIComponent(raw))).toThrow()})
