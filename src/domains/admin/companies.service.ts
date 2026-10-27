import { prisma } from "@/services/prisma/client";
import { recordedPriceCents, subscriptionFollowUp, type SubscriptionFollowUp } from "@/domains/admin/subscriptions.service";

const STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "TRIAL"] as const;
const PAGE_SIZES = [25, 50, 100] as const;
const PARAMS = ["q", "status", "page", "pageSize"] as const;

type Status = (typeof STATUSES)[number];
type PageSize = (typeof PAGE_SIZES)[number];

export type CompanyListParams = {
  q?: string;
  status?: Status;
  page: number;
  pageSize: PageSize;
};

export type PlatformCompanyRow = {
  id: string;
  name: string;
  status: Status;
  createdAt: string;
  userCount: number;
  deliveryCount: number;
};

export type PlatformCompanyPage = {
  page: number;
  pageSize: PageSize;
  total: number;
  rows: PlatformCompanyRow[];
};

type RawRow = {
  id: string;
  name: string;
  status: Status;
  createdAt: Date;
  _count: { users: number; deliveries: number };
};

type CompanyReader = {
  company: {
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
    findMany: (args: Record<string, unknown>) => Promise<RawRow[]>;
  };
};

type Money = { toString(): string } | number | null;
type DetailPlan = { code: "STARTER" | "PRO" | "BUSINESS"; name: string; monthlyPriceCents: number; annualPriceCents: number };
type DetailItem = {
  code: string;
  kind: "OPTION" | "DRIVER_SEAT" | "ADMIN_SEAT" | "DISPATCHER_SEAT";
  quantity: number;
  unitPriceCents: number;
  option: { name: string } | null;
};
type DetailSubscription = {
  status: "PENDING_PAYMENT" | "ACTIVE" | "PAST_DUE" | "RESTRICTED" | "READ_ONLY" | "CANCEL_AT_PERIOD_END" | "CANCELLED" | "EXPIRED";
  kind: "COMMERCIAL" | "PILOT" | "LEGACY";
  billingInterval: "MONTHLY" | "ANNUAL" | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  endedAt: Date | null;
  premiumDiscoveryEndsAt: Date | null;
  planAssignments: Array<{ plan: DetailPlan }>;
  items: DetailItem[];
  usagePeriods: Array<{ includedOrders: number; orderCount: number; overageCount: number }>;
};
type DetailRow = {
  id: string;
  name: string;
  legalName: string | null;
  slug: string;
  status: Status;
  isDemo: boolean;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  siren: string | null;
  siret: string | null;
  billingAddress: string | null;
  billingPostalCode: string | null;
  billingCity: string | null;
  createdAt: Date;
  _count: { users: number; deliveries: number };
  users: Array<{ firstName: string; lastName: string; email: string; phone: string | null }>;
  saasSubscription: DetailSubscription | null;
};

export type PlatformCompanyDetail = {
  id: string;
  name: string;
  legalName: string | null;
  slug: string;
  status: Status;
  isDemo: boolean;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  siren: string | null;
  siret: string | null;
  billingAddress: string | null;
  billingPostalCode: string | null;
  billingCity: string | null;
  createdAt: string;
  userCount: number;
  deliveryCount: number;
  admin: { name: string; email: string; phone: string | null } | null;
  revenue: { paidCents: number; pendingCents: number; overdueCents: number };
  subscription: {
    kind: DetailSubscription["kind"];
    status: DetailSubscription["status"];
    followUp: SubscriptionFollowUp;
    interval: "MONTHLY" | "ANNUAL" | null;
    periodStart: string;
    periodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    endedAt: string | null;
    premiumDiscoveryEndsAt: string | null;
    plan: { code: DetailPlan["code"]; name: string } | null;
    amountCents: number;
    options: Array<{ code: string; name: string; quantity: number; unitPriceCents: number }>;
    seats: { DRIVER_SEAT: number; ADMIN_SEAT: number; DISPATCHER_SEAT: number };
    orders: { consumed: number; included: number; overage: number };
  } | null;
};

