import type { DeliveryCategory, DeliveryStatus } from "@prisma/client";

export type DashboardPeriodKey = "3d" | "7d" | "30d";

export const DASHBOARD_PERIOD_DAYS: Record<DashboardPeriodKey, number> = {
  "3d": 3,
  "7d": 7,
  "30d": 30,
};

export const DASHBOARD_PERIOD_LABELS: Record<DashboardPeriodKey, string> = {
  "3d": "3 jours",
  "7d": "7 jours",
  "30d": "30 jours",
};

export type CategoryCounts = {
  standard: number;
  courier: number;
  total: number;
};

export type StatusBreakdown = {
  pending: CategoryCounts;
  assigned: CategoryCounts;
  purchasing: CategoryCounts;
  inDelivery: CategoryCounts;
  delivered: CategoryCounts;
};

export type PeriodDashboardStats = {
  total: CategoryCounts;
  byStatus: StatusBreakdown;
  late: CategoryCounts;
};

export function emptyCategoryCounts(): CategoryCounts {
  return { standard: 0, courier: 0, total: 0 };
}

export function emptyStatusBreakdown(): StatusBreakdown {
  return {
    pending: emptyCategoryCounts(),
    assigned: emptyCategoryCounts(),
    purchasing: emptyCategoryCounts(),
    inDelivery: emptyCategoryCounts(),
    delivered: emptyCategoryCounts(),
  };
}

export function bumpCategory(counts: CategoryCounts, category: DeliveryCategory) {
  if (category === "COURIER") counts.courier += 1;
  else counts.standard += 1;
  counts.total += 1;
}

const ACTIVE_STATUSES: DeliveryStatus[] = [
  "PENDING",
  "ASSIGNED",
  "PURCHASING",
  "IN_DELIVERY",
];

// Les anciens états de facturation ne prouvent pas une livraison terminée.
const DELIVERED_STATUSES: DeliveryStatus[] = ["DELIVERED"];

export function isActiveDeliveryStatus(status: DeliveryStatus) {
  return ACTIVE_STATUSES.includes(status);
}

export function isDeliveredStatus(status: DeliveryStatus) {
  return DELIVERED_STATUSES.includes(status);
}

export function isLateDelivery(input: {
  status: DeliveryStatus;
  requestedDeliveryDate: Date | null;
  completedAt: Date | null;
  now?: Date;
}) {
  const { status, requestedDeliveryDate, completedAt } = input;
  const now = input.now ?? new Date();
  if (!requestedDeliveryDate) return false;

  if (isDeliveredStatus(status) || status === "CANCELLED" || status === "FAILED") {
    if (!completedAt) return false;
    return completedAt.getTime() > requestedDeliveryDate.getTime();
  }

  if (!isActiveDeliveryStatus(status)) return false;
  return now.getTime() > requestedDeliveryDate.getTime();
}

export function getStatusBucket(status: DeliveryStatus): keyof StatusBreakdown | null {
  if (status === "PENDING") return "pending";
  if (status === "ASSIGNED") return "assigned";
  if (status === "PURCHASING") return "purchasing";
  if (status === "IN_DELIVERY") return "inDelivery";
  if (isDeliveredStatus(status)) return "delivered";
  return null;
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function getPlannedAt(scheduledAt: Date | null, createdAt: Date) {
  return scheduledAt ?? createdAt;
}

export function isInPeriod(
  plannedAt: Date,
  periodStart: Date,
  periodEnd: Date
) {
  return plannedAt >= periodStart && plannedAt < periodEnd;
}
