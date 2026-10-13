const V='beatdeck-6.9.0';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
/* réseau d'abord (les mises à jour arrivent tout de suite), copie locale si pas de connexion */
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||!e.request.url.startsWith(self.location.origin))return;
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const c=r.clone();caches.open(V).then(h=>h.put(e.request,c)).catch(()=>{})}return r}).catch(()=>caches.match(e.request,{ignoreSearch:true})));
});
