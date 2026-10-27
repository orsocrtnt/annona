import { prisma } from "@/services/prisma/client";
import { orderUsageAlertPercent } from "@/domains/saas/saas.service";

const STATUSES = [
  "PENDING_PAYMENT",
  "ACTIVE",
  "PAST_DUE",
  "RESTRICTED",
  "READ_ONLY",
  "CANCEL_AT_PERIOD_END",
  "CANCELLED",
  "EXPIRED",
] as const;

const PLANS = ["STARTER", "PRO", "BUSINESS"] as const;
const PAGE_SIZES = [25, 50, 100] as const;
const PARAMS = ["q", "status", "plan", "page", "pageSize"] as const;

type Status = (typeof STATUSES)[number];
type Plan = (typeof PLANS)[number];
type PageSize = (typeof PAGE_SIZES)[number];
type ItemKind = "OPTION" | "DRIVER_SEAT" | "ADMIN_SEAT" | "DISPATCHER_SEAT";

export type SubscriptionListParams = {
  q?: string;
  status?: Status;
  plan?: Plan;
  page: number;
  pageSize: PageSize;
  now?: Date;
};

export type SubscriptionFollowUp = "CURRENT" | "REMIND" | "ENDING" | "STOPPED";

export type CommercialSubscriptionRow = {
  id: string;
  companyId: string;
  company: string;
  email: string | null;
  phone: string | null;
  plan: Plan | null;
  status: Status;
  followUp: SubscriptionFollowUp;
  interval: "MONTHLY" | "ANNUAL" | null;
  periodStart: string;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  endedAt: string | null;
  amountCents: number;
  orders: { consumed: number; included: number; overage: number };
  usageAlertPercent: 80 | 100 | 120 | null;
  quantities: {
    options: Array<{ code: string; quantity: number }>;
    seats: { DRIVER_SEAT: number; ADMIN_SEAT: number; DISPATCHER_SEAT: number };
  };
};

export type CommercialSubscriptionPage = {
  page: number;
  pageSize: PageSize;
  total: number;
  summary: { current: number; remind: number; ending: number; stopped: number };
  rows: CommercialSubscriptionRow[];
};

type RawItem = { code: string; kind: ItemKind; quantity: number; unitPriceCents: number };
type RawPlan = { code: Plan; name: string; monthlyPriceCents: number; annualPriceCents: number };
type RawRow = {
  id: string;
  status: Status;
  billingInterval: "MONTHLY" | "ANNUAL" | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  endedAt: Date | null;
  company: { id: string; name: string; email: string | null; phone: string | null };
  planAssignments: Array<{ plan: RawPlan }>;
  items: RawItem[];
  usagePeriods: Array<{ includedOrders: number; orderCount: number; overageCount: number }>;
};

type SubscriptionReader = {
  saasSubscription: {
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
    findMany: (args: Record<string, unknown>) => Promise<RawRow[]>;
  };
};

function activeAt(now: Date) {
  return {
    effectiveFrom: { lte: now },
    OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
  };
}

function integerParam(value: string) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function parseSubscriptionListParams(
  search: URLSearchParams
): { query: SubscriptionListParams } | { error: string } {
  for (const key of search.keys()) {
    if (!PARAMS.includes(key as (typeof PARAMS)[number])) {
      return { error: "Paramètre inconnu" };
    }
  }

  const pageRaw = search.get("page");
  const page = pageRaw === null ? 1 : integerParam(pageRaw);
  if (page === null) return { error: "Page invalide" };

  const sizeRaw = search.get("pageSize");
  const pageSize = sizeRaw === null ? 25 : integerParam(sizeRaw);
  if (pageSize === null || !PAGE_SIZES.includes(pageSize as PageSize)) {
    return { error: "Taille de page invalide" };
  }

  const skip = (page - 1) * pageSize;
  if (!Number.isSafeInteger(skip)) return { error: "Page invalide" };

  const statusRaw = search.get("status");
  if (statusRaw !== null && !STATUSES.includes(statusRaw as Status)) {
    return { error: "Statut invalide" };
  }

  const planRaw = search.get("plan");
  if (planRaw !== null && !PLANS.includes(planRaw as Plan)) {
    return { error: "Formule invalide" };
  }

  const qRaw = search.get("q");
  const q = qRaw?.trim() ?? "";
  if (q.length > 80) return { error: "Recherche trop longue" };

  return {
    query: {
      ...(q ? { q } : {}),
      ...(statusRaw ? { status: statusRaw as Status } : {}),
      ...(planRaw ? { plan: planRaw as Plan } : {}),
      page,
      pageSize: pageSize as PageSize,
    },
  };
}

export function commercialSubscriptionWhere(query: SubscriptionListParams, now: Date) {
  return {
    kind: "COMMERCIAL" as const,
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? { company: { name: { contains: query.q, mode: "insensitive" as const } } } : {}),
    ...(query.plan
      ? { planAssignments: { some: { ...activeAt(now), plan: { code: query.plan } } } }
      : {}),
  };
}

