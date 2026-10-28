import { prisma } from "@/services/prisma/client";
import { orderUsageAlertPercent } from "@/domains/saas/saas.service";

type JsonRecord = Record<string, unknown>;
type PlanCode = "STARTER" | "PRO" | "BUSINESS";

type BillingAccountSource = { id: string; state: unknown };
type FakeSignupSource = {
  id: string;
  quoteSnapshot: unknown;
  billingAccount: { id: string } | null;
  paymentEvents: Array<{
    eventKey: string;
    status: string;
    amountCents: number;
    currency: string;
    snapshot: unknown;
    receivedAt: Date;
  }>;
};
type CommercialSubscriptionSource = {
  id: string;
  kind: string;
  status: string;
  startsAt: Date;
  company: { id: string; name: string; users: Array<{ id: string }> };
  planAssignments: Array<{ snapshot: unknown }>;
  items: Array<{ code: string; kind: string; quantity: number }>;
  usagePeriods: Array<{
    includedOrders: number;
    orderCount: number;
    overageCount: number;
  }>;
};

export type SaasHealthSources = {
  billingAccounts: BillingAccountSource[];
  fakeSignups: FakeSignupSource[];
  subscriptions: CommercialSubscriptionSource[];
};

export type SaasHealthPlanIndicators = {
  planCode: PlanCode;
  subscriptions: number;
  activations: number;
  orders: number;
  includedOrders: number;
  overageOrders: number;
  drivers: number;
  activeOptionUnits: number;
};

/** Décision C10 : seuils d'alerte de consommation côté plateforme. */
export const BUSINESS_ORDER_ALERT_MULTIPLIER = 2;
export const BUSINESS_DRIVER_ALERT = 40;

export type SaasUsageAlert = {
  companyId: string;
  name: string;
  planCode: PlanCode | null;
  kind: "ORDERS_80" | "ORDERS_100" | "ORDERS_120" | "BUSINESS_ORDERS_DOUBLE" | "BUSINESS_DRIVERS_40";
  value: number;
  threshold: number;
};

const ALERT_SEVERITY: Record<SaasUsageAlert["kind"], number> = {
  BUSINESS_ORDERS_DOUBLE: 5,
  BUSINESS_DRIVERS_40: 4,
  ORDERS_120: 3,
  ORDERS_100: 2,
  ORDERS_80: 1,
};

/** Au plus une alerte par entreprise et par nature : le plus haut seuil franchi, sans doublon. */
export function companyUsageAlerts(input: {
  companyId: string;
  name: string;
  planCode: PlanCode | null;
  orders: number;
  includedOrders: number;
  drivers: number;
}): SaasUsageAlert[] {
  const base = { companyId: input.companyId, name: input.name, planCode: input.planCode };
  const alerts: SaasUsageAlert[] = [];
  if (input.includedOrders > 0) {
    const level = orderUsageAlertPercent(input.orders, input.includedOrders);
    if (level) {
      alerts.push({ ...base, kind: `ORDERS_${level}`, value: input.orders, threshold: Math.ceil((input.includedOrders * level) / 100) });
    }
    const doubled = input.includedOrders * BUSINESS_ORDER_ALERT_MULTIPLIER;
    if (input.planCode === "BUSINESS" && input.orders >= doubled) {
      alerts.push({ ...base, kind: "BUSINESS_ORDERS_DOUBLE", value: input.orders, threshold: doubled });
    }
  }
  if (input.planCode === "BUSINESS" && input.drivers >= BUSINESS_DRIVER_ALERT) {
    alerts.push({ ...base, kind: "BUSINESS_DRIVERS_40", value: input.drivers, threshold: BUSINESS_DRIVER_ALERT });
  }
  return alerts;
}

