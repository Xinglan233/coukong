import {it,expect} from 'vitest'
import {pointerToNormalized} from '../../src/online/activity/MapCanvas'
it('non-square image mapping excludes letterbox and survives zoom/pan',()=>{
 const rect={left:10,top:20,width:400,height:400}
 expect(pointerToNormalized({x:110,y:240},rect,2000,1000,{zoom:1,x:0,y:0})).toEqual({x:.25,y:.6})
 expect(pointerToNormalized({x:110,y:40},rect,2000,1000,{zoom:1,x:0,y:0})).toBeNull()
 expect(pointerToNormalized({x:230,y:290},rect,2000,1000,{zoom:2,x:100,y:-350})).toEqual({x:.25,y:.6})
})
