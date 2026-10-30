import type { DeliveryStatus } from "@prisma/client";
import { addDays, isDeliveredStatus, isLateDelivery } from "@/lib/dashboard/period-stats";

export const HISTORY_DAYS = 7;

export interface DashboardHistoryDay {
  /** Début du jour (fuseau du serveur, comme `startOfToday`), en ISO. */
  date: string;
  /** Livrées ce jour-là (heure de fin de mission). */
  delivered: number;
  /** Parmi elles, livrées après la date demandée par le client. */
  deliveredLate: number;
  /** Missions terminées en échec ce jour-là. */
  failed: number;
}

export interface HistoryDeliveryRow {
  status: DeliveryStatus;
  completedAt: Date | null;
  requestedDeliveryDate: Date | null;
}

/** Sept jours glissants, aujourd'hui compris, du plus ancien au plus récent ; les jours vides valent zéro. */
export function buildSevenDayHistory(rows: HistoryDeliveryRow[], todayStart: Date): DashboardHistoryDay[] {
  const days = Array.from({ length: HISTORY_DAYS }, (_, index) => {
    const start = addDays(todayStart, index - (HISTORY_DAYS - 1));
    return { start, end: addDays(start, 1), entry: { date: start.toISOString(), delivered: 0, deliveredLate: 0, failed: 0 } };
  });
  for (const row of rows) {
    if (!row.completedAt) continue;
    const day = days.find(({ start, end }) => row.completedAt! >= start && row.completedAt! < end);
    if (!day) continue;
    if (isDeliveredStatus(row.status)) {
      day.entry.delivered += 1;
      if (isLateDelivery(row)) day.entry.deliveredLate += 1;
    } else if (row.status === "FAILED") {
      day.entry.failed += 1;
    }
  }
  return days.map(({ entry }) => entry);
}

export function historyStart(todayStart: Date) {
  return addDays(todayStart, -(HISTORY_DAYS - 1));
}
