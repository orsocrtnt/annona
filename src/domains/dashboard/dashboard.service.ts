import { prisma } from "@/services/prisma/client";
import type { DeliveryCategory, DeliveryStatus } from "@prisma/client";
import {
  addDays,
  bumpCategory,
  DASHBOARD_PERIOD_DAYS,
  emptyCategoryCounts,
  emptyStatusBreakdown,
  getPlannedAt,
  getStatusBucket,
  isActiveDeliveryStatus,
  isDeliveredStatus,
  isInPeriod,
  isLateDelivery,
  startOfToday,
  type DashboardPeriodKey,
  type PeriodDashboardStats,
} from "@/lib/dashboard/period-stats";
import {
  formatClientFromParts,
  formatDriverDisplayName,
} from "@/lib/format/person-labels";
import type {
  CompanyDashboardStats,
  DashboardAlerts,
  DashboardDeliveryItem,
  DashboardLists,
  DashboardPeriodLists,
  DashboardTodayStats,
} from "@/lib/dashboard/dashboard-types";
import { DASHBOARD_DELIVERIES_TAKE } from "@/lib/query/list-limits";

type DeliveryRow = {
  id: string;
  reference: string;
  status: DeliveryStatus;
  deliveryCategory: DeliveryCategory;
  scheduledAt: Date | null;
  createdAt: Date;
  completedAt: Date | null;
  missionStartedAt: Date | null;
  driverName: string | null;
  address: string;
  city: string | null;
  order: {
    reference: string;
    requestedDeliveryDate: Date | null;
    customer: { firstName: string; lastName: string } | null;
  };
};

const deliverySelect = {
  id: true,
  reference: true,
  status: true,
  deliveryCategory: true,
  scheduledAt: true,
  createdAt: true,
  completedAt: true,
  missionStartedAt: true,
  driverName: true,
  address: true,
  city: true,
  order: {
    select: {
      reference: true,
      requestedDeliveryDate: true,
      customer: { select: { firstName: true, lastName: true } },
    },
  },
} as const;

function emptyPeriodLists(): DashboardPeriodLists {
  return {
    all: [],
    standard: [],
    courier: [],
    late: [],
    byStatus: {
      pending: [],
      assigned: [],
      purchasing: [],
      inDelivery: [],
      delivered: [],
    },
  };
}

function toDashboardItem(delivery: DeliveryRow): DashboardDeliveryItem {
  return {
    id: delivery.id,
    reference: delivery.reference,
    status: delivery.status,
    deliveryCategory: delivery.deliveryCategory,
    requestedDeliveryDate: delivery.order.requestedDeliveryDate?.toISOString() ?? null,
    scheduledAt: delivery.scheduledAt?.toISOString() ?? null,
    customerName: formatClientFromParts(
      delivery.order.customer,
      null
    ),
    orderReference: delivery.order.reference,
    driverName: delivery.driverName
      ? formatDriverDisplayName(delivery.driverName)
      : null,
    address: delivery.address,
    city: delivery.city,
  };
}

function aggregatePeriod(
  deliveries: DeliveryRow[],
  periodStart: Date,
  periodEnd: Date,
  now: Date
): { stats: PeriodDashboardStats; lists: DashboardPeriodLists } {
  const total = emptyCategoryCounts();
  const byStatus = emptyStatusBreakdown();
  const late = emptyCategoryCounts();
  const lists = emptyPeriodLists();

  for (const delivery of deliveries) {
    const plannedAt = getPlannedAt(delivery.scheduledAt, delivery.createdAt);
    if (!isInPeriod(plannedAt, periodStart, periodEnd)) continue;

    const item = toDashboardItem(delivery);
    const { deliveryCategory: category } = delivery;

    lists.all.push(item);
    if (category === "COURIER") lists.courier.push(item);
    else lists.standard.push(item);

    bumpCategory(total, category);

    const bucket = getStatusBucket(delivery.status);
    if (bucket) {
      bumpCategory(byStatus[bucket], category);
      lists.byStatus[bucket].push(item);
    }

    if (
      isLateDelivery({
        status: delivery.status,
        requestedDeliveryDate: delivery.order.requestedDeliveryDate,
        completedAt: delivery.completedAt,
        now,
      })
    ) {
      bumpCategory(late, category);
      lists.late.push(item);
    }
  }

  return { stats: { total, byStatus, late }, lists };
}

