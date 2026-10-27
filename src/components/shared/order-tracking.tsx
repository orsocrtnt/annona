"use client";
import { useEffect, useState } from "react";
import { syncTrackingDetail } from "@/lib/tracking/cache";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ESTIMATION_MAX_SECONDS, TRACKING_POLL_MS, type TrackingPosition } from "@/domains/tracking/tracking.policy";
import { dateTimeLabel, elapsedLabel } from "@/lib/format/relative-day";
import { withoutRolePrefix } from "@/lib/format/person-labels";
import type { getOrderTracking } from "@/domains/tracking/tracking.service";
type Tracking = Awaited<ReturnType<typeof getOrderTracking>>;
const positionLabels: Record<Exclude<TrackingPosition["state"], "STALE">, string> = { NOT_STARTED: "Position non partagée : mission non démarrée.", ENDED: "Suivi arrêté : mission terminée.", OFF_DUTY: "Position non partagée : service arrêté.", ABSENT: "Position absente : aucun signal reçu pour cette mission et ce service.", FRESH: "Dernière position reçue" };
/** Signal périmé : estimation vers la prochaine étape pendant 3 min, puis arrêt au point atteint. */
function positionLabel(position: TrackingPosition, state: TrackingPosition["state"], serverNow: number) {
  if (state !== "STALE") return positionLabels[state];
  const lost = position.updatedAt != null && serverNow - Date.parse(position.updatedAt) > ESTIMATION_MAX_SECONDS * 1000;
  if (lost) return position.motion ? "Signal perdu : livreur arrêté à sa dernière position estimée." : "Signal perdu : dernière position connue.";
  if (position.estimated) return "Position estimée : signal interrompu, trajet supposé en ligne droite vers la prochaine étape.";
  return "Signal interrompu : dernière position connue.";
}
const date = dateTimeLabel;
export function OrderTracking({ orderId }: { orderId: string }) {
  const cache = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const query = useQuery({ queryKey: ["order-tracking", orderId], queryFn: async () => {
    const response = await fetch(`/api/tracking/${orderId}`, { cache: "no-store" });
    const json = await response.json(); if (!response.ok) throw new Error(json.error ?? "Suivi indisponible."); return json.data as Tracking;
  }, refetchInterval: TRACKING_POLL_MS, retry: false });
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const data = query.data; if (!data || query.error) return;
    cache.setQueryData(["company", "orders", orderId], (current: unknown) => syncTrackingDetail(current, data, "order"));
    cache.setQueryData(["portal", "orders", orderId], (current: unknown) => syncTrackingDetail(current, data, "order"));
    for (const d of data.deliveries) cache.setQueryData(["portal", "deliveries", d.id], (current: unknown) => syncTrackingDetail(current, data, "delivery"));
  }, [cache, orderId, query.data, query.error]);
  if (query.error) return <div role="alert" className="space-y-3 rounded border p-4"><p>{query.error.message} Les positions sont masquées.</p><Button variant="outline" size="sm" onClick={() => query.refetch()}>Actualiser le suivi</Button></div>;
  const data = query.data;
  if (!data) return <p role="status" aria-live="polite" className="p-4">Chargement du suivi…</p>;
  // Advance server time by elapsed local time; clock skew cannot prolong freshness.
  const serverNow = Date.parse(data.serverTime) + Math.max(0, now - query.dataUpdatedAt);
  return <Card id="tracking" aria-label="Suivi partagé" aria-busy={query.isFetching}><CardHeader><CardTitle className="text-base">Suivi partagé</CardTitle><p className="text-sm text-muted-foreground"><span className="tabular-nums">{data.reference}</span> · {data.statusLabel} · vérifié le <time dateTime={data.serverTime}>{date(data.serverTime)}</time>. Actualisé toutes les 10 secondes lorsque cette page est visible.</p></CardHeader>
    <CardContent className="space-y-5">{data.deliveries.map(delivery => {
      const position = delivery.position;
      const state = position.state === "FRESH" && position.expiresAt && serverNow >= Date.parse(position.expiresAt) ? "STALE" : position.state;
      return <section key={delivery.id} className="min-w-0 space-y-3 rounded-lg border p-3 sm:p-4" aria-label={`Mission ${delivery.reference}`}>
        <div><h3 className="font-semibold">{delivery.statusLabel}</h3><p className="text-sm">Livreur : {withoutRolePrefix(delivery.driverName) || "pas encore affecté"}</p><p className="text-xs text-muted-foreground">État mis à jour le <time dateTime={delivery.updatedAt}>{date(delivery.updatedAt)}</time> · <span className="tabular-nums">{delivery.reference}</span></p></div>
        <p className="text-sm">{delivery.missionAcceptedAt ? `Prise en charge confirmée le ${date(delivery.missionAcceptedAt)}.` : "Prise en charge non confirmée."} {delivery.missionStartedAt ? `Départ le ${date(delivery.missionStartedAt)}.` : "Mission non démarrée."}</p>
        <div className="rounded bg-muted/40 p-3 text-sm" role="status"><strong>{positionLabel(position, state, serverNow)}</strong>{position.updatedAt && <p>Signal reçu <time dateTime={position.updatedAt} title={date(position.updatedAt)}>{elapsedLabel(position.updatedAt, serverNow)}</time>{state === "FRESH" && <span title={`Latitude ${position.latitude?.toFixed(5)}, longitude ${position.longitude?.toFixed(5)}`}>{position.accuracy != null ? ` · précision ±${Math.round(position.accuracy)} m` : " · précision inconnue"}</span>}.</p>}<p className="mt-1 text-xs text-muted-foreground">Partage limité au service ouvert et à la mission démarrée. Ce signal daté ne garantit pas un suivi permanent.</p></div>
        <div><h4 className="text-sm font-medium">Chronologie des actions</h4>{!delivery.timeline.length && <p className="text-sm text-muted-foreground">Aucune action enregistrée.</p>}<ol className="mt-2 space-y-2">{delivery.timeline.map(event => <li key={event.id} className="border-l-2 pl-3 text-sm"><strong>{event.label}</strong> — <time dateTime={event.occurredAt}>{date(event.occurredAt)}</time>{event.description && <p className="whitespace-pre-wrap text-muted-foreground">{event.description}</p>}</li>)}</ol></div>
      </section>;
    })}</CardContent></Card>;
}
export function OrderTrackingTrigger({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" size="sm">Suivi de la commande</Button></DialogTrigger><DialogContent className="max-h-[90dvh] w-[calc(100%_-_1.5rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6"><DialogHeader><DialogTitle>Suivi de la commande</DialogTitle></DialogHeader>{open && <OrderTracking orderId={orderId} />}</DialogContent></Dialog>;
}
