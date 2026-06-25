import type { DriverLocationSettings } from "@/lib/validations/driver-location-settings";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
  return json.data as T;
}

export const locationSettingsApi = {
  get: () => fetchJson<DriverLocationSettings>("/api/company/location-settings"),
  update: (data: DriverLocationSettings) =>
    fetchJson<DriverLocationSettings>("/api/company/location-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
};
