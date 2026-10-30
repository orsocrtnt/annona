import type { ProximityTargetKind } from "@/lib/maps/driver-proximity";

/**
 * MOB-01C, décision du propriétaire du 29 octobre 2026 : une étape confirmée par le livreur hors de la zone
 * attendue est signalée avec la distance, à l'administrateur et au dispatch seulement (note interne de type
 * incident, jamais visible du client).
 */
export function outOfRangeIncidentBody(input: {
  kind: ProximityTargetKind;
  status: "PURCHASING" | "IN_DELIVERY" | "DELIVERED" | "FAILED";
  hasLocation: boolean;
  distanceMeters: number | null;
  thresholdMeters: number;
}): string {
  const step =
    input.status === "DELIVERED" ? "Livraison validée" : input.status === "FAILED" ? "Échec de livraison déclaré" : "Retrait confirmé";
  const place = input.kind === "delivery" ? "du point de livraison" : "du point de retrait";
  if (!input.hasLocation || input.distanceMeters == null) {
    return `${step} hors zone par le livreur : position inconnue au moment de la confirmation (zone attendue : ${input.thresholdMeters} m ${place}).`;
  }
  return `${step} hors zone par le livreur : à ${Math.round(input.distanceMeters)} m ${place} (zone attendue : ${input.thresholdMeters} m).`;
}