export type SaasHealthIndicators = {
  period: { startsAt: string; endsAt: string; timezone: "UTC" };
  revenue: {
    subscriptionPaidHtCents: number;
    usagePaidHtCents: number;
    ignoredRecords: number;
    refundedInvoicesObserved: number;
    /** Remboursements des factures comptées dans le mois, ventilés en HT au prorata (provisoire). */
    refundedHtCents: number;
    /** Abonnements et dépassements HT, remboursements déduits. */
    netPaidHtCents: number;
  };
  activation: { commercialSubscriptions: number; newSubscriptions: number };
  consumption: {
    orders: number;
    includedOrders: number;
    overageOrders: number;
    drivers: number;
    activeOptionUnits: number;
  };
  byPlan: SaasHealthPlanIndicators[];
  companies: Array<{
    companyId: string;
    name: string;
    planCode: PlanCode | null;
    status: string;
    startsAt: string;
    orders: number;
    drivers: number;
    activeOptionUnits: number;
  }>;
  alerts: SaasUsageAlert[];
  definitions: string[];
};

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function money(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function dateValue(value: unknown) {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function planCode(value: unknown): PlanCode | null {
  const snapshot = record(value);
  return snapshot?.planCode === "STARTER" || snapshot?.planCode === "PRO" || snapshot?.planCode === "BUSINESS"
    ? snapshot.planCode
    : null;
}

export function saasHealthMonth(at: Date) {
  if (!(at instanceof Date) || !Number.isFinite(at.getTime())) throw new Error("SAAS_HEALTH_DATE_INVALID");
  const startsAt = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  const endsAt = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
  return { startsAt, endsAt };
}

export function buildSaasHealthIndicators(
  sources: SaasHealthSources,
  at: Date = new Date()
): SaasHealthIndicators {
  const period = saasHealthMonth(at);
  let subscriptionPaidHtCents = 0;
  let usagePaidHtCents = 0;
  let ignoredRecords = 0;
  let refundedInvoicesObserved = 0;
  let refundedHtCents = 0;
  const seenInvoices = new Set<string>();

  for (const account of sources.billingAccounts) {
    const state = record(account.state);
    const invoices = Array.isArray(state?.invoices) ? state.invoices : [];
    for (const rawInvoice of invoices) {
      const invoice = record(rawInvoice);
      const id = typeof invoice?.id === "string" ? invoice.id : null;
      const dueAt = dateValue(invoice?.dueAt);
      const subtotalCents = money(invoice?.subtotalCents);
      const totalCents = money(invoice?.totalCents);
      const paidCents = money(invoice?.paidCents);
      const refundedCents = money(invoice?.refundedCents);
      const reason = typeof invoice?.reason === "string" ? invoice.reason : null;
      if (!id || seenInvoices.has(id)) continue;
      seenInvoices.add(id);
      if (
        invoice?.status !== "paid" ||
        invoice.currency !== "EUR" ||
        dueAt === null ||
        subtotalCents === null ||
        totalCents === null ||
        paidCents !== totalCents ||
        refundedCents === null
      ) {
        ignoredRecords++;
        continue;
      }
      if (refundedCents > 0) refundedInvoicesObserved++;
      if (dueAt < period.startsAt.getTime() || dueAt >= period.endsAt.getTime()) continue;
      if (reason === "usage" || reason === "subscription_usage") {
        usagePaidHtCents += subtotalCents;
      } else if (["subscription_create", "subscription_cycle", "subscription_update"].includes(reason ?? "")) {
        subscriptionPaidHtCents += subtotalCents;
      } else {
        ignoredRecords++;
        continue;
      }
      // Le fournisseur ne donne pas la date du remboursement : il suit le mois de sa facture.
      if (refundedCents > 0 && totalCents > 0) refundedHtCents += Math.round((refundedCents * subtotalCents) / totalCents);
    }
  }

  for (const signup of sources.fakeSignups) {
    if (signup.billingAccount) continue;
    const quote = record(signup.quoteSnapshot);
    const totalHtCents = money(quote?.totalHtCents);
    const totalTtcCents = money(quote?.totalTtcCents);
    const firstConfirmed = signup.paymentEvents
      .filter((event) => {
        const snapshot = record(event.snapshot);
        return event.status === "CONFIRMED" &&
          snapshot?.adapter === "fake" &&
          event.currency === "EUR";
      })
      .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())[0];
    if (!firstConfirmed || firstConfirmed.receivedAt < period.startsAt || firstConfirmed.receivedAt >= period.endsAt) continue;
    if (totalHtCents === null || totalTtcCents === null || firstConfirmed.amountCents !== totalTtcCents) {
      ignoredRecords++;
      continue;
    }
    subscriptionPaidHtCents += totalHtCents;
  }

  const emptyPlan = (code: PlanCode): SaasHealthPlanIndicators => ({
    planCode: code,
    subscriptions: 0,
    activations: 0,
    orders: 0,
    includedOrders: 0,
    overageOrders: 0,
    drivers: 0,
    activeOptionUnits: 0,
  });
  const planIndicators = new Map<PlanCode, SaasHealthPlanIndicators>([
    ["STARTER", emptyPlan("STARTER")],
    ["PRO", emptyPlan("PRO")],
    ["BUSINESS", emptyPlan("BUSINESS")],
  ]);
  const companies: SaasHealthIndicators["companies"] = [];
  const alerts: SaasUsageAlert[] = [];
  let newSubscriptions = 0;
  let orders = 0;
  let includedOrders = 0;
  let overageOrders = 0;
  let drivers = 0;
  let activeOptionUnits = 0;

  for (const subscription of sources.subscriptions) {
    if (subscription.kind !== "COMMERCIAL") continue;
    const currentPlan = planCode(subscription.planAssignments[0]?.snapshot);
    const activatedInPeriod = subscription.startsAt >= period.startsAt && subscription.startsAt < period.endsAt;
    const companyOrders = subscription.usagePeriods.reduce((sum, usage) => sum + Math.max(0, usage.orderCount), 0);
    const companyIncluded = subscription.usagePeriods.reduce((sum, usage) => sum + Math.max(0, usage.includedOrders), 0);
    const companyOverage = subscription.usagePeriods.reduce((sum, usage) => sum + Math.max(0, usage.overageCount), 0);
    const companyDrivers = subscription.company.users.length;
    const companyOptions = subscription.items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0);
    if (activatedInPeriod) newSubscriptions++;
    orders += companyOrders;
    includedOrders += companyIncluded;
    overageOrders += companyOverage;
    drivers += companyDrivers;
    activeOptionUnits += companyOptions;
    if (currentPlan) {
      const plan = planIndicators.get(currentPlan)!;
      plan.subscriptions++;
      if (activatedInPeriod) plan.activations++;
      plan.orders += companyOrders;
      plan.includedOrders += companyIncluded;
      plan.overageOrders += companyOverage;
      plan.drivers += companyDrivers;
      plan.activeOptionUnits += companyOptions;
    }
    alerts.push(...companyUsageAlerts({
      companyId: subscription.company.id,
      name: subscription.company.name,
      planCode: currentPlan,
      orders: companyOrders,
      includedOrders: companyIncluded,
      drivers: companyDrivers,
    }));
    companies.push({
      companyId: subscription.company.id,
      name: subscription.company.name,
      planCode: currentPlan,
      status: subscription.status,
      startsAt: subscription.startsAt.toISOString(),
      orders: companyOrders,
      drivers: companyDrivers,
      activeOptionUnits: companyOptions,
    });
  }

  companies.sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return {
    period: {
      startsAt: period.startsAt.toISOString(),
      endsAt: period.endsAt.toISOString(),
      timezone: "UTC",
    },
    revenue: {
      subscriptionPaidHtCents,
      usagePaidHtCents,
      ignoredRecords,
      refundedInvoicesObserved,
      refundedHtCents,
      netPaidHtCents: subscriptionPaidHtCents + usagePaidHtCents - refundedHtCents,
    },
    activation: {
      commercialSubscriptions: sources.subscriptions.filter((subscription) => subscription.kind === "COMMERCIAL").length,
      newSubscriptions,
    },
    consumption: { orders, includedOrders, overageOrders, drivers, activeOptionUnits },
    byPlan: [...planIndicators.values()],
    companies: companies.slice(0, 50),
    alerts: alerts.sort((a, b) => ALERT_SEVERITY[b.kind] - ALERT_SEVERITY[a.kind] || a.name.localeCompare(b.name) || a.companyId.localeCompare(b.companyId)),
    definitions: [
      "Période : mois civil UTC ; commandes issues des compteurs SaaS et options/sièges observés à la date de lecture.",
      "SaaS : montant HT brut des factures marquées payées dont l’échéance est dans le mois, complété par les faux paiements confirmés sans compte de facturation.",
      "Factures de livraison : indicateur séparé ; elles ne sont jamais incluses dans le montant SaaS.",
      "Remboursements : déduits dans le mois de leur facture, faute de date de remboursement chez le fournisseur ; HT ventilé au prorata de la facture, à titre provisoire et sans validation comptable.",
      "Lecture locale : le rapprochement facture par facture avec le fournisseur se lance par `npm run saas02:reconcile` ; aucun taux de conversion, rétention, coût ou marge n’est déduit.",
      "Alertes (décision C10) : 80, 100 et 120 % des commandes incluses du mois ; Business dès deux fois les commandes incluses ou 40 livreurs actifs ou invités. Calculées à la lecture, une seule par entreprise et par nature.",
    ],
  };
}

