import { prisma } from "@/services/prisma/client";
import { SAAS_FEATURE_LABELS } from "@/domains/saas/saas-access";
import {
  PREMIUM_DISCOVERY_FEATURES,
  premiumDiscoveryEndAfterCancellation,
  premiumDiscoveryEndAfterPaymentFailure,
} from "@/domains/saas/saas.service";
import type { SubscriptionView } from "./subscription-view.types";

type JsonRecord = Record<string, unknown>;

type SubscriptionUsagePeriod = {
  startsAt: Date;
  endsAt: Date;
  includedOrders: number;
  orderCount: number;
  overageCount: number;
};

type SubscriptionAccount = {
  state: unknown;
  subscription: {
    currentPeriodStart: Date;
    currentPeriodEnd: Date | null;
    status: string;
    billingInterval: string | null;
    cancelAtPeriodEnd: boolean;
    premiumDiscoveryEndsAt: Date | null;
    usagePeriods: SubscriptionUsagePeriod[];
  } | null;
  operations: Array<{ id: string; kind: string; status: string; createdAt: Date; completedAt: Date | null }>;
};

/** Abonnement sans compte de facturation en ligne : pilote, accès historique ou paiement manuel. */
type ManagedSubscription = {
  kind: "COMMERCIAL" | "PILOT" | "LEGACY";
  status: string;
  billingInterval: string | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  premiumDiscoveryEndsAt: Date | null;
  planAssignments: Array<{ plan: { code: string; name: string } }>;
  items: Array<{ code: string; quantity: number; unitPriceCents: number; option: { name: string } | null }>;
  usagePeriods: SubscriptionUsagePeriod[];
};

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function text(value: unknown, max = 120): string | null {
  return typeof value === "string" && value.trim() && value.trim().length <= max
    ? value.trim()
    : null;
}

function amount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function interval(value: unknown): "MONTHLY" | "ANNUAL" | null {
  return value === "MONTHLY" || value === "ANNUAL" ? value : null;
}

/** Seules les demandes lisibles par le client sont listées ; webhooks et relances internes restent hors historique. */
function operationLabel(kind: string): string | null {
  return ({
    CHECKOUT: "Paiement d’abonnement préparé",
    CHANGE: "Changement d’abonnement",
    CANCEL: "Résiliation demandée",
    REFUND: "Remboursement traité",
    USAGE: "Dépassement de commandes facturé",
  } as Record<string, string>)[kind] ?? null;
}

function operationStatus(status: string) {
  return ({
    PREPARED: "Préparée",
    DONE: "Terminée",
    REJECTED: "Refusée",
    FAILED: "Échouée",
  } as Record<string, string>)[status] ?? "En attente de rapprochement";
}

function invoiceLabel(reason: string) {
  return ({
    subscription_create: "Facture d’activation",
    subscription_cycle: "Facture de renouvellement",
    subscription_update: "Facture de changement d’abonnement",
    subscription_usage: "Facture de dépassement de commandes",
  } as Record<string, string>)[reason] ?? "Facture d’abonnement";
}

function invoiceStatus(status: string) {
  return ({
    paid: "Payée",
    open: "En attente de paiement",
    draft: "Brouillon",
    void: "Annulée",
    uncollectible: "Impayée",
  } as Record<string, string>)[status] ?? "État inconnu";
}

function stateStatus(status: string) {
  return ({
    ACTIVE: "Actif",
    PENDING_PAYMENT: "Paiement en attente",
    PAST_DUE: "Paiement en retard",
    RESTRICTED: "Accès restreint",
    READ_ONLY: "Accès en lecture seule",
    CANCEL_AT_PERIOD_END: "Résiliation en fin de période",
    CANCELLED: "Résilié",
    EXPIRED: "Expiré",
  } as Record<string, string>)[status] ?? "État à vérifier";
}

const CANCEL_ALERT = { code: "CANCEL_AT_PERIOD_END", label: "Résiliation prévue à la fin de période" };

function usageView(periods: SubscriptionUsagePeriod[]): SubscriptionView["usage"] {
  const current = periods[0];
  return current
    ? {
        usedOrders: Math.max(0, current.orderCount),
        includedOrders: Math.max(0, current.includedOrders),
        overageOrders: Math.max(0, current.overageCount),
      }
    : null;
}

function usageAlerts(usage: SubscriptionView["usage"]): SubscriptionView["alerts"] {
  if (!usage || usage.includedOrders <= 0) return [];
  const reached = (threshold: number) => usage.usedOrders * 100 >= usage.includedOrders * threshold;
  if (reached(120)) return [{ code: "USAGE_120", label: "120 % du forfait de commandes atteint" }];
  if (reached(100)) return [{ code: "USAGE_100", label: "Forfait de commandes atteint" }];
  if (reached(80)) return [{ code: "USAGE_80", label: "80 % du forfait de commandes atteint" }];
  return [];
}

