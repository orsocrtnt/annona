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
  };
};

type BanSearchResponse = {
  features?: BanFeature[];
};

function mapBanFeature(feature: BanFeature, index: number): AddressSuggestion | null {
  const coordinates = feature.geometry?.coordinates;
  const properties = feature.properties;
  if (!coordinates || !properties?.label) return null;

  const [longitude, latitude] = coordinates;
  const address = properties.name?.trim() || properties.label.split(",")[0]?.trim() || properties.label;
  const city = properties.city?.trim() ?? "";
  const postalCode = properties.postcode?.trim() ?? "";

  return {
    id: properties.id ?? `${latitude}-${longitude}-${index}`,
    label: properties.label,
    address,
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
    .map((feature, index) => mapBanFeature(feature, index))
    .filter((item): item is AddressSuggestion => item !== null);
}
