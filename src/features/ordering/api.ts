import type {
  PortalCatalog,
  PortalMerchantProfile,
  PortalOrderDetail,
  PortalOrderList,
  PortalRecurringOrder,
} from "@/domains/order/merchant-order.types";
import type { RecurringOrderInput, SaveOrderInput, UpdateRecurringOrderInput } from "@/lib/validations/order";

/** Erreur d'API avec son code métier (ex. ORDER_EXISTS) et ses détails. */
export class PortalApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = "PortalApiError";
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  let json: { error?: string; code?: string; details?: Record<string, unknown>; data?: T } = {};
  try {
    json = await res.json();
  } catch {
    if (!res.ok) throw new PortalApiError(`Erreur serveur (${res.status})`, res.status);
  }
  if (!res.ok) throw new PortalApiError(json.error ?? `Erreur serveur (${res.status})`, res.status, json.code, json.details);
  return json.data as T;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** Portail client : commande (CMD-1). */
export const orderingApi = {
  catalog: () => call<PortalCatalog>("/api/portal/catalog"),
  profile: () => call<PortalMerchantProfile>("/api/portal/merchant"),
  orders: (scope: "upcoming" | "history", before?: string | null) =>
    call<PortalOrderList>(`/api/portal/orders?scope=${scope}${before ? `&before=${before}` : ""}`),
  order: (id: string) => call<PortalOrderDetail>(`/api/portal/orders/${encodeURIComponent(id)}`),
  lookup: (date: string, slotId: string) =>
    call<PortalOrderDetail | null>(`/api/portal/orders/lookup?date=${date}&slotId=${encodeURIComponent(slotId)}`),
  save: (input: SaveOrderInput) => call<PortalOrderDetail>("/api/portal/orders", jsonInit("PUT", input)),
  cancel: (id: string) => call<PortalOrderDetail>(`/api/portal/orders/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
  reorder: (id: string, target: { deliveryDate: string; slotId: string }) =>
    call<PortalOrderDetail>(`/api/portal/orders/${encodeURIComponent(id)}/reorder`, jsonInit("POST", target)),
  recurring: () => call<PortalRecurringOrder[]>("/api/portal/recurring"),
  createRecurring: (input: RecurringOrderInput) => call<{ id: string }>("/api/portal/recurring", jsonInit("POST", input)),
  updateRecurring: (id: string, input: UpdateRecurringOrderInput) =>
    call<{ id: string }>(`/api/portal/recurring/${encodeURIComponent(id)}`, jsonInit("PATCH", input)),
  deleteRecurring: (id: string) => call<void>(`/api/portal/recurring/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
