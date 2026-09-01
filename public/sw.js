self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
        icon: "/icons/icon-192.jpg",
        badge: "/icons/icon-192.jpg",
        tag: data.tag || "kds",
        renotify: true,
        silent: false,
        vibrate: [120, 60, 180],
        data: { url: data.url || "/?tab=kds" },
      })
    );
  }
});
