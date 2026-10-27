import { prisma } from "@/services/prisma/client";
import { SAAS_FEATURE_LABELS } from "@/domains/saas/saas-access";
import { PREMIUM_DISCOVERY_FEATURES } from "@/domains/saas/saas.service";
import type { SubscriptionView } from "./subscription-view.types";

type JsonRecord = Record<string, unknown>;

type SubscriptionAccount = {
  state: unknown;
  subscription: {
    currentPeriodStart: Date;
    currentPeriodEnd: Date | null;
    status: string;
    billingInterval: string | null;
    cancelAtPeriodEnd: boolean;
    premiumDiscoveryEndsAt: Date | null;
    usagePeriods: Array<{
      startsAt: Date;
      endsAt: Date;
      includedOrders: number;
      orderCount: number;
      overageCount: number;
    }>;
  } | null;
  operations: Array<{ id: string; kind: string; status: string; createdAt: Date; completedAt: Date | null }>;
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

function operationLabel(kind: string) {
  return ({
    CHECKOUT: "Paiement d’abonnement préparé",
    CHANGE: "Changement d’abonnement",
    CANCEL: "Résiliation demandée",
    REFUND: "Remboursement traité",
    USAGE: "Dépassement de commandes facturé",
  } as Record<string, string>)[kind] ?? "Opération d’abonnement";
}

function operationStatus(status: string) {
  return ({
    PREPARED: "Préparée",
    DONE: "Terminée",
    REJECTED: "Refusée",
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
    CANCELLED: "Résilié",
  } as Record<string, string>)[status] ?? "État à vérifier";
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

  const currentPeriod = account.subscription.usagePeriods[0] ?? null;
  const usage = currentPeriod
    ? {
        usedOrders: Math.max(0, currentPeriod.orderCount),
        includedOrders: Math.max(0, currentPeriod.includedOrders),
        overageOrders: Math.max(0, currentPeriod.overageCount),
      }
    : null;
  const status = text(state.status, 40) ?? account.subscription.status;
  const discoveryEndsAt = account.subscription.premiumDiscoveryEndsAt;
  const premiumDiscovery =
    (planCode === "STARTER" || planCode === "PRO") &&
    discoveryEndsAt instanceof Date &&
    Number.isFinite(discoveryEndsAt.getTime()) &&
    discoveryEndsAt.getTime() > at.getTime()
      ? {
          endsAt: discoveryEndsAt.toISOString(),
          features: PREMIUM_DISCOVERY_FEATURES.map((code) => ({
            code,
            name: SAAS_FEATURE_LABELS[code],
          })),
        }
      : null;
  const alerts: SubscriptionView["alerts"] = [];
  if (usage && usage.includedOrders > 0) {
    const reached = (threshold: number) => usage.usedOrders * 100 >= usage.includedOrders * threshold;
    if (reached(120)) alerts.push({ code: "USAGE_120", label: "120 % du forfait de commandes atteint" });
    else if (reached(100)) alerts.push({ code: "USAGE_100", label: "Forfait de commandes atteint" });
    else if (reached(80)) alerts.push({ code: "USAGE_80", label: "80 % du forfait de commandes atteint" });
  }
  if (status !== "ACTIVE") alerts.push({ code: `STATUS_${status}`, label: stateStatus(status) });
  if (account.subscription.cancelAtPeriodEnd || state.cancelAtPeriodEnd === true) {
    alerts.push({ code: "CANCEL_AT_PERIOD_END", label: "Résiliation prévue à la fin de période" });
  }
  if (record(state.pendingChange)) alerts.push({ code: "PENDING_CHANGE", label: "Changement d’abonnement en attente" });

  const invoices = Array.isArray(state.invoices) ? state.invoices : [];
  const history = [
    ...account.operations.flatMap((operation) => {
      const occurredAt = operation.completedAt ?? operation.createdAt;
      return Number.isNaN(occurredAt.getTime()) ? [] : [{
        type: "operation" as const,
        label: operationLabel(operation.kind),
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
  };
}

type BillingReadDatabase = Pick<typeof prisma, "saasBillingAccount">;

export async function getSubscriptionView(
  companyId: string,
  db: BillingReadDatabase = prisma
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
          usagePeriods: {
            orderBy: { startsAt: "desc" },
            take: 1,
            select: {
              startsAt: true,
              endsAt: true,
              includedOrders: true,
              orderCount: true,
              overageCount: true,
            },
          },
        },
      },
      operations: {
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, kind: true, status: true, createdAt: true, completedAt: true },
      },
    },
  });
  return account ? buildSubscriptionView(account as unknown as SubscriptionAccount) : null;
}
