'use strict';

const CACHE_NAME='vastgoed-dashboard-static-v40-42-17';
const OFFLINE_URL='/offline.html';
const STATIC_PATHS=new Set([
  '/style.css',
  '/app.js',
  '/qr-code.js',
  '/melding.css',
  '/melding.js',
  '/offline.html',
  '/manifest.webmanifest',
  '/apple-touch-icon.png',
  '/apple-touch-icon-120x120.png',
  '/apple-touch-icon-152x152.png',
  '/apple-touch-icon-167x167.png',
  '/apple-touch-icon-180x180.png',
  '/favicon-32x32.png',
  '/icon-192.png',
  '/icon-512.png'
]);

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    for(const path of STATIC_PATHS){
      try{
        const response=await fetch(path,{cache:'no-store'});
        if(response.ok) await cache.put(path,response);
      }catch(error){
        console.warn('PWA-bestand kon niet vooraf worden opgeslagen:',path,error);
      }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.filter(name=>name!==CACHE_NAME).map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;

  const url=new URL(request.url);

  // Supabase, CBS en andere externe API's worden nooit onderschept of gecachet.
  if(url.origin!==self.location.origin) return;

  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        return await fetch(request,{cache:'no-store'});
      }catch(error){
        return (await caches.match(OFFLINE_URL)) || Response.error();
      }
    })());
    return;
  }

  if(!STATIC_PATHS.has(url.pathname)) return;

  event.respondWith((async()=>{
    const cached=await caches.match(url.pathname);
    if(cached) return cached;

    const response=await fetch(request,{cache:'no-store'});
    if(response.ok){
      const cache=await caches.open(CACHE_NAME);
      await cache.put(url.pathname,response.clone());
    }
    return response;
  })());
});
