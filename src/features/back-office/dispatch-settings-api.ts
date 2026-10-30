import type { AutoDispatchPreview } from "@/domains/delivery/auto-dispatch.service";
import type { CompanyDispatchSettings } from "@/lib/validations/dispatch-settings";

export type OperationJobHealth = {
  pending: number;
  processing: number;
  failed: number;
  failedJobs: Array<{
    id: string;
    type: "AUTO_DISPATCH" | "CLIENT_NOTIFICATION";
    attempts: number;
    maxAttempts: number;
    lastError: string | null;
    updatedAt: string;
  }>;
};

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
  previewAutoAssign: () => fetchJson<AutoDispatchPreview>("/api/dispatch/auto-assign"),
  runAutoAssign: (assignments?: Array<{ deliveryId: string; driverId: string }>) =>
    fetchJson<{ assigned: number; skipped: number; message?: string }>(
      "/api/dispatch/auto-assign",
      assignments
        ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignments }) }
        : { method: "POST" }
    ),
  getOperationJobHealth: () =>
    fetchJson<OperationJobHealth>("/api/operations/jobs"),
  retryFailedOperationJobs: () =>
    fetchJson<{ retried: number }>("/api/operations/jobs", { method: "POST" }),
};
