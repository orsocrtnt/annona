import type { SubscriptionView } from "@/domains/billing/subscription-view.types";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "Chargement impossible");
  return body.data as T;
}

async function postBilling<T>(payload: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/billing", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "Demande non appliquée. Réessayez dans un instant.");
  return body as T;
}

export const subscriptionApi = {
  get: () => fetchJson<SubscriptionView | null>("/api/billing/subscription"),
  /** La clé reste la même pour toutes les tentatives d'une même confirmation : jamais deux résiliations. */
  cancel: (key: string) => postBilling<{ cancelAtPeriodEnd: true }>({ action: "cancel", key, confirmed: true }),
};
