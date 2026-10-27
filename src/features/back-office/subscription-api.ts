import type { SubscriptionView } from "@/domains/billing/subscription-view.types";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "Chargement impossible");
  return body.data as T;
}

export const subscriptionApi = {
  get: () => fetchJson<SubscriptionView | null>("/api/billing/subscription"),
};
