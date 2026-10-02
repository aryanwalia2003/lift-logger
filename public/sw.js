// Offline shell: static assets cache-first, pages network-first (cache fallback, query ignore)
const V = "v1";
const STATIC = `static-${V}`, PAGES = `pages-${V}`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (!k.endsWith(`-${V}`)) await caches.delete(k);
    await self.clients.claim();
  })()),
);

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

async function cacheFirst(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
}

async function page(req) {
  const cache = await caches.open(PAGES);
  const key = new URL(req.url).pathname;
  try {
    const res = await withTimeout(fetch(req), 4000);
    // redirect (login) ya non-HTML cache nahi karte
    if (res.ok && !res.redirected && (res.headers.get("content-type") || "").includes("text/html")) cache.put(key, res.clone());
    return res;
  } catch {
    return (await cache.match(key)) || (await cache.match("/")) || new Response("Offline", { status: 503 });
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/static/")) return e.respondWith(cacheFirst(req));
  if (req.mode === "navigate") return e.respondWith(page(req));
  if (url.pathname === "/manifest.webmanifest" || url.pathname.startsWith("/icons/") || url.pathname === "/apple-icon") return e.respondWith(staleWhileRevalidate(req));
});

// Page ne bola: ye routes aur unke JS/CSS pehle se cache kar lo (offline pehli baar bhi chale)
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "warm") {
    e.waitUntil(warm(e.data.urls || []).then((n) => e.source && e.source.postMessage({ type: "warmed", n })));
  }
});

async function warm(urls) {
  const pages = await caches.open(PAGES), assets = await caches.open(STATIC);
  let cached = 0;
  for (const u of urls) {
    try {
      const res = await fetch(u);
      if (!res.ok || res.redirected) continue;
      await pages.put(u, res.clone());
      cached++;
      const html = await res.text();
      const found = new Set([
        ...(html.match(/\/_next\/static\/[^"'\\\s)]+/g) || []),
        ...(html.match(/static\/(?:chunks|css|media)\/[^"'\\\s)]+/g) || []).map((p) => `/_next/${p}`),
      ]);
      await Promise.all([...found].map(async (a) => {
        if (await assets.match(a)) return;
        const r = await fetch(a);
        if (r.ok) await assets.put(a, r);
      }));
    } catch { /* ek page fail ho to baaki chalein */ }
  }
  return cached;
}
