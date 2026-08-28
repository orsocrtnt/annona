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

/** Position approximative à partir du code postal (secours sans API). */
export function geocodeFrenchPostalCode(postalCode: string): { lat: number; lng: number } {
  const code = postalCode.trim().slice(0, 5);
  if (!/^\d{5}$/.test(code)) return PARIS_CENTER;

  const dept = Number(code.slice(0, 2));
  const suffix = Number(code.slice(2));

  const lat = 48.85 + (dept - 75) * 0.06 + (suffix % 100) * 0.0008;
  const lng = 2.35 + (dept - 75) * 0.04 + Math.floor(suffix / 100) * 0.0008;

  return { lat, lng };
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

/** Géocodage via la Base Adresse Nationale (data.gouv.fr). */
export async function geocodeAddress(parts: AddressParts): Promise<{ lat: number; lng: number }> {
  const query = formatAddressQuery(parts);
  if (!query) return PARIS_CENTER;

  const cacheKey = query.toLowerCase();
  const cached = geocodeCache.get(cacheKey);
  if (cached) return cached;

  try {
    const url = new URL("https://api-adresse.data.gouv.fr/search/");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "1");
    const postcode = parts.postalCode?.trim().slice(0, 5);
    if (postcode && /^\d{5}$/.test(postcode)) {
      url.searchParams.set("postcode", postcode);
    }

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 86_400 },
    });

    if (response.ok) {
      const data = (await response.json()) as {
        features?: { geometry?: { coordinates?: [number, number] } }[];
      };
      const coordinates = data.features?.[0]?.geometry?.coordinates;
      if (coordinates) {
        const [lng, lat] = coordinates;
        const result = { lat, lng };
        geocodeCache.set(cacheKey, result);
        return result;
      }
    }
  } catch (error) {
    console.warn("[geocoding] BAN lookup failed:", query, error);
  }

  if (parts.postalCode?.trim()) {
    const fallback = geocodeFrenchPostalCode(parts.postalCode);
    geocodeCache.set(cacheKey, fallback);
    return fallback;
  }

  return PARIS_CENTER;
}

export async function geocodeMany(
  entries: { key: string; parts: AddressParts }[]
): Promise<Map<string, { lat: number; lng: number }>> {
  const results = new Map<string, { lat: number; lng: number }>();

  await Promise.all(
    entries.map(async (entry) => {
      const coords = await geocodeAddress(entry.parts);
      results.set(entry.key, coords);
    })
  );

  return results;
}

/** @deprecated Préférer geocodeAddress — conservé pour compatibilité synchrone. */
export function resolveCoordinates(
  postalCode: string | null | undefined,
  tracking?: { latitude: number | null; longitude: number | null } | null
): { lat: number; lng: number } {
  if (
    tracking?.latitude != null &&
    tracking?.longitude != null &&
    !isLegacyFakeTrackingCoord(tracking.latitude, tracking.longitude)
  ) {
    return { lat: tracking.latitude, lng: tracking.longitude };
  }
  if (postalCode?.trim()) {
    return geocodeFrenchPostalCode(postalCode);
  }
  return PARIS_CENTER;
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
