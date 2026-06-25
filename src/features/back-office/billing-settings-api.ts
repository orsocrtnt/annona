import type { CompanyBillingSettings } from "@/lib/validations/billing-settings";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
  return json.data as T;
}

export const billingSettingsApi = {
  get: () => fetchJson<CompanyBillingSettings>("/api/company/billing-settings"),
  update: (data: CompanyBillingSettings) =>
    fetchJson<CompanyBillingSettings>("/api/company/billing-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
};
