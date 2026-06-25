import type { CompanyDeliveryOptions } from "@/lib/validations/company-settings";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
  return json.data as T;
}

export const companySettingsApi = {
  getDeliveryOptions: () => fetchJson<CompanyDeliveryOptions>("/api/company/settings"),
  updateDeliveryOptions: (data: CompanyDeliveryOptions) =>
    fetchJson<CompanyDeliveryOptions>("/api/company/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
};
