"use client";

import { Clock } from "lucide-react";
import { usePortalDeliveriesMap } from "@/features/client-portal/hooks";
import { etaDayLabel, formatEta } from "@/features/client-portal/utils";
import { liveEtaLabel } from "@/lib/format/live-eta";

const IN_PROGRESS = new Set(["IN_DELIVERY", "PURCHASING"]);

function ArrivalRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 border-t border-border pt-4" data-delivery-arrival="true">
      <Clock className="h-4 w-4 text-muted-foreground" />
      <span>{label}</span>
    </div>
  );
}

function plannedLabel(estimatedArrival: string) {
  return `Arrivée estimée ${etaDayLabel(estimatedArrival)} à ${formatEta(estimatedArrival)}`;
}

/** Lit la carte client : sans l'option « carte GPS client », elle répond 403 et l'heure planifiée reste. */
function LiveArrival({ deliveryId, estimatedArrival }: { deliveryId: string; estimatedArrival: string | null }) {
  const { data } = usePortalDeliveriesMap();
  const liveEta = data?.active.find((delivery) => delivery.id === deliveryId)?.liveEta;
  if (liveEta) return <ArrivalRow label={liveEtaLabel(liveEta)} />;
  return estimatedArrival ? <ArrivalRow label={plannedLabel(estimatedArrival)} /> : null;
}

export function ClientDeliveryArrival({ deliveryId, status, estimatedArrival }: { deliveryId: string; status: string; estimatedArrival: string | null }) {
  if (IN_PROGRESS.has(status)) return <LiveArrival deliveryId={deliveryId} estimatedArrival={estimatedArrival} />;
  return estimatedArrival ? <ArrivalRow label={plannedLabel(estimatedArrival)} /> : null;
}
