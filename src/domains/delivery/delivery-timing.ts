import type { DeliveryStatus } from "@prisma/client";
import { isLateDelivery } from "@/lib/dashboard/period-stats";

export type DeliveryNextAction =
  | "ASSIGN_DRIVER"
  | "AWAIT_DRIVER_ACCEPTANCE"
  | "AWAIT_MISSION_START"
  | "FOLLOW_LATE_DELIVERY"
  | "FOLLOW_DELIVERY"
  | "CHECK_MISSING_PROOF"
  | "HANDLE_FAILURE";

export const DELIVERY_NEXT_ACTION_LABELS: Record<DeliveryNextAction, string> = {
  ASSIGN_DRIVER: "Affecter un livreur",
  AWAIT_DRIVER_ACCEPTANCE: "Attendre l’acceptation du livreur",
  AWAIT_MISSION_START: "Attendre le départ du livreur",
  FOLLOW_LATE_DELIVERY: "Livraison en retard : contacter le livreur et prévenir le client",
  FOLLOW_DELIVERY: "Suivre la livraison en cours",
  CHECK_MISSING_PROOF: "Livrée sans photo : vérifier la preuve",
  HANDLE_FAILURE: "Échec : recontacter le client et replanifier si besoin",
};

export type DeliveryTiming = {
  /** Échéance : date souhaitée de la commande, même règle que le tableau de bord et l'analyse. */
  dueAt: string | null;
  late: boolean;
  lateByMinutes: number | null;
  nextAction: { code: DeliveryNextAction; label: string } | null;
};

/** Règle serveur unique de la fiche livraison (UX-03) : retard et prochaine action. */
export function deliveryTiming(input: {
  status: DeliveryStatus;
  requestedDeliveryDate: Date | null;
  completedAt: Date | null;
  driverId: string | null;
  missionAcceptedAt: Date | null;
  hasProof: boolean;
  now?: Date;
}): DeliveryTiming {
  const now = input.now ?? new Date();
  const late = isLateDelivery({ status: input.status, requestedDeliveryDate: input.requestedDeliveryDate, completedAt: input.completedAt, now });
  const reference = input.completedAt ?? now;
  const lateByMinutes = late && input.requestedDeliveryDate
    ? Math.max(1, Math.round((reference.getTime() - input.requestedDeliveryDate.getTime()) / 60_000))
    : null;

  return {
    dueAt: input.requestedDeliveryDate?.toISOString() ?? null,
    late,
    lateByMinutes,
    nextAction: nextAction(input, late),
  };
}

function nextAction(
  input: { status: DeliveryStatus; driverId: string | null; missionAcceptedAt: Date | null; hasProof: boolean },
  late: boolean
): DeliveryTiming["nextAction"] {
  const code = ((): DeliveryNextAction | null => {
    switch (input.status) {
      case "FAILED": return "HANDLE_FAILURE";
      case "DELIVERED": return input.hasProof ? null : "CHECK_MISSING_PROOF";
      case "PENDING": return "ASSIGN_DRIVER";
      case "ASSIGNED":
        if (!input.driverId) return "ASSIGN_DRIVER";
        return input.missionAcceptedAt ? "AWAIT_MISSION_START" : "AWAIT_DRIVER_ACCEPTANCE";
      case "PURCHASING":
      case "IN_DELIVERY":
        if (!input.driverId) return "ASSIGN_DRIVER";
        return late ? "FOLLOW_LATE_DELIVERY" : "FOLLOW_DELIVERY";
      // Annulée, ou états de facturation postérieurs à la livraison : rien à faire ici.
      default: return null;
    }
  })();
  return code ? { code, label: DELIVERY_NEXT_ACTION_LABELS[code] } : null;
}
