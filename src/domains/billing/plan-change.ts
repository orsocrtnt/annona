import type { SaasPlanCode, SaasSubscriptionItemKind } from "@prisma/client";

/**
 * SAAS-03 — évaluation d'un changement de formule, sans effet ni facturation.
 * Règles C7 : montée immédiate après paiement du prorata, diminution au renouvellement,
 * dépassement mensuel de commandes non bloquant. Le traitement d'une diminution bloquée
 * (refus ou planification) et le remplacement d'une option incompatible restent des
 * décisions produit : cette fonction ne fait que les décrire.
 */
const PLAN_RANK: Record<SaasPlanCode, number> = { STARTER: 1, PRO: 2, BUSINESS: 3 };

const SEAT_KIND: Partial<Record<SaasSubscriptionItemKind, SeatResource>> = {
  DRIVER_SEAT: "drivers",
  ADMIN_SEAT: "admins",
  DISPATCHER_SEAT: "dispatchers",
};

export type SeatResource = "drivers" | "admins" | "dispatchers";

export type PlanChangeTarget = {
  code: SaasPlanCode;
  includedDriverSeats: number;
  unlimitedDriverSeats: boolean;
  maxDriverSeats: number | null;
  includedAdminSeats: number;
  maxAdminSeats: number | null;
  includedDispatcherSeats: number;
  maxDispatcherSeats: number | null;
  includedMonthlyOrders: number;
  includedFeatures: string[];
};

export type PlanChangeItem = {
  code: string;
  kind: SaasSubscriptionItemKind;
  quantity: number;
  featureKey: string | null;
  /** Comme partout dans le catalogue : une option ne vaut que pour les formules listées. */
  applicablePlans: readonly SaasPlanCode[];
};

export type PlanChangeInput = {
  currentPlanCode: SaasPlanCode;
  /** Fonctions incluses dans la formule actuelle (hors découverte premium). */
  currentPlanFeatures: string[];
  /** Options et sièges actuellement souscrits. */
  items: PlanChangeItem[];
  /** Comptes ACTIVE ou PENDING_VERIFICATION par rôle facturé, et commandes de la période. */
  usage: Record<SeatResource, number> & { monthlyOrders: number };
  target: PlanChangeTarget;
};

export type PlanChangeAssessment = {
  direction: "UPGRADE" | "DOWNGRADE" | "SAME";
  timing: "IMMEDIATE_AFTER_PRORATA" | "AT_RENEWAL" | "NONE";
  limits: Record<SeatResource, number | null>;
  blockers: Array<{ resource: SeatResource; current: number; limit: number; excess: number }>;
  droppedItems: Array<{ code: string; kind: SaasSubscriptionItemKind; quantity: number }>;
  orderOverage: { current: number; included: number; overage: number } | null;
  lostFeatures: string[];
  allowed: boolean;
};

function seatLimit(included: number, extras: number, maximum: number | null) {
  const purchased = included + extras;
  return maximum == null ? purchased : Math.min(maximum, purchased);
}

export function assessPlanChange(input: PlanChangeInput): PlanChangeAssessment {
  const { target, usage } = input;
  const rankDelta = PLAN_RANK[target.code] - PLAN_RANK[input.currentPlanCode];
  const direction = rankDelta > 0 ? "UPGRADE" : rankDelta < 0 ? "DOWNGRADE" : "SAME";

  const keptItems = input.items.filter((item) => item.applicablePlans.includes(target.code));
  const droppedItems = input.items
    .filter((item) => !item.applicablePlans.includes(target.code))
    .map(({ code, kind, quantity }) => ({ code, kind, quantity }));

  const extras: Record<SeatResource, number> = { drivers: 0, admins: 0, dispatchers: 0 };
  for (const item of keptItems) {
    const resource = SEAT_KIND[item.kind];
    if (resource) extras[resource] += item.quantity;
  }

  const limits: Record<SeatResource, number | null> = {
    drivers: target.unlimitedDriverSeats
      ? null
      : seatLimit(target.includedDriverSeats, extras.drivers, target.maxDriverSeats),
    admins: seatLimit(target.includedAdminSeats, extras.admins, target.maxAdminSeats),
    dispatchers: seatLimit(target.includedDispatcherSeats, extras.dispatchers, target.maxDispatcherSeats),
  };

  const blockers = (["drivers", "admins", "dispatchers"] as const).flatMap((resource) => {
    const limit = limits[resource];
    const current = usage[resource];
    return limit != null && current > limit
      ? [{ resource, current, limit, excess: current - limit }]
      : [];
  });

  const orderOverage = usage.monthlyOrders > target.includedMonthlyOrders
    ? {
        current: usage.monthlyOrders,
        included: target.includedMonthlyOrders,
        overage: usage.monthlyOrders - target.includedMonthlyOrders,
      }
    : null;

  const featureKeys = (items: PlanChangeItem[]) =>
    items.flatMap((item) => (item.featureKey ? [item.featureKey] : []));
  const before = new Set([...input.currentPlanFeatures, ...featureKeys(input.items)]);
  const after = new Set([...target.includedFeatures, ...featureKeys(keptItems)]);
  const lostFeatures = [...before].filter((feature) => !after.has(feature)).sort();

  return {
    direction,
    timing: direction === "UPGRADE" ? "IMMEDIATE_AFTER_PRORATA" : direction === "DOWNGRADE" ? "AT_RENEWAL" : "NONE",
    limits,
    blockers,
    droppedItems,
    orderOverage,
    lostFeatures,
    allowed: direction !== "SAME" && blockers.length === 0,
  };
}
