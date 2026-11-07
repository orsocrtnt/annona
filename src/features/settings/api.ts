import type { CompanySettingsView } from "@/domains/company/company-settings.service";
import type { SlotRow } from "@/domains/company/slot-admin.service";

export type { CompanySettingsView, SlotRow };

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

const jsonInit = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** ADM-1 : paramètres et créneaux de l'entreprise. */
export const settingsApi = {
  get: () => call<CompanySettingsView>("/api/company/settings"),
  update: (input: Partial<CompanySettingsView>) => call<CompanySettingsView>("/api/company/settings", jsonInit("PATCH", input)),
  slots: () => call<SlotRow[]>("/api/company/slots"),
  createSlot: (input: { label: string | null; startTime: string; endTime: string }) => call<SlotRow[]>("/api/company/slots", jsonInit("POST", input)),
  updateSlot: (id: string, input: { label?: string | null; startTime?: string; endTime?: string; active?: boolean }) =>
    call<SlotRow[]>(`/api/company/slots/${encodeURIComponent(id)}`, jsonInit("PATCH", input)),
  deleteSlot: (id: string) => call<SlotRow[]>(`/api/company/slots/${encodeURIComponent(id)}`, { method: "DELETE" }),
  reorderSlots: (ids: string[]) => call<SlotRow[]>("/api/company/slots/order", jsonInit("PUT", { ids })),
};
