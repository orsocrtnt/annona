import type { DeliveryStatus } from "@prisma/client";

/** Statuts considérés comme « mission active » pour la fréquence GPS rapide */
export const ACTIVE_MISSION_STATUSES: DeliveryStatus[] = [
  "ASSIGNED",
  "PURCHASING",
  "IN_DELIVERY",
];

export function hasActiveDriverMission(
  missions:
    | { status: DeliveryStatus; missionStartedAt?: string | null | Date }[]
    | undefined
): boolean {
  if (!missions?.length) return false;
  return missions.some((m) => {
    if (m.status === "PURCHASING" || m.status === "IN_DELIVERY") return true;
    if (m.status === "ASSIGNED" && m.missionStartedAt) return true;
    return false;
  });
}