function premiumDiscoveryView(planCode: string, endsAt: Date | null, at: Date): SubscriptionView["premiumDiscovery"] {
  return (planCode === "STARTER" || planCode === "PRO") &&
    endsAt instanceof Date &&
    Number.isFinite(endsAt.getTime()) &&
    endsAt.getTime() > at.getTime()
    ? {
        endsAt: endsAt.toISOString(),
        features: PREMIUM_DISCOVERY_FEATURES.map((code) => ({
          code,
          name: SAAS_FEATURE_LABELS[code],
        })),
      }
    : null;
}

export function buildSubscriptionView(
  account: SubscriptionAccount,
  at: Date = new Date()
): SubscriptionView | null {
  const state = record(account.state);
  const contract = record(state?.activeContract);
  const quote = record(contract?.quote);
  const planCode = text(quote?.planCode, 40);
  const planName = text(quote?.planName, 120);
  const billingInterval = interval(quote?.billingInterval) ?? interval(account.subscription?.billingInterval);
  if (!account.subscription || !state || !contract || !quote || !planCode || !planName || !billingInterval) return null;

  const lines = Array.isArray(contract.lines) ? contract.lines : [];
  const options = lines.flatMap((line) => {
    const value = record(line);
    const code = text(value?.code, 120);
    const name = text(value?.name, 160);
    const quantity = amount(value?.quantity);
    const unitPriceCents = amount(value?.unitHtCents);
    if (!code || code.startsWith("plan:") || !name || !quantity || unitPriceCents === null) return [];
    return [{ code, name, quantity, unitPriceCents }];
  });

  const usage = usageView(account.subscription.usagePeriods);
  const status = text(state.status, 40) ?? account.subscription.status;
  const cancelAtPeriodEnd = account.subscription.cancelAtPeriodEnd || state.cancelAtPeriodEnd === true;
  const premiumDiscovery = premiumDiscoveryView(
    planCode,
    premiumDiscoveryEndAfterCancellation(
      premiumDiscoveryEndAfterPaymentFailure(account.subscription.premiumDiscoveryEndsAt, text(state.failedAt, 40)),
      cancelAtPeriodEnd,
      at
    ),
    at
  );
  const alerts = usageAlerts(usage);
  if (status !== "ACTIVE") alerts.push({ code: `STATUS_${status}`, label: stateStatus(status) });
  if (cancelAtPeriodEnd) alerts.push(CANCEL_ALERT);
  if (record(state.pendingChange)) alerts.push({ code: "PENDING_CHANGE", label: "Changement d’abonnement en attente" });

  const invoices = Array.isArray(state.invoices) ? state.invoices : [];
  const history = [
    ...account.operations.flatMap((operation) => {
      const occurredAt = operation.completedAt ?? operation.createdAt;
      const label = operationLabel(operation.kind);
      return !label || Number.isNaN(occurredAt.getTime()) ? [] : [{
        type: "operation" as const,
        label,
        status: operationStatus(operation.status),
        occurredAt: occurredAt.toISOString(),
        internalKey: `operation:${operation.id}`,
      }];
    }),
    ...invoices.flatMap((invoice) => {
      const value = record(invoice);
      const reason = text(value?.reason, 80);
      const rawStatus = text(value?.status, 40);
      const id = text(value?.id, 160);
      const occurredAt = text(value?.dueAt, 80);
      const total = amount(value?.totalCents);
      if (!id || !reason || !rawStatus || !occurredAt || Number.isNaN(Date.parse(occurredAt)) || total === null) return [];
      return [{
        type: "invoice" as const,
        label: invoiceLabel(reason),
        status: invoiceStatus(rawStatus),
        occurredAt: new Date(occurredAt).toISOString(),
        amountCents: total,
        internalKey: `invoice:${id}`,
      }];
    }),
  ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const seenHistory = new Set<string>();
  const uniqueHistory = history.flatMap(({ internalKey, ...entry }) => {
    if (seenHistory.has(internalKey)) return [];
    seenHistory.add(internalKey);
    return [entry];
  });

  return {
    formula: { code: planCode, name: planName },
    billingInterval,
    period: {
      startsAt: account.subscription.currentPeriodStart.toISOString(),
      endsAt: account.subscription.currentPeriodEnd?.toISOString() ?? null,
    },
    premiumDiscovery,
    options,
    usage,
    status: stateStatus(status),
    alerts,
    history: uniqueHistory,
    management: "SELF_SERVICE",
    cancelAtPeriodEnd,
    canCancel: (status === "ACTIVE" || status === "PAST_DUE") && !cancelAtPeriodEnd,
    canChange: status === "ACTIVE" && !cancelAtPeriodEnd && !record(state.pendingChange),
  };
}

const MANAGED_FORMULAS = {
  PILOT: { code: "PILOT", name: "Pilote accompagné" },
  LEGACY: { code: "LEGACY", name: "Accès historique" },
} as const;

/**
 * SAAS-03, décision du 27 octobre 2026 : sans compte de facturation en ligne, l'abonnement
 * est affiché en lecture seule et ses changements passent par l'équipe TutelLiv.
 */
export function buildManagedSubscriptionView(
  subscription: ManagedSubscription,
  at: Date = new Date()
): SubscriptionView | null {
  const plan = subscription.planAssignments[0]?.plan;
  const formula = subscription.kind === "COMMERCIAL"
    ? plan && text(plan.code, 40) && text(plan.name, 120) ? { code: plan.code, name: plan.name } : null
    : MANAGED_FORMULAS[subscription.kind];
  if (!formula) return null;

  const usage = usageView(subscription.usagePeriods);
  const cancelAtPeriodEnd = subscription.cancelAtPeriodEnd || subscription.status === "CANCEL_AT_PERIOD_END";
  const alerts = usageAlerts(usage);
  if (subscription.status !== "ACTIVE" && subscription.status !== "CANCEL_AT_PERIOD_END") {
    alerts.push({ code: `STATUS_${subscription.status}`, label: stateStatus(subscription.status) });
  }
  if (cancelAtPeriodEnd) alerts.push(CANCEL_ALERT);

  return {
    formula,
    billingInterval: interval(subscription.billingInterval),
    period: {
      startsAt: subscription.currentPeriodStart.toISOString(),
      endsAt: subscription.currentPeriodEnd?.toISOString() ?? null,
    },
    premiumDiscovery: premiumDiscoveryView(
      formula.code,
      premiumDiscoveryEndAfterCancellation(subscription.premiumDiscoveryEndsAt, cancelAtPeriodEnd, at),
      at
    ),
    options: subscription.items.flatMap((item) => {
      const code = text(item.code, 120);
      const quantity = amount(item.quantity);
      const unitPriceCents = amount(item.unitPriceCents);
      if (!code || !quantity || unitPriceCents === null) return [];
      return [{ code, name: text(item.option?.name, 160) ?? code, quantity, unitPriceCents }];
    }),
    usage,
    status: stateStatus(subscription.status),
    alerts,
    history: [],
    management: "TUTELLIV_TEAM",
    cancelAtPeriodEnd,
    canCancel: false,
    canChange: false,
  };
}

type BillingReadDatabase = Pick<typeof prisma, "saasBillingAccount" | "saasSubscription">;

const USAGE_PERIOD_SELECT = {
  orderBy: { startsAt: "desc" },
  take: 1,
  select: {
    startsAt: true,
    endsAt: true,
    includedOrders: true,
    orderCount: true,
    overageCount: true,
  },
} as const;

function activeAt(at: Date) {
  return {
    effectiveFrom: { lte: at },
    OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
  };
}

export async function getSubscriptionView(
  companyId: string,
  db: BillingReadDatabase = prisma,
  at: Date = new Date()
): Promise<SubscriptionView | null> {
  const account = await db.saasBillingAccount.findFirst({
    where: { subscription: { companyId } },
    select: {
      state: true,
      subscription: {
        select: {
          currentPeriodStart: true,
          currentPeriodEnd: true,
          status: true,
          billingInterval: true,
          cancelAtPeriodEnd: true,
          premiumDiscoveryEndsAt: true,
          usagePeriods: USAGE_PERIOD_SELECT,
        },
      },
      operations: {
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, kind: true, status: true, createdAt: true, completedAt: true },
      },
    },
  });
  if (account) return buildSubscriptionView(account as unknown as SubscriptionAccount, at);

  const subscription = await db.saasSubscription.findUnique({
    where: { companyId },
    select: {
      kind: true,
      status: true,
      billingInterval: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      premiumDiscoveryEndsAt: true,
      planAssignments: {
        where: activeAt(at),
        orderBy: { effectiveFrom: "desc" },
        take: 1,
        select: { plan: { select: { code: true, name: true } } },
      },
      items: {
        where: activeAt(at),
        orderBy: { effectiveFrom: "asc" },
        select: { code: true, quantity: true, unitPriceCents: true, option: { select: { name: true } } },
      },
      usagePeriods: USAGE_PERIOD_SELECT,
    },
  });
  return subscription ? buildManagedSubscriptionView(subscription as ManagedSubscription, at) : null;
}
