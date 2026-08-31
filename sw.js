const CACHE = 'hal-garage-v5';
const ENHANCEMENTS = './hal-enhancements.js?v=3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './hal-enhancements.js?v=3'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

async function enhancedIndex(request){
  const response = await fetch(request);
  const type = response.headers.get('content-type') || '';
  if(!type.includes('text/html')) return response;
  const source = await response.text();
  const injected = source.replace('</body>', `<script src="${ENHANCEMENTS}"></script></body>`);
  const headers = new Headers(response.headers);
  headers.set('content-type','text/html; charset=utf-8');
  return new Response(injected,{status:response.status,statusText:response.statusText,headers});
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  const isNavigation = request.mode === 'navigate' || url.pathname.endsWith('/index.html');
  if(isNavigation){
    event.respondWith(
      enhancedIndex(request).then(response => {
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put('./index.html',copy));
        return response;
      }).catch(()=>caches.match('./index.html'))
    );
    return;
  }
  event.respondWith(caches.match(request).then(response => response || fetch(request)));
});
