/**
 * MOBILE-1 — nettoyage de l'appareil à la déconnexion : le téléphone ne reçoit plus les notifications
 * natives de ce compte et la copie hors réseau des écrans livreur est effacée (un autre compte
 * connecté ensuite sur ce téléphone ne la verra jamais). Au mieux : n'empêche jamais la déconnexion.
 */
import { releaseNativePush } from "@/lib/native/push";

/** Même nom que `CACHE_NAME` dans `public/sw.js`. */
export const DRIVER_OFFLINE_CACHE = "annona-driver-v1";

const RELEASE_TIMEOUT_MS = 3_000;

export async function releaseDeviceOnLogout(): Promise<void> {
  const tasks: Array<Promise<unknown>> = [releaseNativePush()];
  if (typeof caches !== "undefined") tasks.push(caches.delete(DRIVER_OFFLINE_CACHE));
  await Promise.race([
    Promise.allSettled(tasks),
    new Promise((resolve) => setTimeout(resolve, RELEASE_TIMEOUT_MS)),
  ]);
}