type SaasHealthDatabase = Pick<
  typeof prisma,
  "saasBillingAccount" | "signupJourney" | "saasSubscription"
>;

export async function getSaasHealthIndicators(
  at: Date = new Date(),
  db: SaasHealthDatabase = prisma
): Promise<SaasHealthIndicators> {
  const period = saasHealthMonth(at);
  const [billingAccounts, fakeSignups, subscriptions] = await Promise.all([
    db.saasBillingAccount.findMany({ select: { id: true, state: true } }),
    db.signupJourney.findMany({
      where: {
        paymentEvents: {
          some: {
            status: "CONFIRMED",
            receivedAt: { gte: period.startsAt, lt: period.endsAt },
          },
        },
      },
      select: {
        id: true,
        quoteSnapshot: true,
        billingAccount: { select: { id: true } },
        paymentEvents: {
          where: {
            status: "CONFIRMED",
          },
          orderBy: { receivedAt: "asc" },
          select: {
            eventKey: true,
            status: true,
            amountCents: true,
            currency: true,
            snapshot: true,
            receivedAt: true,
          },
        },
      },
    }),
    db.saasSubscription.findMany({
      where: { kind: "COMMERCIAL" },
      select: {
        id: true,
        kind: true,
        status: true,
        startsAt: true,
        company: {
          select: {
            id: true,
            name: true,
            users: {
              where: {
                status: { in: ["ACTIVE", "PENDING_VERIFICATION"] },
                role: { systemRole: "DRIVER" },
              },
              select: { id: true },
            },
          },
        },
        planAssignments: {
          where: { effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] },
          orderBy: { effectiveFrom: "desc" },
          take: 1,
          select: { snapshot: true },
        },
        items: {
          where: { effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] },
          select: { code: true, kind: true, quantity: true },
        },
        usagePeriods: {
          where: { startsAt: { gte: period.startsAt, lt: period.endsAt } },
          select: { includedOrders: true, orderCount: true, overageCount: true },
        },
      },
    }),
  ]);

  return buildSaasHealthIndicators({
    billingAccounts: billingAccounts as unknown as BillingAccountSource[],
    fakeSignups: fakeSignups as unknown as FakeSignupSource[],
    subscriptions: subscriptions as unknown as CommercialSubscriptionSource[],
  }, at);
}
