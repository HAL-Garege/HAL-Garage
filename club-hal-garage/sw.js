const CACHE='club-hal-v1';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim())});
self.addEventListener('fetch',event=>{});
