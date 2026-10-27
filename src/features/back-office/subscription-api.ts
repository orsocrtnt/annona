import type { SubscriptionView } from "@/domains/billing/subscription-view.types";

export type BillingPlanCode = "STARTER" | "PRO" | "BUSINESS";
export type BillingInterval = "MONTHLY" | "ANNUAL";
export type BillingSelection = { planCode: BillingPlanCode; billingInterval: BillingInterval; selections: Array<{ code: string; quantity: number }> };
export type BillingPlan = { code: BillingPlanCode; name: string; monthlyPriceCents: number; annualPriceCents: number };
export type ChangePreview = {
  totalCents: number;
  currency: string;
  timing: "immediate" | "renewal";
  prorationDate: number;
  quote: { totalTtcCents: number; billingInterval: BillingInterval };
  assessment: {
    blockers: Array<{ resource: "drivers" | "admins" | "dispatchers"; current: number; limit: number; excess: number }>;
    lostFeatures: string[];
    orderOverage: { current: number; included: number; overage: number } | null;
  };
};

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
  plans: async () => {
    const response = await fetch("/api/billing", { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? "Formules indisponibles");
    return body as { plans: BillingPlan[]; current: BillingSelection | null };
  },
  preview: (selection: BillingSelection) => postBilling<ChangePreview>({ action: "preview", selection }),
  /** La clé reste la même pour toutes les tentatives d'une même confirmation : jamais deux changements. */
  change: (selection: BillingSelection, key: string, preview: ChangePreview) =>
    postBilling<{ timing: string }>({ action: "change", selection, key, prorationDate: preview.prorationDate, confirmedTotalCents: preview.totalCents, confirmed: true }),
  /** La clé reste la même pour toutes les tentatives d'une même confirmation : jamais deux résiliations. */
  cancel: (key: string) => postBilling<{ cancelAtPeriodEnd: true }>({ action: "cancel", key, confirmed: true }),
};
