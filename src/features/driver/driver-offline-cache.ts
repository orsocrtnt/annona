/**
 * MOBILE-1, LIV-06 — copie hors réseau des écrans livreur (service worker `public/sw.js`).
 * Module pur : liste des adresses à copier lors de la première visite (la page n'était pas encore
 * contrôlée par le service worker au moment de son chargement).
 */
export const DRIVER_ROUNDS_API = "/api/driver/rounds";

export function driverOfflineUrls(input: { origin: string; pathname: string; resources: readonly string[] }): string[] {
  const urls = new Set<string>();
  if (input.pathname === "/driver" || input.pathname.startsWith("/driver/")) urls.add(input.pathname);
  urls.add(DRIVER_ROUNDS_API);
  for (const value of input.resources) {
    try {
      const url = new URL(value, input.origin);
      if (url.origin === input.origin && url.pathname.startsWith("/_next/static/")) urls.add(url.pathname + url.search);
    } catch {
      // Adresse illisible : ignorée.
    }
  }
  return [...urls];
}
