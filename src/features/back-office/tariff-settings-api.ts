import type { CompanyTariffSettings } from "@/lib/validations/tariff-settings";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
  return json.data as T;
}

export const tariffSettingsApi = {
  get: () => fetchJson<CompanyTariffSettings>("/api/company/tariffs"),
  update: (data: CompanyTariffSettings) =>
    fetchJson<CompanyTariffSettings>("/api/company/tariffs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
};
