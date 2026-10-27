import type { DeliveryStatus } from "@prisma/client";
import { isActiveDeliveryStatus, isDeliveredStatus } from "@/lib/dashboard/period-stats";
import type { DashboardTrends } from "@/lib/dashboard/dashboard-types";

/**
 * Tendances du dashboard, reconstituées uniquement à partir des horodatages fiables
 * (création, date demandée, fin de mission). Les statuts intermédiaires n'ont pas
 * d'heure de passage : « sans livreur », « assignées » et « en route » n'ont donc pas de tendance.
 */
export type TrendDelivery = {
  status: DeliveryStatus;
  createdAt: Date;
  completedAt: Date | null;
  requestedDeliveryDate: Date | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Mission en retard à l'instant `at` : existante, échéance dépassée, pas encore terminée. */
export function wasLateAt(delivery: TrendDelivery, at: Date): boolean {
  const { requestedDeliveryDate, createdAt, completedAt, status } = delivery;
  if (!requestedDeliveryDate) return false;
  if (createdAt.getTime() > at.getTime()) return false;
  if (requestedDeliveryDate.getTime() >= at.getTime()) return false;
  if (completedAt) return completedAt.getTime() > at.getTime();
  // Sans heure de fin, seule une mission encore active était forcément ouverte à `at`.
  return isActiveDeliveryStatus(status);
}

export function countDeliveredBetween(deliveries: TrendDelivery[], from: Date, to: Date): number {
  return deliveries.filter(
    (d) =>
      isDeliveredStatus(d.status) &&
      d.completedAt !== null &&
      d.completedAt.getTime() >= from.getTime() &&
      d.completedAt.getTime() < to.getTime()
  ).length;
}

/** Livraisons terminées par heure (0 à 23, heure locale du serveur) depuis `dayStart`. */
export function deliveredByHour(deliveries: TrendDelivery[], dayStart: Date, now: Date): number[] {
  const hours = Array.from({ length: 24 }, () => 0);
  for (const d of deliveries) {
    if (!isDeliveredStatus(d.status) || !d.completedAt) continue;
    const t = d.completedAt.getTime();
    if (t < dayStart.getTime() || t >= now.getTime()) continue;
    const hour = d.completedAt.getHours();
    hours[hour] = (hours[hour] ?? 0) + 1;
  }
  return hours;
}

export function buildDashboardTrends(
  deliveries: TrendDelivery[],
  todayStart: Date,
  now: Date
): DashboardTrends {
  const yesterdaySameTime = new Date(now.getTime() - DAY_MS);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  return {
    lateNow: deliveries.filter((d) => wasLateAt(d, now)).length,
    lateYesterdaySameTime: deliveries.filter((d) => wasLateAt(d, yesterdaySameTime)).length,
    deliveredToday: countDeliveredBetween(deliveries, todayStart, now),
    deliveredYesterdaySameTime: countDeliveredBetween(deliveries, yesterdayStart, yesterdaySameTime),
    deliveredByHour: deliveredByHour(deliveries, todayStart, now),
  };
}
