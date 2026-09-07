import { prisma } from "@/services/prisma/client";
import { formatClientFromParts } from "@/lib/format/person-labels";
import { isLateDelivery, isDeliveredStatus } from "@/lib/dashboard/period-stats";

export type AnalyticsPeriodDays = 7 | 30;

export interface CompanyAnalytics {
  periodDays: AnalyticsPeriodDays;
  deliveriesCreated: number;
  delivered: number;
  onTimeRate: number | null;
  lateNow: number;
  unassigned: number;
  invoicedAmount: number;
  collectedAmount: number;
  pendingInvoiceAmount: number;
  dailyVolume: { date: string; count: number }[];
  topClients: { name: string; deliveries: number }[];
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function money(value: unknown) {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function getCompanyAnalytics(
  companyId: string,
  periodDays: AnalyticsPeriodDays = 30
): Promise<CompanyAnalytics> {
  const periodEnd = addDays(startOfDay(new Date()), 1);
  const periodStart = addDays(periodEnd, -periodDays);

  const [periodDeliveries, snapshot, invoices] = await Promise.all([
    prisma.delivery.findMany({
      where: { companyId, createdAt: { gte: periodStart, lt: periodEnd } },
      select: {
        status: true,
        completedAt: true,
        createdAt: true,
        customerId: true,
        order: {
          select: {
            requestedDeliveryDate: true,
            customer: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.delivery.findMany({
      where: {
        companyId,
        status: { in: ["PENDING", "ASSIGNED", "PURCHASING", "IN_DELIVERY"] },
      },
      select: {
        status: true,
        completedAt: true,
        driverId: true,
        order: { select: { requestedDeliveryDate: true } },
      },
    }),
    prisma.invoice.findMany({
      where: { companyId, createdAt: { gte: periodStart, lt: periodEnd } },
      select: { status: true, amount: true },
    }),
  ]);

  const deliveredRows = periodDeliveries.filter((row) => isDeliveredStatus(row.status));
  const onTimeChecks = deliveredRows.filter((row) => row.order.requestedDeliveryDate && row.completedAt);
  const onTime = onTimeChecks.filter(
    (row) =>
      !isLateDelivery({
        status: row.status,
        requestedDeliveryDate: row.order.requestedDeliveryDate,
        completedAt: row.completedAt,
      })
  ).length;

  const clientCounts = new Map<string, { name: string; deliveries: number }>();
  for (const row of periodDeliveries) {
    const name = formatClientFromParts(row.order.customer);
    const current = clientCounts.get(name) ?? { name, deliveries: 0 };
    current.deliveries += 1;
    clientCounts.set(name, current);
  }

  const dailyVolume: { date: string; count: number }[] = [];
  for (let i = periodDays - 1; i >= 0; i -= 1) {
    const day = addDays(startOfDay(new Date()), -i);
    const next = addDays(day, 1);
    dailyVolume.push({
      date: day.toISOString().slice(0, 10),
      count: periodDeliveries.filter((row) => row.createdAt >= day && row.createdAt < next).length,
    });
  }

  return {
    periodDays,
    deliveriesCreated: periodDeliveries.length,
    delivered: deliveredRows.length,
    onTimeRate: onTimeChecks.length > 0 ? onTime / onTimeChecks.length : null,
    lateNow: snapshot.filter((row) =>
      isLateDelivery({
        status: row.status,
        requestedDeliveryDate: row.order.requestedDeliveryDate,
        completedAt: row.completedAt,
      })
    ).length,
    unassigned: snapshot.filter((row) => row.status === "PENDING" && !row.driverId).length,
    invoicedAmount: invoices.reduce((sum, row) => sum + money(row.amount), 0),
    collectedAmount: invoices
      .filter((row) => row.status === "PAID")
      .reduce((sum, row) => sum + money(row.amount), 0),
    pendingInvoiceAmount: invoices
      .filter((row) => row.status === "PENDING" || row.status === "DRAFT")
      .reduce((sum, row) => sum + money(row.amount), 0),
    dailyVolume,
    topClients: [...clientCounts.values()]
      .sort((a, b) => b.deliveries - a.deliveries)
      .slice(0, 5),
  };
}
