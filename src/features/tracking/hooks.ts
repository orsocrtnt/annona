"use client";

import { useQuery } from "@tanstack/react-query";
import type { DriverTracking } from "@/domains/round/driver-tracking.service";

/** Lot 1, demande 5 : rafraîchi toutes les 15 s (le livreur envoie sa position au moins toutes les 30 s). */
export const TRACKING_REFRESH_MS = 15_000;

async function fetchTracking(): Promise<DriverTracking> {
  const res = await fetch("/api/tracking", { cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { data?: DriverTracking; error?: string };
  if (!res.ok || !json.data) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data;
}

export function useDriverTracking() {
  return useQuery({
    queryKey: ["tracking"],
    queryFn: fetchTracking,
    refetchInterval: TRACKING_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: 5_000,
  });
}
