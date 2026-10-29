import type { DispatchMapDelivery } from "@/domains/delivery/dispatch-map.service";
import { isLateDispatchDelivery } from "@/features/back-office/dispatch-focus";

/** Les quatre états de pilotage du dashboard, appliqués à la carte des livraisons. */
export type DispatchMapStatusKey = "late" | "unassigned" | "pending" | "route";

export const DISPATCH_MAP_STATUSES: {
  key: DispatchMapStatusKey;
  label: string;
  pill: string;
  dot: string;
}[] = [
  { key: "late", label: "En retard", pill: "bg-[#fde3e0] text-[#b8352b] dark:bg-error-subtle dark:text-error dark:ring-1 dark:ring-current", dot: "#e5533f" },
  { key: "unassigned", label: "Sans livreur", pill: "bg-[#fde9d6] text-[#a8560d] dark:bg-warning-subtle dark:text-warning dark:ring-1 dark:ring-current", dot: "#ffffff" },
  { key: "pending", label: "À démarrer", pill: "bg-[#e1ebfb] text-[#2a62bd] dark:bg-secondary dark:text-secondary-foreground dark:ring-1 dark:ring-current", dot: "#ffffff" },
  { key: "route", label: "En route", pill: "bg-[#dff5e8] text-[#08783f] dark:bg-success-subtle dark:text-success dark:ring-1 dark:ring-current", dot: "#00d46a" },
];

export function getDispatchMapStatus(
  delivery: Pick<
    DispatchMapDelivery,
    "id" | "status" | "driverId" | "missionStartedAt" | "requestedDeliveryDate" | "completedAt"
  >,
  now = new Date()
): DispatchMapStatusKey {
  if (
    isLateDispatchDelivery(
      { ...delivery, order: { requestedDeliveryDate: delivery.requestedDeliveryDate } },
      now
    )
  ) {
    return "late";
  }
  if (delivery.status === "PENDING" || !delivery.driverId) return "unassigned";
  if (delivery.status === "ASSIGNED" && !delivery.missionStartedAt) return "pending";
  return "route";
}

export function getDispatchMapStatusMeta(key: DispatchMapStatusKey) {
  return DISPATCH_MAP_STATUSES.find((status) => status.key === key)!;
}

export function countDispatchMapStatuses(
  deliveries: DispatchMapDelivery[],
  now = new Date()
): Record<DispatchMapStatusKey, number> {
  const counts: Record<DispatchMapStatusKey, number> = { late: 0, unassigned: 0, pending: 0, route: 0 };
  for (const delivery of deliveries) counts[getDispatchMapStatus(delivery, now)] += 1;
  return counts;
}
