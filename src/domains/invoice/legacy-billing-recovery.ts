import type { DeliveryStatus } from "@prisma/client";

/** Diagnostic uniquement : aucune correction automatique ni date tirée de la facture. */
export function proposeLegacyDeliveryRecovery(delivery: {
  status: DeliveryStatus;
  completedAt: Date | null;
  podOutcome: string | null;
  trackingEvents: { label: string; occurredAt: Date }[];
}) {
  const legacy = delivery.status === "INVOICED" || delivery.status === "PAID";
  if (!legacy) return { legacy: false, candidateStatus: null, completedAt: delivery.completedAt, reviewRequired: false };
  const statuses: Record<string, DeliveryStatus> = {
    "En attente": "PENDING", "Assigné": "ASSIGNED", "Assignée au chauffeur": "ASSIGNED",
    "En cours d'achat": "PURCHASING", "Collecté": "PURCHASING", "En livraison": "IN_DELIVERY",
    "Livré": "DELIVERED", "Échec de livraison": "FAILED", "Annulé": "CANCELLED",
  };
  const events = [...delivery.trackingEvents].sort((a, b) => +a.occurredAt - +b.occurredAt);
  const last = events.filter((event) => statuses[event.label]).at(-1);
  let candidateStatus = last ? statuses[last.label] : null;
  // Une clôture exige une date métier existante et ne doit pas contredire la preuve.
  if (candidateStatus === "DELIVERED" && (!delivery.completedAt || delivery.podOutcome === "FAILED")) candidateStatus = null;
  if (candidateStatus === "FAILED" && (!delivery.completedAt || delivery.podOutcome === "SUCCESS")) candidateStatus = null;
  if (candidateStatus && ["PENDING", "ASSIGNED", "PURCHASING", "IN_DELIVERY"].includes(candidateStatus) && delivery.completedAt) candidateStatus = null;
  return {
    legacy: true,
    candidateStatus,
    completedAt: delivery.completedAt,
    evidenceAt: last?.occurredAt ?? null,
    reviewRequired: true,
  };
}
