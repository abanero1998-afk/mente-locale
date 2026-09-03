const CACHE = "ml-os-v20260903b";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: "RELOAD", cache: CACHE });
      }
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const app = clientsArr.find((c) => c.url.includes(self.location.origin));
      if (app) return app.focus();
      return self.clients.openWindow("/");
    })
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "NOTIFY") {
    event.waitUntil(
      self.registration.showNotification(data.title || "Mente Locale", {
        body: data.body || "",
        icon: "/api/logo?s=192",
        badge: "/api/logo?s=192",
        tag: data.tag || "kds",
        renotify: true,
        silent: false,
        vibrate: [120, 60, 180],
        data: { url: data.url || "/?tab=kds" },
      })
    );
  }
});
