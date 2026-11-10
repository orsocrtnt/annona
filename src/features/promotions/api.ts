import type { PromotionRow } from "@/domains/catalog/promotion.service";
import type { CreatePromotionInput } from "@/lib/validations/catalog";

export type { PromotionRow };

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

/** Lot 1, demande 2 : promotions du back-office. */
export const promotionsApi = {
  list: () => call<PromotionRow[]>("/api/catalog/promotions"),
  create: (input: CreatePromotionInput) =>
    call<PromotionRow>("/api/catalog/promotions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }),
  stop: (id: string) => call<PromotionRow>(`/api/catalog/promotions/${encodeURIComponent(id)}/stop`, { method: "POST" }),
};
