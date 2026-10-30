// Notifications de l'espace livreur uniquement : aucune interception réseau ni mise en cache.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "TutelLiv", {
      body: data.body || "",
      icon: "/icon.png",
      tag: data.tag || "tutelliv",
      renotify: true,
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requested = event.notification.data && event.notification.data.url;
  const path = typeof requested === "string" && requested.startsWith("/driver") ? requested : "/driver/missions";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).pathname.startsWith("/driver"));
      if (open) return open.focus().then((client) => client.navigate(path));
      return self.clients.openWindow(path);
    })
  );
});
