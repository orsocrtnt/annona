import type { MerchantDetail, MerchantListRow } from "@/domains/merchant/merchant-admin.service";
import type { CreateMerchantInput, UpdateMerchantInput } from "@/lib/validations/company-admin";

export type { MerchantDetail, MerchantListRow };

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  let json: { error?: string; data?: T } = {};
  try {
    json = await res.json();
  } catch {
    if (!res.ok) throw new Error(`Erreur serveur (${res.status})`);
  }
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as T;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** ADM-1 : fiches clients du back-office. */
export const merchantsApi = {
  list: (status: "all" | "active" | "inactive") => call<MerchantListRow[]>(`/api/merchants?status=${status}`),
  get: (id: string) => call<MerchantDetail>(`/api/merchants/${encodeURIComponent(id)}`),
  create: (input: CreateMerchantInput) => call<MerchantDetail>("/api/merchants", jsonInit("POST", input)),
  update: (id: string, input: UpdateMerchantInput) => call<MerchantDetail>(`/api/merchants/${encodeURIComponent(id)}`, jsonInit("PATCH", input)),
};
