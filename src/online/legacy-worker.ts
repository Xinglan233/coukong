import {decodeLegacyBounded} from '../lib/legacy-bounded'
self.onmessage=(e:MessageEvent<string>)=>{try{self.postMessage(decodeLegacyBounded(e.data))}catch{self.postMessage(null)}}
