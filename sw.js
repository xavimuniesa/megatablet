/* Cronògraf — service worker
   - The app shell (page, manifest, icons) is cached so it opens offline.
   - The page itself is fetched network-first, so a new version published
     on GitHub Pages shows up at the next launch; the cache is the fallback.
   - Weather, place name and holiday data are also network-first, keeping the
     last good answer for when there is no connection.
   Bump VERSIO whenever these files change. */
const VERSIO = 'cronograf-v1';
const CLOSCA = [
  './',
  './index.html',
  './watch.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-48.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSIO)
      // one missing optional file (e.g. watch.html) must not abort the install
      .then(cache => Promise.all(CLOSCA.map(url => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(claus => Promise.all(claus.filter(c => c !== VERSIO).map(c => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

function xarxaPrimer(request){
  return fetch(request).then(resposta => {
    if(resposta && (resposta.ok || resposta.type === 'opaque')){
      const copia = resposta.clone();
      caches.open(VERSIO).then(cache => cache.put(request, copia));
    }
    return resposta;
  }).catch(() => caches.match(request, { ignoreSearch: request.mode === 'navigate' })
    .then(r => r || (request.mode === 'navigate' ? caches.match('./index.html') : undefined)));
}

function cachePrimer(request){
  return caches.match(request).then(r => r || fetch(request).then(resposta => {
    if(resposta && (resposta.ok || resposta.type === 'opaque')){
      const copia = resposta.clone();
      caches.open(VERSIO).then(cache => cache.put(request, copia));
    }
    return resposta;
  }));
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  // the page: always try for the latest version first
  if(req.mode === 'navigate') { event.respondWith(xarxaPrimer(req)); return; }

  // fonts never change: cache first
  if(/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) { event.respondWith(cachePrimer(req)); return; }

  // live data (weather, place name, holidays): network first, last answer offline
  if(/open-meteo\.com$|bigdatacloud\.net$|transparenciacatalunya\.cat$/.test(url.hostname)) {
    event.respondWith(xarxaPrimer(req)); return;
  }

  // our own files (icons, manifest): cache first
  if(url.origin === self.location.origin) { event.respondWith(cachePrimer(req)); return; }
});
