/**
 * MOBILE-1, LIV-06 — copie hors réseau des écrans livreur (service worker `public/sw.js`).
 * Module pur : liste des adresses à copier lors de la première visite (la page n'était pas encore
 * contrôlée par le service worker au moment de son chargement).
 */
export const DRIVER_ROUNDS_API = "/api/driver/rounds";
/** Session du livreur : le service worker ne la garde que pour un compte livreur (rechargement hors réseau). */
export const SESSION_API = "/api/auth/session";
/**
 * En-tête ajouté par le service worker à une réponse servie depuis sa copie hors réseau (RECETTE-V1 N1) :
 * l'écran ne la prend pas pour une lecture fraîche du serveur. Même nom dans `public/sw.js`.
 */
export const OFFLINE_COPY_HEADER = "x-annona-offline-copy";

export function driverOfflineUrls(input: { origin: string; pathname: string; resources: readonly string[] }): string[] {
  const urls = new Set<string>();
  if (input.pathname === "/driver" || input.pathname.startsWith("/driver/")) urls.add(input.pathname);
  urls.add(DRIVER_ROUNDS_API);
  urls.add(SESSION_API);
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
