"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
type ServiceState = { active: boolean; startedAt: string | null; endedAt: string | null };
async function serviceRequest(active?: boolean): Promise<ServiceState> {
  const response = await fetch("/api/driver/service", { cache: "no-store", ...(active === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ active }) }) });
  const json = await response.json(); if (!response.ok) throw new Error(json.error ?? "Service indisponible."); return json.data;
}
export function useDriverService() { return useQuery({ queryKey: ["driver-service"], queryFn: () => serviceRequest(), refetchInterval: 10_000, retry: false }); }
export function DriverServiceControl() {
  const query = useDriverService(), cache = useQueryClient(); const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  async function toggle() {
    if (!query.data || busy) return; setBusy(true); setError(null);
    try { const state = await serviceRequest(!query.data.active); cache.setQueryData(["driver-service"], state); await cache.invalidateQueries({ queryKey: ["order-tracking"] }); }
    catch (e) { setError((e as Error).message); await query.refetch(); } finally { setBusy(false); }
  }
  return <div className="m-4 rounded-lg border p-3 text-sm" aria-label="Service et partage de position"><p className="font-medium">{query.error ? "État du service indisponible" : !query.data ? "Chargement du service…" : query.data.active ? "Service ouvert" : "Service arrêté"}</p><p className="my-2 text-muted-foreground">La position est partagée uniquement pendant une mission démarrée. Terminer le service arrête ce partage pour toutes vos missions ; cela ne clôture pas les livraisons.</p><Button variant={query.data?.active ? "outline" : "default"} size="sm" disabled={!query.data || busy || Boolean(query.error)} onClick={toggle}>{busy ? "Enregistrement…" : query.data?.active ? "Terminer le service" : "Commencer le service"}</Button>{(error || query.error) && <p role="alert" className="mt-2 text-destructive">{error ?? query.error?.message}</p>}</div>;
}