function aggregateToday(
  deliveries: DeliveryRow[],
  todayStart: Date,
  tomorrowStart: Date,
  now: Date
): {
  stats: DashboardTodayStats;
  lists: DashboardLists["today"];
} {
  const delivered = emptyCategoryCounts();
  const inProgress = emptyCategoryCounts();
  const remaining = emptyCategoryCounts();
  let late = 0;
  const lists: DashboardLists["today"] = {
    delivered: [],
    inProgress: [],
    remaining: [],
    late: [],
  };

  for (const delivery of deliveries) {
    const plannedAt = getPlannedAt(delivery.scheduledAt, delivery.createdAt);
    const isToday = isInPeriod(plannedAt, todayStart, tomorrowStart);
    if (!isToday) continue;

    const item = toDashboardItem(delivery);
    const { deliveryCategory: category, status } = delivery;

    if (isDeliveredStatus(status) && delivery.completedAt) {
      const completedToday =
        delivery.completedAt >= todayStart && delivery.completedAt < tomorrowStart;
      if (completedToday) {
        bumpCategory(delivered, category);
        lists.delivered.push(item);
      }
      continue;
    }

    if (status === "PURCHASING" || status === "IN_DELIVERY") {
      bumpCategory(inProgress, category);
      lists.inProgress.push(item);
    } else if (isActiveDeliveryStatus(status)) {
      bumpCategory(remaining, category);
      lists.remaining.push(item);
    }

    if (
      isLateDelivery({
        status,
        requestedDeliveryDate: delivery.order.requestedDeliveryDate,
        completedAt: delivery.completedAt,
        now,
      })
    ) {
      late += 1;
      lists.late.push(item);
    }
  }

  return {
    stats: { delivered, inProgress, remaining, late },
    lists,
  };
}

function buildAlertLists(
  deliveries: DeliveryRow[],
  now: Date
): { alerts: DashboardAlerts; lists: DashboardLists["alerts"] } {
  const lists: DashboardLists["alerts"] = {
    late: [],
    unassigned: [],
    assignedNotStarted: [],
    inProgress: [],
  };

  for (const delivery of deliveries) {
    const item = toDashboardItem(delivery);
    const { status } = delivery;

    if (
      isLateDelivery({
        status,
        requestedDeliveryDate: delivery.order.requestedDeliveryDate,
        completedAt: delivery.completedAt,
        now,
      }) &&
      isActiveDeliveryStatus(status)
    ) {
      lists.late.push(item);
    }

    if (status === "PENDING") lists.unassigned.push(item);
    if (status === "ASSIGNED" && !delivery.missionStartedAt) {
      lists.assignedNotStarted.push(item);
    }
    if (status === "PURCHASING" || status === "IN_DELIVERY") {
      lists.inProgress.push(item);
    }
  }

  return {
    alerts: {
      late: lists.late.length,
      unassigned: lists.unassigned.length,
      assignedNotStarted: lists.assignedNotStarted.length,
      inProgress: lists.inProgress.length,
    },
    lists,
  };
}

export async function getCompanyDashboardStats(
  companyId: string
): Promise<CompanyDashboardStats> {
  const now = new Date();
  const todayStart = startOfToday();
  const tomorrowStart = addDays(todayStart, 1);
  const maxPeriodEnd = addDays(todayStart, DASHBOARD_PERIOD_DAYS["30d"]);

  const [planningDeliveries, activeDeliveries, allForToday] = await Promise.all([
    prisma.delivery.findMany({
      where: {
        companyId,
        status: { not: "CANCELLED" },
        OR: [
          { scheduledAt: { gte: todayStart, lt: maxPeriodEnd } },
          {
            scheduledAt: null,
            createdAt: { gte: todayStart, lt: maxPeriodEnd },
          },
        ],
      },
      select: deliverySelect,
      take: DASHBOARD_DELIVERIES_TAKE,
    }),
    prisma.delivery.findMany({
      where: {
        companyId,
        status: { in: ["PENDING", "ASSIGNED", "PURCHASING", "IN_DELIVERY"] },
      },
      select: deliverySelect,
      orderBy: { createdAt: "asc" },
      take: DASHBOARD_DELIVERIES_TAKE,
    }),
    prisma.delivery.findMany({
      where: {
        companyId,
        status: { not: "CANCELLED" },
        OR: [
          { scheduledAt: { gte: todayStart, lt: tomorrowStart } },
          {
            scheduledAt: null,
            createdAt: { gte: todayStart, lt: tomorrowStart },
          },
          {
            completedAt: { gte: todayStart, lt: tomorrowStart },
          },
        ],
      },
      select: deliverySelect,
      take: DASHBOARD_DELIVERIES_TAKE,
    }),
  ]);

  const periods = {} as Record<DashboardPeriodKey, PeriodDashboardStats>;
  const periodLists = {} as Record<DashboardPeriodKey, DashboardPeriodLists>;

  for (const key of ["3d", "7d", "30d"] as DashboardPeriodKey[]) {
    const days = DASHBOARD_PERIOD_DAYS[key];
    const { stats, lists } = aggregatePeriod(
      planningDeliveries,
      todayStart,
      addDays(todayStart, days),
      now
    );
    periods[key] = stats;
    periodLists[key] = lists;
  }

  const { stats: todayStats, lists: todayLists } = aggregateToday(
    allForToday,
    todayStart,
    tomorrowStart,
    now
  );

  const { alerts, lists: alertLists } = buildAlertLists(activeDeliveries, now);

  return {
    periods,
    lists: {
      alerts: alertLists,
      today: todayLists,
      periods: periodLists,
    },
    alerts,
    today: todayStats,
  };
}
