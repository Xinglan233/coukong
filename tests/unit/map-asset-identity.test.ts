import {it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import type {EventPackage} from '../../shared/types'
import {matchingMapAsset,mapImageIdentity} from '../../src/online/activity/map-asset-identity'
const pkg=()=>JSON.parse(readFileSync('examples/convention-demo.v2.json','utf8')) as EventPackage
it('same asset key never authorizes a different image content or dimensions',()=>{const p=pkg(),map=p.event.extensions!.convention.maps[0],m=p.assetManifest!.find(a=>a.assetKey===map.assetKey)!;const asset={...m,id:'v1',eventId:p.event.id,state:'ready' as const,revision:1};expect(matchingMapAsset(p,map,[asset])?.id).toBe('v1');for(const changed of [{sha256:'0'.repeat(64)},{sizeBytes:m.sizeBytes+1},{width:m.width+1},{height:m.height+1},{mimeType:'image/jpeg' as const},{state:'processing' as const}])expect(matchingMapAsset(p,map,[{...asset,...changed}])).toBeUndefined();const newer=structuredClone(p);newer.assetManifest![0].sha256='0'.repeat(64);expect(mapImageIdentity(newer,map)).not.toBe(mapImageIdentity(p,map));delete p.assetManifest;expect(matchingMapAsset(p,map,[asset])).toBeUndefined()})
