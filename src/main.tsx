import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { flushLocalWrites } from './online/storage'
import App from './App'
import './styles.css'
import './pages.css'

let needsRefresh=false
let staticReady=false
const signal=()=>window.dispatchEvent(new Event('coukong-pwa-state'))
const updateSW=registerSW({immediate:true,onNeedRefresh(){needsRefresh=true;signal()},onOfflineReady(){staticReady=true;signal()}})
function PwaNotice(){const [update,setUpdate]=useState(needsRefresh);const [cached,setCached]=useState(staticReady);const [online,setOnline]=useState(navigator.onLine);const [error,setError]=useState('');const [updating,setUpdating]=useState(false)
 useEffect(()=>{const state=()=>{setUpdate(needsRefresh);setCached(staticReady)};const connectivity=()=>setOnline(navigator.onLine);addEventListener('coukong-pwa-state',state);addEventListener('online',connectivity);addEventListener('offline',connectivity);return()=>{removeEventListener('coukong-pwa-state',state);removeEventListener('online',connectivity);removeEventListener('offline',connectivity)}},[])
 return <>{!online&&<aside className="pwa-notice" role="status">现在没网。修改先保存在这台设备，联网后再提交。{cached?'已打开过的页面仍可查看。':'未打开过的页面和截图识别可能暂时无法使用。'}</aside>}{update&&<aside className="pwa-notice" role="status"><span>有新版本。先保存修改，再更新。</span><button disabled={updating} onClick={async()=>{setUpdating(true);try{await flushLocalWrites();await updateSW(true)}catch(e){setError((e as Error).message);setUpdating(false)}}}>{updating?'等待保存…':'保存后更新'}</button><button onClick={()=>setUpdate(false)}>稍后</button>{error&&<p role="alert">{error}</p>}</aside>}</>}
createRoot(document.getElementById('root')!).render(<StrictMode><PwaNotice/><App/></StrictMode>)