type CompanyDetailReader = {
  company: {
    findUnique: (args: { where: { id: string }; select: ReturnType<typeof platformCompanyDetailSelect> }) => Promise<DetailRow | null>;
  };
  invoice: {
    groupBy: (args: { by: ["status"]; where: { companyId: string; status: { in: Array<"PAID" | "PENDING" | "OVERDUE"> } }; _sum: { amount: true } }) => Promise<Array<{ status: "PAID" | "PENDING" | "OVERDUE"; _sum: { amount: Money } }>>;
  };
};

function integerParam(value: string) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function parseCompanyListParams(
  search: URLSearchParams
): { query: CompanyListParams } | { error: string } {
  for (const key of search.keys()) {
    if (!PARAMS.includes(key as (typeof PARAMS)[number])) return { error: "Paramètre inconnu" };
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
  if (statusRaw !== null && !STATUSES.includes(statusRaw as Status)) return { error: "Statut invalide" };

  const q = search.get("q")?.trim() ?? "";
  if (q.length > 80) return { error: "Recherche trop longue" };

  return {
    query: {
      ...(q ? { q } : {}),
      ...(statusRaw ? { status: statusRaw as Status } : {}),
      page,
      pageSize: pageSize as PageSize,
    },
  };
}

export function platformCompanyWhere(query: CompanyListParams) {
  return {
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? { name: { contains: query.q, mode: "insensitive" as const } } : {}),
  };
}

export function platformCompanySelect() {
  return {
    id: true,
    name: true,
    status: true,
    createdAt: true,
    _count: { select: { users: true, deliveries: true } },
  };
}

export function toPlatformCompanyRow(row: RawRow): PlatformCompanyRow {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    userCount: row._count.users,
    deliveryCount: row._count.deliveries,
  };
}

export async function listPlatformCompanies(
  query: CompanyListParams,
  db: CompanyReader = prisma as unknown as CompanyReader
): Promise<PlatformCompanyPage> {
  const where = platformCompanyWhere(query);
  const [total, rows] = await Promise.all([
    db.company.count({ where }),
    db.company.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: platformCompanySelect(),
    }),
  ]);

  return {
    page: query.page,
    pageSize: query.pageSize,
    total,
    rows: rows.map(toPlatformCompanyRow),
  };
}

function activeAt(now: Date) {
  return {
    effectiveFrom: { lte: now },
    OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
  };
}

export function platformCompanyDetailSelect(now: Date) {
  return {
    id: true,
    name: true,
    legalName: true,
    slug: true,
    status: true,
    isDemo: true,
    email: true,
    phone: true,
    address: true,
    city: true,
    country: true,
    siren: true,
    siret: true,
    billingAddress: true,
    billingPostalCode: true,
    billingCity: true,
    createdAt: true,
    _count: { select: { users: true, deliveries: true } },
    users: {
      where: { role: { systemRole: "COMPANY_ADMIN" as const }, status: "ACTIVE" as const },
      orderBy: { createdAt: "asc" as const },
      take: 1,
      select: { firstName: true, lastName: true, email: true, phone: true },
    },
    saasSubscription: {
      select: {
        status: true,
        kind: true,
        billingInterval: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        endedAt: true,
        premiumDiscoveryEndsAt: true,
        planAssignments: {
          where: activeAt(now),
          orderBy: { effectiveFrom: "desc" as const },
          take: 1,
          select: {
            plan: { select: { code: true, name: true, monthlyPriceCents: true, annualPriceCents: true } },
          },
        },
        items: {
          where: activeAt(now),
          select: {
            code: true,
            kind: true,
            quantity: true,
            unitPriceCents: true,
            option: { select: { name: true } },
          },
        },
        usagePeriods: {
          where: { startsAt: { lte: now }, endsAt: { gt: now } },
          select: { includedOrders: true, orderCount: true, overageCount: true },
        },
      },
    },
  };
}

function eurosToCents(value: Money) {
  if (value == null) return 0;
  const euros = Number(value.toString());
  return Number.isFinite(euros) ? Math.max(0, Math.round(euros * 100)) : 0;
}

function nonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function toPlatformCompanyDetail(
  row: DetailRow,
  invoices: Array<{ status: "PAID" | "PENDING" | "OVERDUE"; _sum: { amount: Money } }>,
): PlatformCompanyDetail {
  const admin = row.users[0];
  const revenue = { paidCents: 0, pendingCents: 0, overdueCents: 0 };
  for (const invoice of invoices) {
    const cents = eurosToCents(invoice._sum.amount);
    if (invoice.status === "PAID") revenue.paidCents += cents;
    if (invoice.status === "PENDING") revenue.pendingCents += cents;
    if (invoice.status === "OVERDUE") revenue.overdueCents += cents;
  }
  const subscription = row.saasSubscription;
  const plan = subscription?.planAssignments[0]?.plan ?? null;
  const options = new Map<string, { code: string; name: string; quantity: number; unitPriceCents: number }>();
  const seats = { DRIVER_SEAT: 0, ADMIN_SEAT: 0, DISPATCHER_SEAT: 0 };
  for (const item of subscription?.items ?? []) {
    const quantity = nonNegative(item.quantity);
    if (item.kind === "OPTION") {
      const current = options.get(item.code);
      options.set(item.code, {
        code: item.code,
        name: item.option?.name ?? item.code,
        quantity: (current?.quantity ?? 0) + quantity,
        unitPriceCents: nonNegative(item.unitPriceCents),
      });
    } else {
      seats[item.kind] += quantity;
    }
  }
  const orders = {
    consumed: (subscription?.usagePeriods ?? []).reduce((sum, usage) => sum + nonNegative(usage.orderCount), 0),
    included: (subscription?.usagePeriods ?? []).reduce((sum, usage) => sum + nonNegative(usage.includedOrders), 0),
    overage: (subscription?.usagePeriods ?? []).reduce((sum, usage) => sum + nonNegative(usage.overageCount), 0),
  };

  return {
    id: row.id,
    name: row.name,
    legalName: row.legalName,
    slug: row.slug,
    status: row.status,
    isDemo: row.isDemo,
    email: row.email,
    phone: row.phone,
    address: row.address,
    city: row.city,
    country: row.country,
    siren: row.siren,
    siret: row.siret,
    billingAddress: row.billingAddress,
    billingPostalCode: row.billingPostalCode,
    billingCity: row.billingCity,
    createdAt: row.createdAt.toISOString(),
    userCount: row._count.users,
    deliveryCount: row._count.deliveries,
    admin: admin ? { name: `${admin.firstName} ${admin.lastName}`.trim(), email: admin.email, phone: admin.phone } : null,
    revenue,
    subscription: subscription ? {
      kind: subscription.kind,
      status: subscription.status,
      followUp: subscriptionFollowUp(subscription.status),
      interval: subscription.billingInterval,
      periodStart: subscription.currentPeriodStart.toISOString(),
      periodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      endedAt: subscription.endedAt?.toISOString() ?? null,
      premiumDiscoveryEndsAt: subscription.premiumDiscoveryEndsAt?.toISOString() ?? null,
      plan: plan ? { code: plan.code, name: plan.name } : null,
      amountCents: recordedPriceCents(subscription.billingInterval, plan, subscription.items),
      options: [...options.values()].sort((a, b) => a.code.localeCompare(b.code)),
      seats,
      orders,
    } : null,
  };
}

export async function getPlatformCompany(
  id: string,
  db: CompanyDetailReader = prisma as unknown as CompanyDetailReader,
  now = new Date(),
): Promise<PlatformCompanyDetail | null> {
  const row = await db.company.findUnique({ where: { id }, select: platformCompanyDetailSelect(now) });
  if (!row) return null;
  const invoices = await db.invoice.groupBy({
    by: ["status"],
    where: { companyId: id, status: { in: ["PAID", "PENDING", "OVERDUE"] } },
    _sum: { amount: true },
  });
  return toPlatformCompanyDetail(row, invoices);
}
