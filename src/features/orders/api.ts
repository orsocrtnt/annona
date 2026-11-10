import type { AdminOrderDay, AdminOrderDetail } from "@/domains/order/admin-order.types";
import type { AdminCorrectOrderInput } from "@/lib/validations/order";

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

/** Back-office des commandes (LOCK-1 : ADM-04, ADM-05). */
export const adminOrdersApi = {
  day: (date: string, filters: { merchantId?: string | null; roundId?: string | null; view?: string | null }) => {
    const params = new URLSearchParams({ date });
    if (filters.merchantId) params.set("merchantId", filters.merchantId);
    if (filters.roundId) params.set("roundId", filters.roundId);
    if (filters.view) params.set("view", filters.view);
    return call<AdminOrderDay>(`/api/orders?${params.toString()}`);
  },
  order: (id: string) => call<AdminOrderDetail>(`/api/orders/${encodeURIComponent(id)}`),
  correct: (id: string, input: AdminCorrectOrderInput) => call<AdminOrderDetail>(`/api/orders/${encodeURIComponent(id)}`, jsonInit("PATCH", input)),
  cancel: (id: string, note: string | null) => call<AdminOrderDetail>(`/api/orders/${encodeURIComponent(id)}/cancel`, jsonInit("POST", { note })),
};
