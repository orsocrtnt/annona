"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PortalDashboardLayoutSettings } from "@/lib/dashboard/portal-dashboard-layout";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
  return json.data as T;
}

export function usePortalDashboardLayout(initialData?: PortalDashboardLayoutSettings) {
  return useQuery({
    queryKey: ["portal", "dashboard-layout"],
    queryFn: () => fetchJson<PortalDashboardLayoutSettings>("/api/portal/dashboard-layout"),
    initialData,
  });
}

export function useUpdatePortalDashboardLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (layout: PortalDashboardLayoutSettings) =>
      fetchJson<PortalDashboardLayoutSettings>("/api/portal/dashboard-layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(layout),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["portal", "dashboard-layout"], data);
    },
  });
}

export function useResetPortalDashboardLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson<PortalDashboardLayoutSettings>("/api/portal/dashboard-layout", {
        method: "DELETE",
      }),
    onSuccess: (data) => {
      qc.setQueryData(["portal", "dashboard-layout"], data);
    },
  });
}
