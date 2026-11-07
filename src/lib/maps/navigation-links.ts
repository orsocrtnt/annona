/**
 * TOUR-1, LIV-04 — liens d'ouverture d'un arrêt dans une application de navigation, après « Livré ».
 * Module pur (testé). Avec des coordonnées, l'itinéraire vise le point exact ; sans coordonnées
 * (commerce non géocodé), l'adresse postale est passée en recherche.
 *
 * - Plans (Apple) : `https://maps.apple.com/?daddr=…&dirflg=d` ouvre l'app Plans sur iPhone (lien
 *   universel) et le site Plans ailleurs ; `maps://` n'existe que sur les appareils Apple.
 * - Waze : `https://waze.com/ul?ll=lat,lng&navigate=yes` lance le guidage dans l'app si elle est
 *   installée, sinon la page web de Waze.
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
