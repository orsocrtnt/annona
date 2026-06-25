"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DashboardLayoutSettings } from "@/lib/dashboard/dashboard-layout";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
  return json.data as T;
}

export function useDashboardLayout(initialData?: DashboardLayoutSettings) {
  return useQuery({
    queryKey: ["back-office", "dashboard-layout"],
    queryFn: () => fetchJson<DashboardLayoutSettings>("/api/back-office/dashboard-layout"),
    initialData,
  });
}

export function useUpdateDashboardLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (layout: DashboardLayoutSettings) =>
      fetchJson<DashboardLayoutSettings>("/api/back-office/dashboard-layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(layout),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["back-office", "dashboard-layout"], data);
    },
  });
}

export function useResetDashboardLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson<DashboardLayoutSettings>("/api/back-office/dashboard-layout", {
        method: "DELETE",
      }),
    onSuccess: (data) => {
      qc.setQueryData(["back-office", "dashboard-layout"], data);
    },
  });
}