export function commercialSubscriptionSelect(now: Date) {
  return {
    id: true,
    status: true,
    billingInterval: true,
    currentPeriodStart: true,
    currentPeriodEnd: true,
    cancelAtPeriodEnd: true,
    endedAt: true,
    company: { select: { id: true, name: true, email: true, phone: true } },
    planAssignments: {
      where: activeAt(now),
      orderBy: { effectiveFrom: "desc" as const },
      take: 1,
      select: {
        plan: {
          select: { code: true, name: true, monthlyPriceCents: true, annualPriceCents: true },
        },
      },
    },
    items: {
      where: activeAt(now),
      select: { code: true, kind: true, quantity: true, unitPriceCents: true },
    },
    usagePeriods: {
      where: { startsAt: { lte: now }, endsAt: { gt: now } },
      select: { includedOrders: true, orderCount: true, overageCount: true },
    },
  };
}

function nonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function subscriptionFollowUp(status: Status): SubscriptionFollowUp {
  switch (status) {
    case "ACTIVE":
      return "CURRENT";
    case "CANCEL_AT_PERIOD_END":
      return "ENDING";
    case "CANCELLED":
    case "EXPIRED":
      return "STOPPED";
    case "PENDING_PAYMENT":
    case "PAST_DUE":
    case "RESTRICTED":
    case "READ_ONLY":
      return "REMIND";
  }
}

export function recordedPriceCents(
  interval: "MONTHLY" | "ANNUAL" | null,
  plan: { monthlyPriceCents: number; annualPriceCents: number } | null,
  items: Array<{ quantity: number; unitPriceCents: number }>,
) {
  const planCents = plan
    ? nonNegative(interval === "ANNUAL" ? plan.annualPriceCents : plan.monthlyPriceCents)
    : 0;
  return items.reduce(
    (sum, item) => sum + nonNegative(item.quantity) * nonNegative(item.unitPriceCents),
    planCents,
  );
}

export function toCommercialSubscriptionRow(row: RawRow): CommercialSubscriptionRow {
  const options = new Map<string, number>();
  const seats = { DRIVER_SEAT: 0, ADMIN_SEAT: 0, DISPATCHER_SEAT: 0 };
  for (const item of row.items) {
    const quantity = nonNegative(item.quantity);
    if (item.kind === "OPTION") {
      options.set(item.code, (options.get(item.code) ?? 0) + quantity);
    } else {
      seats[item.kind] += quantity;
    }
  }

  const orders = {
    consumed: row.usagePeriods.reduce((sum, usage) => sum + nonNegative(usage.orderCount), 0),
    included: row.usagePeriods.reduce((sum, usage) => sum + nonNegative(usage.includedOrders), 0),
    overage: row.usagePeriods.reduce((sum, usage) => sum + nonNegative(usage.overageCount), 0),
  };

  const plan = row.planAssignments[0]?.plan ?? null;
  return {
    id: row.id,
    companyId: row.company.id,
    company: row.company.name,
    email: row.company.email,
    phone: row.company.phone,
    plan: plan?.code ?? null,
    status: row.status,
    followUp: subscriptionFollowUp(row.status),
    interval: row.billingInterval,
    periodStart: row.currentPeriodStart.toISOString(),
    periodEnd: row.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    endedAt: row.endedAt?.toISOString() ?? null,
    amountCents: recordedPriceCents(row.billingInterval, plan, row.items),
    orders,
    usageAlertPercent: orders.included > 0 ? orderUsageAlertPercent(orders.consumed, orders.included) : null,
    quantities: {
      options: [...options.entries()]
        .map(([code, quantity]) => ({ code, quantity }))
        .sort((a, b) => a.code.localeCompare(b.code)),
      seats,
    },
  };
}

export async function listCommercialSubscriptions(
  query: SubscriptionListParams,
  db: SubscriptionReader = prisma as unknown as SubscriptionReader
): Promise<CommercialSubscriptionPage> {
  const now = query.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("SUBSCRIPTION_LIST_DATE_INVALID");
  }
  const where = commercialSubscriptionWhere(query, now);
  const portfolio = { kind: "COMMERCIAL" as const };
  const [total, rows, current, remind, ending, stopped] = await Promise.all([
    db.saasSubscription.count({ where }),
    db.saasSubscription.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: commercialSubscriptionSelect(now),
    }),
    db.saasSubscription.count({ where: { ...portfolio, status: "ACTIVE" } }),
    db.saasSubscription.count({
      where: { ...portfolio, status: { in: ["PENDING_PAYMENT", "PAST_DUE", "RESTRICTED", "READ_ONLY"] } },
    }),
    db.saasSubscription.count({ where: { ...portfolio, status: "CANCEL_AT_PERIOD_END" } }),
    db.saasSubscription.count({ where: { ...portfolio, status: { in: ["CANCELLED", "EXPIRED"] } } }),
  ]);

  return {
    page: query.page,
    pageSize: query.pageSize,
    total,
    summary: { current, remind, ending, stopped },
    rows: rows.map(toCommercialSubscriptionRow),
  };
}
