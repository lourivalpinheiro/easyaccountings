/** Service worker mínimo: só serve a página de fallback /offline quando a navegação falha por falta de internet. */
const CACHE = "easyaccountings-offline-v5";
const OFFLINE_URL = "/offline";

/** A página usa o CSS e as imagens normais do app; sem cachear isso, ela fica sem estilo/logo offline. */
async function cacheOfflinePage(cache) {
  const res = await fetch(OFFLINE_URL);
  const html = await res.text();
  await cache.put(OFFLINE_URL, new Response(html, { headers: res.headers }));

  const hrefs = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/g)].map((m) => m[1]);
  const srcs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/g)].map((m) => m[1]);
  // O HTML vem com atributos com entidades (&amp;); sem decodificar, a URL não bate com o pedido real do navegador.
  const decode = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  await Promise.all(
    [...hrefs, ...srcs].map(decode).map(async (url) => {
      try {
        const assetRes = await fetch(url);
        if (assetRes.ok) await cache.put(url, assetRes);
      } catch {
        // Sem esse recurso, o fallback só perde um pouco do visual — a página continua abrindo.
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
  // CSS/JS/imagens pedidos pela própria página offline (quando ela é servida sem rede): responde do cache se tiver.
  if (req.destination === "style" || req.destination === "script" || req.destination === "image") {
    event.respondWith(caches.match(req).then((cached) => cached ?? fetch(req).catch(() => Response.error())));
  }
});
