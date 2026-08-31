const CACHE='hal-garage-v16';
const CORE='./hal-core-fix.js?v=3';
const PHOTO='./hal-photo-fix.js?v=2';
const VEHICLE='./vehicle-category-fix.js?v=1';
const JORNADA='./hal-jornada-lite.js?v=3';
const ASSETS=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png',CORE,PHOTO,VEHICLE,JORNADA];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))));self.clients.claim()});
async function index(request){const r=await fetch(request),type=r.headers.get('content-type')||'';if(!type.includes('text/html'))return r;const s=await r.text();const body=s.replace('</body>',`<script src="${PHOTO}"></script><script src="${CORE}"></script><script src="${VEHICLE}"></script><script src="${JORNADA}"></script></body>`);const h=new Headers(r.headers);h.set('content-type','text/html; charset=utf-8');return new Response(body,{status:r.status,statusText:r.statusText,headers:h})}
self.addEventListener('fetch',e=>{const r=e.request;if(r.mode==='navigate'||new URL(r.url).pathname.endsWith('/index.html'))e.respondWith(index(r).then(x=>{caches.open(CACHE).then(c=>c.put('./index.html',x.clone()));return x}).catch(()=>caches.match('./index.html')));else e.respondWith(caches.match(r).then(x=>x||fetch(r)))})
