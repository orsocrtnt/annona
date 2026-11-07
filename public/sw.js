// Espace livreur : notifications (push web) et copie hors réseau des écrans déjà chargés (MOBILE-1).
//
// Copie hors réseau : réseau d'abord, toujours. La copie ne sert que si le réseau ne répond pas
// (rechargement de la tournée sans réseau, LIV-06). Seuls les écrans /driver, la lecture de la tournée
// (/api/driver/rounds) et les fichiers de l'application (/_next/static) sont copiés ; jamais les envois
// (POST), le portail, le back-office ni une redirection (session expirée). Copie effacée à la déconnexion
// (`releaseDeviceOnLogout`, même nom de cache). La session (/api/auth/session) n'est copiée que si c'est
// celle d'un livreur : sans elle, l'écran rechargé hors réseau renverrait vers la connexion (RECETTE-V1).
const CACHE_NAME = "annona-driver-v1";
const NAVIGATION_TIMEOUT_MS = 4000;
const MAX_STATIC_ENTRIES = 300;
// Réponse servie depuis la copie : signalée à l'écran, qui ne la prend pas pour une lecture fraîche du
// serveur (RECETTE-V1 N1). Même nom que `OFFLINE_COPY_HEADER` (src/features/driver/driver-offline-cache.ts).
const OFFLINE_COPY_HEADER = "x-annona-offline-copy";

function cacheKind(url, request) {
  if (url.origin !== self.location.origin || request.method !== "GET") return null;
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return null;
  if (request.mode === "navigate") return url.pathname === "/driver" || url.pathname.startsWith("/driver/") ? "page" : null;
  if (url.pathname === "/api/driver/rounds") return "data";
  if (url.pathname === "/api/auth/session") return "session";
  if (url.pathname.startsWith("/_next/static/")) return "static";
  return null;
}
self.annonaCacheKind = cacheKind;

function cacheable(response) {
  return Boolean(response) && response.ok && response.status === 200 && response.type === "basic" && !response.redirected;
}

/** Session : copiée seulement pour un livreur ; toute autre réponse (déconnecté, autre rôle) efface la copie. */
async function isDriverSession(response) {
  try {
    const body = await response.clone().json();
    return Boolean(body && body.user && body.user.role && body.user.role.systemRole === "DRIVER");
  } catch {
    return false;
  }
}
self.annonaIsDriverSession = isDriverSession;

async function store(cache, request, response, kind) {
  if (kind === "session" && response && response.ok && !(await isDriverSession(response))) {
    await cache.delete(request);
    return;
  }
  if (!cacheable(response)) return;
  await cache.put(request, response.clone());
  if (kind === "static") await trimStatic(cache);
}

function markCopy(copy) {
  const headers = new Headers(copy.headers);
  headers.set(OFFLINE_COPY_HEADER, "1");
  return new Response(copy.body, { status: copy.status, statusText: copy.statusText, headers });
}
self.annonaMarkCopy = markCopy;

async function trimStatic(cache) {
  const keys = (await cache.keys()).filter((request) => new URL(request.url).pathname.startsWith("/_next/static/"));
  for (const request of keys.slice(0, Math.max(0, keys.length - MAX_STATIC_ENTRIES))) await cache.delete(request);
}

async function networkFirst(request, kind) {
  const cache = await caches.open(CACHE_NAME);
  const network = fetch(request).then(async (response) => {
    await store(cache, request, response, kind);
    return response;
  });
  network.catch(() => undefined); // échec déjà traité plus bas (copie) : pas d'erreur « non gérée »
  if (kind !== "page") {
    try {
      return await network;
    } catch (error) {
      const copy = await cache.match(request);
      if (copy) return markCopy(copy);
      throw error;
    }
  }
  // Écran : au-delà de quelques secondes sans réponse (réseau très faible), la copie s'affiche.
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NAVIGATION_TIMEOUT_MS));
  try {
    const first = await Promise.race([network, timeout]);
    if (first) return first;
    const copy = await cache.match(request, { ignoreSearch: true });
    return copy || (await network);
  } catch (error) {
    const copy = await cache.match(request, { ignoreSearch: true });
    if (copy) return copy;
    throw error;
  }
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith("annona-driver-") && name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const kind = cacheKind(url, event.request);
  if (!kind) return;
  event.respondWith(networkFirst(event.request, kind));
});

// Première visite : la page n'était pas encore contrôlée ; elle envoie les adresses déjà chargées.
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "annona:cache-urls" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        data.urls.slice(0, MAX_STATIC_ENTRIES).map(async (value) => {
          try {
            const url = new URL(value, self.location.origin);
            const request = new Request(url.href, { credentials: "same-origin" });
            const kind = url.pathname.startsWith("/driver") ? "page" : cacheKind(url, request);
            if (!kind) return;
            await store(cache, request, await fetch(request), kind);
          } catch {
            // Hors réseau ou adresse refusée : copiée plus tard, au prochain passage.
          }
        })
      )
    )
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Annona", {
      body: data.body || "",
      icon: "/icon.png",
      tag: data.tag || "annona",
      renotify: true,
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requested = event.notification.data && event.notification.data.url;
  const path = typeof requested === "string" && requested.startsWith("/driver") ? requested : "/driver";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).pathname.startsWith("/driver"));
      if (open) return open.focus().then((client) => client.navigate(path));
      return self.clients.openWindow(path);
    })
  );
});
