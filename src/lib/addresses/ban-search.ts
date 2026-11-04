import type { AddressSuggestion } from "@/lib/addresses/types";

type BanFeature = {
  type: "Feature";
  geometry?: { type: "Point"; coordinates?: [number, number] };
  properties?: {
    id?: string;
    label?: string;
    name?: string;
    postcode?: string;
    city?: string;
    score?: number;
    type?: "housenumber" | "street" | "locality" | "municipality";
  };
};

type BanSearchResponse = {
  features?: BanFeature[];
};

/** Numéro tapé en tête de saisie : « 45 », « 12 bis », « 3B ». */
export function leadingHouseNumber(query: string): string | null {
  const match = /^\s*(\d{1,4}(?:\s?(?:bis|ter|quater|[a-d]))?)(?=[\s,])/i.exec(query);
  return match ? match[1]!.replace(/\s+/g, " ").toLowerCase() : null;
}

function mapBanFeature(feature: BanFeature, index: number, houseNumber: string | null): AddressSuggestion | null {
  const coordinates = feature.geometry?.coordinates;
  const properties = feature.properties;
  if (!coordinates || !properties?.label) return null;

  const [longitude, latitude] = coordinates;
  const address = properties.name?.trim() || properties.label.split(",")[0]?.trim() || properties.label;
  const city = properties.city?.trim() ?? "";
  const postalCode = properties.postcode?.trim() ?? "";

  // La Base Adresse Nationale ne connaît pas toujours le numéro : elle renvoie alors la rue seule.
  // On garde le numéro tapé (le livreur en a besoin) et on signale que le pin indique la rue.
  const keepTypedNumber = houseNumber !== null && properties.type !== undefined && properties.type !== "housenumber";
  return {
    id: properties.id ?? `${latitude}-${longitude}-${index}`,
    label: keepTypedNumber ? `${houseNumber} ${properties.label}` : properties.label,
    address: keepTypedNumber ? `${houseNumber} ${address}` : address,
    ...(keepTypedNumber ? { numberUnverified: true } : {}),
    city,
    postalCode,
    latitude,
    longitude,
    score: properties.score ?? 0,
  };
}

export async function searchBanAddresses(query: string, limit = 6): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const url = new URL("https://api-adresse.data.gouv.fr/search/");
  url.searchParams.set("q", trimmed);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("autocomplete", "1");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error("ADDRESS_SEARCH_FAILED");
  }

  const data = (await response.json()) as BanSearchResponse;
  return (data.features ?? [])
    .map((feature, index) => mapBanFeature(feature, index, leadingHouseNumber(trimmed)))
    .filter((item): item is AddressSuggestion => item !== null);
}
