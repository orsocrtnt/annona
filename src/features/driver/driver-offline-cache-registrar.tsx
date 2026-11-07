"use client";

import { useEffect } from "react";
import { driverOfflineUrls } from "@/features/driver/driver-offline-cache";

/**
 * MOBILE-1, LIV-06 — active la copie hors réseau des écrans livreur : un rechargement sans réseau
 * réaffiche la tournée déjà chargée (la file d'actions reste dans IndexedDB). Build de production
 * seulement : en développement, les fichiers changent à chaque modification.
 * Sans effet dans l'application iPhone (pas de service worker dans la vue web d'iOS hors domaines
 * déclarés) : la page de repli « hors connexion » de l'application prend le relais.
 */
export function DriverOfflineCacheRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    void navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        if (cancelled) return;
        const resources = performance.getEntriesByType("resource").map((entry) => entry.name);
        registration.active?.postMessage({
          type: "annona:cache-urls",
          urls: driverOfflineUrls({ origin: location.origin, pathname: location.pathname, resources }),
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
