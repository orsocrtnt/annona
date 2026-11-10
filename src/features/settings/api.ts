import type { CompanySettingsView } from "@/domains/company/company-settings.service";
import type { ZoneRow } from "@/domains/company/delivery-zone.service";

export type { CompanySettingsView, ZoneRow };

export interface ZoneInput {
  name: string;
  morningStart: string;
  morningEnd: string;
  eveningStart: string;
  eveningEnd: string;
}

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

/** ADM-1 : paramètres et tournées (lot 1, demande 1) de l'entreprise. */
export const settingsApi = {
  get: () => call<CompanySettingsView>("/api/company/settings"),
  update: (input: Partial<CompanySettingsView>) => call<CompanySettingsView>("/api/company/settings", jsonInit("PATCH", input)),
  zones: () => call<ZoneRow[]>("/api/company/zones"),
  createZone: (input: ZoneInput) => call<ZoneRow[]>("/api/company/zones", jsonInit("POST", input)),
  updateZone: (id: string, input: Partial<ZoneInput> & { active?: boolean }) =>
    call<ZoneRow[]>(`/api/company/zones/${encodeURIComponent(id)}`, jsonInit("PATCH", input)),
  deleteZone: (id: string) => call<ZoneRow[]>(`/api/company/zones/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
