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
 return <>{!online&&<aside className="pwa-notice" role="status">当前离线。草稿保存在此设备，线上确认和最新结果需联网。{cached?'基础网页已缓存。':'首次访问的页面与OCR资源不保证离线可用。'}</aside>}{update&&<aside className="pwa-notice" role="status"><span>新版本可用。更新前会等待本机草稿保存完成。</span><button disabled={updating} onClick={async()=>{setUpdating(true);try{await flushLocalWrites();await updateSW(true)}catch(e){setError((e as Error).message);setUpdating(false)}}}>{updating?'等待保存…':'保存后更新'}</button><button onClick={()=>setUpdate(false)}>稍后</button>{error&&<p role="alert">{error}</p>}</aside>}</>}
createRoot(document.getElementById('root')!).render(<StrictMode><PwaNotice/><App/></StrictMode>)
