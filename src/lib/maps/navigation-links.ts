/**
 * TOUR-1, LIV-04 — liens d'ouverture d'un arrêt dans une application de navigation, après « Livré ».
 * Module pur (testé). Avec des coordonnées, l'itinéraire vise le point exact ; sans coordonnées
 * (commerce non géocodé), l'adresse postale est passée en recherche.
 *
 * - Plans (Apple) : `https://maps.apple.com/?daddr=…&dirflg=d` ouvre l'app Plans sur iPhone (lien
 *   universel) et le site Plans ailleurs ; `maps://` n'existe que sur les appareils Apple.
 * - Waze : `https://waze.com/ul?ll=lat,lng&navigate=yes` lance le guidage dans l'app si elle est
 *   installée, sinon la page web de Waze.
 * - Google Maps : voir `googleMapsUrl`.
 */
export interface NavigationTarget {
  latitude: number | null;
  longitude: number | null;
  /** Adresse complète (rue, code postal, ville), utilisée sans coordonnées. */
  address: string;
}

function coordinates(target: NavigationTarget): string | null {
  const { latitude, longitude } = target;
  if (latitude === null || longitude === null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

export function appleMapsUrl(target: NavigationTarget): string {
  const point = coordinates(target);
  // Coordonnées : chiffres, point, signe moins et virgule, sûrs tels quels dans l'URL.
  const destination = point ?? encodeURIComponent(target.address.trim());
  return `https://maps.apple.com/?daddr=${destination}&dirflg=d`;
}

export function wazeUrl(target: NavigationTarget): string {
  const point = coordinates(target);
  if (point) return `https://waze.com/ul?ll=${point}&navigate=yes`;
  return `https://waze.com/ul?q=${encodeURIComponent(target.address.trim())}&navigate=yes`;
}

/**
 * Google Maps : `https://www.google.com/maps/dir/?api=1&destination=…&travelmode=driving` (adresse universelle
 * documentée par Google) ouvre l'application Google Maps sur Android et sur iPhone si elle est installée,
 * sinon le site.
 */
export function googleMapsUrl(target: NavigationTarget): string {
  const destination = coordinates(target) ?? encodeURIComponent(target.address.trim());
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
}

export type NavigationApp = "plans" | "googleMaps" | "waze";

export function navigationUrl(app: NavigationApp, target: NavigationTarget): string {
  if (app === "plans") return appleMapsUrl(target);
  if (app === "googleMaps") return googleMapsUrl(target);
  return wazeUrl(target);
}

/** iPhone, iPad (qui se présente comme un Mac) et Mac : seuls appareils où Plans est une vraie application. */
const APPLE_DEVICE = /iPhone|iPad|iPod|Macintosh/;

/**
 * LIV-04, décision d'Orso du 15 novembre 2026 : un seul menu avec toutes les applications. Google Maps et Waze
 * partout ; Plans en plus, et en premier, sur les appareils Apple. Ailleurs (Android surtout), le lien Plans
 * n'ouvrait que la carte web d'Apple dans le navigateur (recette Android du 15 novembre, critère 7).
 */
export function navigationAppsFor(device: { platform: "ios" | "android" | "web"; userAgent: string }): NavigationApp[] {
  const apple = device.platform === "ios" || (device.platform === "web" && APPLE_DEVICE.test(device.userAgent));
  return apple ? ["plans", "googleMaps", "waze"] : ["googleMaps", "waze"];
}
