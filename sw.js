"use strict";
const CACHE = "budget-v3";
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

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: "no-cache" })
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html"))
      )
  );
});
