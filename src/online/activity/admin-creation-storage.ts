export async function adminCreationPendingPrefix(token:string):Promise<string>{
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))
 return `pending-admin-creation:${Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')}:`
}

// Logout removes only this session's undelivered issue/revoke requests.
export async function clearAdminCreationPending(token:string):Promise<void>{
 const prefix=await adminCreationPendingPrefix(token)
 for(let i=sessionStorage.length-1;i>=0;i--){const key=sessionStorage.key(i);if(key?.startsWith(prefix))sessionStorage.removeItem(key)}
}
