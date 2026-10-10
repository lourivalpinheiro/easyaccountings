/** Service worker mínimo: só serve a página de fallback /offline quando a navegação falha por falta de internet. */
const CACHE = "easyaccountings-offline-v2";
const OFFLINE_URL = "/offline";

/** A página usa o CSS normal do app (Tailwind); sem cachear a folha de estilo, ficaria sem estilo offline. */
async function cacheOfflinePage(cache) {
  const res = await fetch(OFFLINE_URL);
  const html = await res.text();
  await cache.put(OFFLINE_URL, new Response(html, { headers: res.headers }));
  const hrefs = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/g)].map((m) => m[1]);
  await Promise.all(
    hrefs.map(async (href) => {
      try {
        const assetRes = await fetch(href);
        if (assetRes.ok) await cache.put(href, assetRes);
      } catch {
        // Sem essa folha de estilo, o fallback só perde o visual — a página continua abrindo.
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cacheOfflinePage(cache))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL).then((res) => res ?? Response.error())));
    return;
  }
  // CSS/JS pedidos pela própria página offline (quando ela é servida sem rede): responde do cache se tiver.
  if (req.destination === "style" || req.destination === "script") {
    event.respondWith(
      caches.match(req).then((cached) => cached ?? fetch(req).catch(() => Response.error())),
    );
  }
});
