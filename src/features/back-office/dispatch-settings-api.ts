import type { CompanyDispatchSettings } from "@/lib/validations/dispatch-settings";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
  return json.data as T;
}

export const dispatchSettingsApi = {
  get: () => fetchJson<CompanyDispatchSettings>("/api/company/dispatch"),
  update: (data: CompanyDispatchSettings) =>
    fetchJson<CompanyDispatchSettings>("/api/company/dispatch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  runAutoAssign: () =>
    fetchJson<{ assigned: number; skipped: number; message?: string }>(
      "/api/dispatch/auto-assign",
      { method: "POST" }
    ),
};
