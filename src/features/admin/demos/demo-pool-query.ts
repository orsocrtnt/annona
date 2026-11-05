"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DemoPoolRow } from "@/domains/demo/demo-pool-admin.service";

export type { DemoPoolRow };

export interface DemoPoolOverview {
  available: number;
  total: number;
  reserved: number;
  live: number;
  preparing: number;
  quarantined: number;
  environments: DemoPoolRow[];
}

const QUERY_KEY = ["admin", "demo-pool"] as const;

async function fetchDemoPool(): Promise<DemoPoolOverview> {
  const res = await fetch("/api/admin/demo-pool", { cache: "no-store" });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.data) throw new Error(json?.error ?? "Démos indisponibles");
  return json.data as DemoPoolOverview;
}

/** Compteur et liste des démos, relus chaque minute tant que la page est au premier plan. */
export function useDemoPool() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: fetchDemoPool, refetchInterval: 60_000 });
}

/** Remise à neuf d'une démo (`id`) ou de toutes celles où personne n'est en direct (sans `id`). */
export function useResetDemoPool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id?: string): Promise<number> => {
      const res = await fetch("/api/admin/demo-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : {}),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Remise à neuf impossible.");
      return Number(json?.data?.queued ?? 0);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
