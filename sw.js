const CACHE="ma-dvdtheque-shell-v14";
const SHELL=["./","./index.html","./styles.css","./app.js?v=13","./manifest.json?v=7","./icon.svg"];

self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));

self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));

self.addEventListener("fetch",event=>{
 const req=event.request;
 if(req.method!=="GET"||new URL(req.url).origin!==location.origin)return;
 const url=new URL(req.url);
 if(req.mode==="navigate"||url.pathname.endsWith("/app.js")||url.pathname.endsWith("/sw.js")){
  event.respondWith(fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));}return res;}).catch(()=>caches.match(req).then(r=>r||caches.match("./index.html"))));
 }else{
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));}return res;})));
 }
});

// Reception des notifications push
self.addEventListener("push",event=>{
 let data={};
 try{
  data=event.data?event.data.json():{};
 }catch(error){
  data={};
 }

 event.waitUntil(
  self.registration.showNotification(
   data.title||"Les Films de Pitou",
   {
    body:data.body||"Une nouvelle reservation est arrivee !",
    icon:"./icon.svg",
    badge:"./icon.svg",
    vibrate:[200,100,200]
   }
  )
 );
});

// Ouverture de l'application au clic
self.addEventListener("notificationclick",event=>{
 event.notification.close();

 const appUrl=new URL("./",self.registration.scope).href;

 event.waitUntil(
  self.clients.matchAll({
   type:"window",
   includeUncontrolled:true
  }).then(clients=>{
   for(const client of clients){
    if(client.url===appUrl&&"focus" in client){
     return client.focus();
    }
   }
   return self.clients.openWindow(appUrl);
  })
 );
});
