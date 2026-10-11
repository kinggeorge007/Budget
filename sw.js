"use strict";
const CACHE = "budget-v4";
const FILES = [
  "./",
  "index.html",
  "style.css",
  "minimal.css",
  "foundation.css",
  "controls.css",
  "app.js",
  "budget.js",
  "bills.js",
  "savings.js",
  "reports.js",
  "edit.js",
  "balance.js",
  "tabs.js",
  "charts.js",
  "addtx.js",
  "home.js",
  "settings.js",
  "notes.js",
  "notetile.js",
  "lock.js",
  "welcome.js",
  "tools.js",
  "hometiles.js",
  "currency.js",
  "cardlist.js",
  "calcfull.js",
  "calchistory.js",
  "calendar.js",
  "workspace.js",
  "bizbooks.js",
  "bizreports.js",
  "minimal.js",
  "minchart.js",
  "core.js",
  "money.js",
  "quickadd.js",
  "profile.js",
  "controls.js",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png",
  "favicon.svg",
  "favicon-32.png",
  "apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(FILES.map(f => c.add(f))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Pages: network first (so new versions arrive), falling back to the saved copy if the network is slow.
// Everything else: saved copy first, so a refresh is instant even on a slow connection.
function networkFirst(req) {
  return new Promise(resolve => {
    let done = false;
    const timer = setTimeout(() => {
      caches.match(req, { ignoreSearch: true }).then(r => { if (r && !done) { done = true; resolve(r); } });
    }, 4000);
    fetch(req, { cache: "no-cache" }).then(res => {
      clearTimeout(timer);
      if (res.ok) { const c = res.clone(); caches.open(CACHE).then(ca => ca.put(req, c)); }
      if (!done) { done = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      caches.match(req, { ignoreSearch: true }).then(r => {
        if (!done) { done = true; resolve(r || caches.match("index.html")); }
      });
    });
  });
}

function cacheFirst(req, versioned) {
  return caches.match(req).then(hit => {
    if (hit && versioned) return hit;                       // versioned files never change under the same address
    const net = fetch(req).then(res => {
      if (res.ok) { const c = res.clone(); caches.open(CACHE).then(ca => ca.put(req, c)); }
      return res;
    }).catch(() => null);
    if (hit) return hit;                                    // unversioned: serve now, refresh for next time
    return net.then(r => r || caches.match(req, { ignoreSearch: true }));
  });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const isPage = req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("index.html");
  e.respondWith(isPage ? networkFirst(req) : cacheFirst(req, url.search.indexOf("v=") > -1));
});
