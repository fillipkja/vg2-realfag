/* Realfag VG2 — service worker.
   Network-first for HTML/JS/JSON (så innhold aldri blir gammelt),
   cache-first for vendor-filer og ikoner (som ikke endrer seg). */
const CACHE = "vg2realfag-v2";
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

/* Alle datafilene utledes av fag.json, så hele pensumet kan caches ved
   installasjon. Da fungerer appen offline — på bussen, i klasserommet. */
async function alleDatafiler() {
  try {
    const r = await fetch("./data/fag.json", { cache: "no-cache" });
    if (!r.ok) return [];
    const { fag } = await r.json();
    const stier = ["./data/studieteknikk.json"];
    for (const f of fag) {
      if (["matematikk", "fysikk", "kjemi"].includes(f.id)) {
        stier.push(`./data/formler-${f.id}.json`);
      }
      for (const k of f.kapitler) {
        stier.push(`./data/kapitler/${f.id}-${String(k.nr).padStart(2, "0")}.json`);
      }
    }
    return stier;
  } catch {
    return [];
  }
}

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled(SKALL.map((u) => c.add(u)));
    // pensumet i bakgrunnen — feiler stille hvis en fil ikke finnes ennå
    const data = await alleDatafiler();
    await Promise.allSettled(data.map((u) => c.add(u)));
    await self.skipWaiting();
  })());
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
