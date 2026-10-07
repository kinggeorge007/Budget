"use strict";
const CACHE = "budget-v3";
const FILES = [
  "./", "index.html", "style.css", "theme.css", "theme2.css", "minimal.css", "foundation.css",
  "app.js", "budget.js", "bills.js", "savings.js", "reports.js", "edit.js", "balance.js", "tabs.js",
  "charts.js", "addtx.js", "home.js", "settings.js", "notes.js", "notetile.js", "lock.js", "welcome.js",
  "tools.js", "hometiles.js", "currency.js", "cardlist.js", "calcfull.js", "calchistory.js", "calendar.js",
  "workspace.js", "bizbooks.js", "bizreports.js", "minimal.js", "minchart.js", "core.js", "money.js",
  "quickadd.js", "profile.js", "ui-polish.js", "manifest.webmanifest", "icon-192.png", "apple-touch-icon.png",
  "favicon.svg", "favicon-32.png", "logo.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.allSettled(FILES.map(file => cache.add(file))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  event.respondWith(
    fetch(req, { cache: "no-cache" })
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(res => res || caches.match("index.html")))
  );
});
