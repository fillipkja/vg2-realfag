/* Realfag VG2 — service worker.
   Network-first for HTML/JS/JSON (så innhold aldri blir gammelt),
   cache-first for vendor-filer og ikoner (som ikke endrer seg). */
const CACHE = "vg2realfag-v1";
const SKALL = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.webmanifest",
  "./data/fag.json",
  "./vendor/katex/katex.min.css",
  "./vendor/katex/katex.min.js",
  "./vendor/katex/contrib/mhchem.min.js",
  "./vendor/katex/contrib/auto-render.min.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(SKALL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((n) => Promise.all(n.filter((x) => x !== CACHE).map((x) => caches.delete(x))))
      .then(() => self.clients.claim())
  );
});

const ER_UFORANDERLIG = (url) =>
  url.pathname.includes("/vendor/") || url.pathname.includes("/icons/");

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  if (ER_UFORANDERLIG(url)) {
    // cache-first — fonter, KaTeX og ikoner endrer seg aldri
    e.respondWith(
      caches.match(request).then((traff) =>
        traff || fetch(request).then((svar) => {
          if (svar.ok) {
            const kopi = svar.clone();
            caches.open(CACHE).then((c) => c.put(request, kopi));
          }
          return svar;
        })
      )
    );
    return;
  }

  // network-first — app-kode og innhold
  e.respondWith(
    fetch(request)
      .then((svar) => {
        if (svar.ok) {
          const kopi = svar.clone();
          caches.open(CACHE).then((c) => c.put(request, kopi));
        }
        return svar;
      })
      .catch(() =>
        caches.match(request).then((traff) =>
          traff || (request.mode === "navigate" ? caches.match("./index.html") : undefined)
        )
      )
  );
});
