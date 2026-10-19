import { GEOCODING_URL, isValidCoordinate } from "@/lib/maps/provider-config";
import { fetchProviderJson } from "@/lib/maps/provider-request";

const PARIS_CENTER = { lat: 48.8566, lng: 2.3522 };

export type AddressParts = {
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
};

const geocodeCache = new Map<string, { lat: number; lng: number }>();

export function formatAddressQuery(parts: AddressParts): string {
  return [parts.address, parts.postalCode, parts.city].filter(Boolean).join(", ").trim();
}

/** Coordonnées fictives laissées par d'anciennes versions (centre Paris). */
export function isLegacyFakeTrackingCoord(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): boolean {
  if (latitude == null || longitude == null) return false;
  return (
    (Math.abs(latitude - 48.8566) < 0.001 && Math.abs(longitude - 2.3522) < 0.001) ||
    (Math.abs(latitude - 48.8584) < 0.001 && Math.abs(longitude - 2.2945) < 0.001)
  );
}

type Coordinates = { lat: number; lng: number };
const pendingGeocodes = new Map<string, Promise<Coordinates | null>>();
const geocodeExpiry = new Map<string, number>();
let geocodeBlockedUntil = 0;

/** IGN/BAN address index. Failure never becomes an invented point. */
export async function geocodeAddress(parts: AddressParts): Promise<Coordinates | null> {
  const query = formatAddressQuery(parts);
  if (!query) return null;
  const cacheKey = query.toLowerCase();
  if ((geocodeExpiry.get(cacheKey) ?? 0) > Date.now()) return geocodeCache.get(cacheKey) ?? null;
  const pending = pendingGeocodes.get(cacheKey);
  if (pending) return pending;
  // A local bound, not an IP-wide quota across serverless instances.
  if (pendingGeocodes.size >= 8 || Date.now() < geocodeBlockedUntil) return null;
  const request = (async () => {
    let result: Coordinates | null = null;
    try {
      const url = new URL(GEOCODING_URL);
      url.searchParams.set("q", query);
      url.searchParams.set("limit", "1");
      url.searchParams.set("index", "address");
      const postcode = parts.postalCode?.trim();
      if (postcode && /^\d{5}$/.test(postcode)) url.searchParams.set("postcode", postcode);
      const data = await fetchProviderJson(url.toString()) as {
        features?: { properties?: { score?: number }; geometry?: { coordinates?: [number, number] } }[];
      };
      const feature = data.features?.[0];
      const point = feature?.geometry?.coordinates;
      if (point && isValidCoordinate(point[1], point[0]) && (feature?.properties?.score ?? 0) >= 0.6) result = { lat: point[1], lng: point[0] };
    } catch {
      // Prevent a tight retry loop, including 429, without logging the address.
      geocodeBlockedUntil = Date.now() + 5_000;
    }
    if (geocodeExpiry.size >= 1000) { geocodeCache.clear(); geocodeExpiry.clear(); }
    if (result) geocodeCache.set(cacheKey, result); else geocodeCache.delete(cacheKey);
    geocodeExpiry.set(cacheKey, Date.now() + (result ? 86_400_000 : 30_000));
    return result;
  })().finally(() => pendingGeocodes.delete(cacheKey));
  pendingGeocodes.set(cacheKey, request);
  return request;
}

export async function geocodeMany(
  entries: { key: string; parts: AddressParts }[]
): Promise<Map<string, { lat: number; lng: number }>> {
  const results = new Map<string, { lat: number; lng: number }>();

  await Promise.all(
    entries.map(async (entry) => {
      const coords = await geocodeAddress(entry.parts);
      if (coords) results.set(entry.key, coords);
    })
  );

  return results;
}

export function averageCoordinates(points: { lat: number; lng: number }[]): { lat: number; lng: number } {
  if (points.length === 0) return PARIS_CENTER;
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

/** Plafond d'appels BAN par requête carte (le reste attend le poll suivant). */
const GEOCODE_BATCH_SIZE = 8;

export async function geocodeManyCapped(
  entries: { key: string; parts: AddressParts }[],
  limit = GEOCODE_BATCH_SIZE
): Promise<Map<string, { lat: number; lng: number }>> {
  if (entries.length === 0) return new Map();
  return geocodeMany(entries.slice(0, limit));
}
