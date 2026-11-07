import type { ProductionDay } from "@/domains/production/production.types";

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

const jsonInit = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** Espace boulanger (BOU-1). */
export const productionApi = {
  day: (date: string) => call<ProductionDay>(`/api/production?date=${encodeURIComponent(date)}`),
  prepared: (orderId: string, prepared: boolean) =>
    call<{ orderId: string; status: string }>(`/api/production/orders/${encodeURIComponent(orderId)}/prepared`, jsonInit({ prepared })),
  shortage: (lineId: string, quantityDelivered: number) =>
    call<{ lineId: string; quantityDelivered: number }>(`/api/production/lines/${encodeURIComponent(lineId)}/shortage`, jsonInit({ quantityDelivered })),
};
