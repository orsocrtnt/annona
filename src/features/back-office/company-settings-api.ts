import type { CompanyDeliveryOptions } from "@/lib/validations/company-settings";
import type { CompanyDeliverySlots } from "@/lib/validations/delivery-slots";
import type { ProofRules } from "@/domains/delivery/pod-evidence";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
  return json.data as T;
}

export const companySettingsApi = {
  getDeliverySlots: () => fetchJson<CompanyDeliverySlots>("/api/company/delivery-slots"),
  updateDeliverySlots: (data: CompanyDeliverySlots) =>
    fetchJson<CompanyDeliverySlots>("/api/company/delivery-slots", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  getDeliveryOptions: () => fetchJson<CompanyDeliveryOptions>("/api/company/settings"),
  updateDeliveryOptions: (data: CompanyDeliveryOptions) =>
    fetchJson<CompanyDeliveryOptions>("/api/company/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  getPortalSettings: () => fetchJson<{ portalShowDriverPhone: boolean }>("/api/company/portal-settings"),
  updatePortalSettings: (data: { portalShowDriverPhone: boolean }) =>
    fetchJson<{ portalShowDriverPhone: boolean }>("/api/company/portal-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  getProofRules: () => fetchJson<ProofRules>("/api/company/proof-rules"),
  updateProofRules: (data: Partial<ProofRules>) =>
    fetchJson<ProofRules>("/api/company/proof-rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
};
