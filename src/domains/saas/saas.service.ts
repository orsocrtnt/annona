import { Prisma, type SaasPlanCode, type SystemRole } from "@prisma/client";
import { prisma } from "@/services/prisma/client";

export const SAAS_FEATURES = [
  "auto_dispatch",
  "admin_gps",
  "client_gps",
  "advanced_analytics",
  "priority_support",
] as const;

export type SaasFeature = (typeof SAAS_FEATURES)[number];

export const PREMIUM_DISCOVERY_DAYS = 60;
export const PREMIUM_DISCOVERY_FEATURES = [
  "auto_dispatch",
  "admin_gps",
  "client_gps",
  "advanced_analytics",
] as const satisfies readonly SaasFeature[];

export function premiumDiscoveryEndsAtForPaidSignup(input: {
  startsAt: Date;
  planCode: SaasPlanCode;
  paymentAdapter: string | null;
}) {
  if (!Number.isFinite(input.startsAt.getTime())) {
    throw new Error("SAAS_DISCOVERY_START_INVALID");
  }
  // Décision C10 : impayé et changement de formule pendant la découverte sont tranchés ;
  // la souscription confirmée par Stripe sandbox ouvre donc la même découverte.
  if (!PAID_DISCOVERY_ADAPTERS.has(input.paymentAdapter ?? "") || !["STARTER", "PRO"].includes(input.planCode)) {
    return null;
  }
  return new Date(input.startsAt.getTime() + PREMIUM_DISCOVERY_DAYS * 86_400_000);
}

const PAID_DISCOVERY_ADAPTERS = new Set(["fake", "stripe-sandbox"]);

/**
 * Décision C10 : la découverte s'arrête définitivement au premier échec de paiement.
 * Renvoie la fin à enregistrer, sans jamais prolonger ni rouvrir une découverte.
 */
export function premiumDiscoveryEndAfterPaymentFailure(
  discoveryEndsAt: Date | null,
  failedAt: string | null
): Date | null {
  if (!discoveryEndsAt || !failedAt) return discoveryEndsAt;
  const failure = Date.parse(failedAt);
  if (!Number.isFinite(failure) || failure >= discoveryEndsAt.getTime()) return discoveryEndsAt;
  return new Date(failure);
}

/**
 * Décision C10 (complément) : une résiliation demandée pendant la découverte la termine
 * immédiatement, même si la période payée continue. Ne prolonge ni ne rouvre jamais.
 */
export function premiumDiscoveryEndAfterCancellation(
  discoveryEndsAt: Date | null,
  cancelRequested: boolean,
  at: Date
): Date | null {
  if (!discoveryEndsAt || !cancelRequested || at.getTime() >= discoveryEndsAt.getTime()) return discoveryEndsAt;
  return new Date(at.getTime());
}

type DbClient = Prisma.TransactionClient | typeof prisma;

type PlanSnapshot = {
  schemaVersion: 1;
  planCode: SaasPlanCode;
  planName: string;
  includedDriverSeats: number;
  unlimitedDriverSeats: boolean;
  maxDriverSeats: number | null;
  includedAdminSeats: number;
  maxAdminSeats: number | null;
  includedDispatcherSeats: number;
  maxDispatcherSeats: number | null;
  includedMonthlyOrders: number;
  orderOverageUnitPriceCents: number;
  features: string[];
};

type PilotSnapshot = {
  schemaVersion: 1;
  mode: "PILOT";
  limits: {
    drivers: number | null;
    admins: number | null;
    dispatchers: number | null;
    monthlyOrders: number;
  };
  orderOverageUnitPriceCents: number;
  features: string[];
};

export type ResolvedSaasAccess = {
  subscriptionId: string;
  kind: "COMMERCIAL" | "PILOT" | "LEGACY";
  status:
    | "PENDING_PAYMENT"
    | "ACTIVE"
    | "PAST_DUE"
    | "RESTRICTED"
    | "READ_ONLY"
    | "CANCEL_AT_PERIOD_END"
    | "CANCELLED"
    | "EXPIRED";
  planCode: SaasPlanCode | null;
  features: Set<string>;
  limits: {
    drivers: number | null;
    admins: number | null;
    dispatchers: number | null;
    monthlyOrders: number;
  };
  maxSeats: {
    drivers: number | null;
    admins: number | null;
    dispatchers: number | null;
  };
  orderOverageUnitPriceCents: number;
  premiumDiscovery: {
    endsAt: Date;
    features: Set<SaasFeature>;
  } | null;
  canCreateOrders: boolean;
  canMutate: boolean;
};

export type ManualCommercialSubscriptionInput = {
  companyId: string;
  planCode: SaasPlanCode;
  billingInterval: "MONTHLY" | "ANNUAL";
  startsAt: Date;
  currentPeriodEnd: Date;
};

export type ManualPilotInput = {
  companyId: string;
  startsAt: Date;
  endsAt: Date;
  limits: PilotSnapshot["limits"];
  features?: string[];
};

export type ManualSubscriptionItemInput = {
  companyId: string;
  optionCode: string;
  quantity: number;
  effectiveFrom: Date;
  source?: "INITIAL" | "ADDED_LATER";
};

function record(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nonNegative(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function planSnapshotFromJson(value: Prisma.JsonValue): PlanSnapshot {
  const source = record(value);
  const planCode = source.planCode;
  if (!(["STARTER", "PRO", "BUSINESS"] as const).includes(planCode as SaasPlanCode)) {
    throw new Error("SAAS_PLAN_SNAPSHOT_INVALID");
  }
  return {
    schemaVersion: 1,
    planCode: planCode as SaasPlanCode,
    planName: typeof source.planName === "string" ? source.planName : String(planCode),
    includedDriverSeats: nonNegative(source.includedDriverSeats, 0),
    unlimitedDriverSeats: source.unlimitedDriverSeats === true,
    maxDriverSeats: numberOrNull(source.maxDriverSeats),
    includedAdminSeats: nonNegative(source.includedAdminSeats, 0),
    maxAdminSeats: numberOrNull(source.maxAdminSeats),
    includedDispatcherSeats: nonNegative(source.includedDispatcherSeats, 0),
    maxDispatcherSeats: numberOrNull(source.maxDispatcherSeats),
    includedMonthlyOrders: nonNegative(source.includedMonthlyOrders, 0),
    orderOverageUnitPriceCents: nonNegative(source.orderOverageUnitPriceCents, 0),
    features: stringArray(source.features),
  };
}

function pilotSnapshotFromJson(value: Prisma.JsonValue): PilotSnapshot {
  const source = record(value);
  const limits = record(source.limits as Prisma.JsonValue);
  if (source.mode !== "PILOT") throw new Error("SAAS_PILOT_SNAPSHOT_INVALID");
  return {
    schemaVersion: 1,
    mode: "PILOT",
    limits: {
      drivers: numberOrNull(limits.drivers),
      admins: numberOrNull(limits.admins),
      dispatchers: numberOrNull(limits.dispatchers),
      monthlyOrders: nonNegative(limits.monthlyOrders, 0),
    },
    orderOverageUnitPriceCents: nonNegative(source.orderOverageUnitPriceCents, 0),
    features: stringArray(source.features),
  };
}

function capSeats(included: number, extras: number, maximum: number | null) {
  const purchased = included + extras;
  return maximum == null ? purchased : Math.min(maximum, purchased);
}

export function utcMonthBounds(at = new Date()) {
  const startsAt = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  const endsAt = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
  return { startsAt, endsAt };
}

export function snapshotPlan(plan: {
  code: SaasPlanCode;
  name: string;
  includedDriverSeats: number;
  unlimitedDriverSeats: boolean;
  maxDriverSeats: number | null;
  includedAdminSeats: number;
  maxAdminSeats: number | null;
  includedDispatcherSeats: number;
  maxDispatcherSeats: number | null;
  includedMonthlyOrders: number;
  orderOverageUnitPriceCents: number;
  includedFeatures: string[];
}): PlanSnapshot {
  return {
    schemaVersion: 1,
    planCode: plan.code,
    planName: plan.name,
    includedDriverSeats: plan.includedDriverSeats,
    unlimitedDriverSeats: plan.unlimitedDriverSeats,
    maxDriverSeats: plan.maxDriverSeats,
    includedAdminSeats: plan.includedAdminSeats,
    maxAdminSeats: plan.maxAdminSeats,
    includedDispatcherSeats: plan.includedDispatcherSeats,
    maxDispatcherSeats: plan.maxDispatcherSeats,
    includedMonthlyOrders: plan.includedMonthlyOrders,
    orderOverageUnitPriceCents: plan.orderOverageUnitPriceCents,
    features: plan.includedFeatures,
  };
}

export async function resolveCompanySaasAccess(
  companyId: string,
  at = new Date(),
  db: DbClient = prisma
): Promise<ResolvedSaasAccess> {
  const subscription = await db.saasSubscription.findUnique({
    where: { companyId },
    include: {
      planAssignments: {
        where: {
          effectiveFrom: { lte: at },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
        },
        orderBy: { effectiveFrom: "desc" },
        take: 1,
      },
      items: {
        where: {
          effectiveFrom: { lte: at },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
        },
        include: { option: true },
      },
    },
  });
  if (!subscription) throw new Error("SAAS_SUBSCRIPTION_REQUIRED");

  const periodEnded = Boolean(
    subscription.currentPeriodEnd && subscription.currentPeriodEnd.getTime() <= at.getTime()
  );
  const billingSnapshot = subscription.snapshot && typeof subscription.snapshot === "object" && !Array.isArray(subscription.snapshot) ? subscription.snapshot : {};
  const failedAt = typeof billingSnapshot.billingFailedAt === "string" ? Date.parse(billingSnapshot.billingFailedAt) : NaN;
  const overdueDays = (at.getTime() - failedAt) / 86_400_000;
  const commercialStatus = subscription.kind === "COMMERCIAL" && Number.isFinite(failedAt) && subscription.status !== "CANCELLED"
    ? overdueDays >= 30 ? "READ_ONLY" : overdueDays >= 14 ? "RESTRICTED" : "PAST_DUE"
    : subscription.status;
  const status = subscription.kind === "PILOT" && periodEnded
    ? "EXPIRED"
    : subscription.cancelAtPeriodEnd && periodEnded
      ? "CANCELLED"
      : commercialStatus;
  const canMutate = !["PENDING_PAYMENT", "READ_ONLY", "CANCELLED", "EXPIRED"].includes(status);
  const canCreateOrders = canMutate && status !== "RESTRICTED";

  if (subscription.kind === "LEGACY") {
    return {
      subscriptionId: subscription.id,
      kind: subscription.kind,
      status,
      planCode: null,
      features: new Set(SAAS_FEATURES),
      limits: { drivers: null, admins: null, dispatchers: null, monthlyOrders: 2_147_483_647 },
      maxSeats: { drivers: null, admins: null, dispatchers: null },
      orderOverageUnitPriceCents: 0,
      premiumDiscovery: null,
      canCreateOrders,
      canMutate,
    };
  }

  if (subscription.kind === "PILOT") {
    const snapshot = pilotSnapshotFromJson(subscription.snapshot);
    return {
      subscriptionId: subscription.id,
      kind: subscription.kind,
      status,
      planCode: null,
      features: new Set(snapshot.features),
      limits: snapshot.limits,
      maxSeats: {
        drivers: snapshot.limits.drivers,
        admins: snapshot.limits.admins,
        dispatchers: snapshot.limits.dispatchers,
      },
      orderOverageUnitPriceCents: snapshot.orderOverageUnitPriceCents,
      premiumDiscovery: null,
      canCreateOrders,
      canMutate,
    };
  }

  const assignment = subscription.planAssignments[0];
  if (!assignment) throw new Error("SAAS_PLAN_ASSIGNMENT_REQUIRED");
  const plan = planSnapshotFromJson(assignment.snapshot);
  const features = new Set(plan.features);
  // Un échec de paiement ou une résiliation demandée met fin à la découverte.
  const discoveryEndsAt = premiumDiscoveryEndAfterCancellation(
    premiumDiscoveryEndAfterPaymentFailure(
      subscription.premiumDiscoveryEndsAt,
      Number.isFinite(failedAt) ? new Date(failedAt).toISOString() : null
    ),
    subscription.cancelAtPeriodEnd,
    at
  );
  const discoveryActive =
    (plan.planCode === "STARTER" || plan.planCode === "PRO") &&
    discoveryEndsAt instanceof Date &&
    discoveryEndsAt.getTime() > at.getTime();
  const discoveryFeatures = new Set<SaasFeature>();
  if (discoveryActive) {
    for (const feature of PREMIUM_DISCOVERY_FEATURES) {
      features.add(feature);
      discoveryFeatures.add(feature);
    }
  }
  let driverExtras = 0;
  let adminExtras = 0;
  let dispatcherExtras = 0;

  for (const item of subscription.items) {
    if (item.option?.featureKey) features.add(item.option.featureKey);
    if (item.kind === "DRIVER_SEAT") driverExtras += item.quantity;
    if (item.kind === "ADMIN_SEAT") adminExtras += item.quantity;
    if (item.kind === "DISPATCHER_SEAT") dispatcherExtras += item.quantity;
  }

  return {
    subscriptionId: subscription.id,
    kind: subscription.kind,
    status,
    planCode: plan.planCode,
    features,
    limits: {
      drivers: plan.unlimitedDriverSeats
        ? null
        : capSeats(plan.includedDriverSeats, driverExtras, plan.maxDriverSeats),
      admins: capSeats(plan.includedAdminSeats, adminExtras, plan.maxAdminSeats),
      dispatchers: capSeats(
        plan.includedDispatcherSeats,
        dispatcherExtras,
        plan.maxDispatcherSeats
      ),
      monthlyOrders: plan.includedMonthlyOrders,
    },
    maxSeats: {
      drivers: plan.unlimitedDriverSeats ? null : plan.maxDriverSeats,
      admins: plan.maxAdminSeats,
      dispatchers: plan.maxDispatcherSeats,
    },
    orderOverageUnitPriceCents: plan.orderOverageUnitPriceCents,
    premiumDiscovery: discoveryActive
      ? { endsAt: discoveryEndsAt, features: discoveryFeatures }
      : null,
    canCreateOrders,
    canMutate,
  };
}

export async function activateManualCommercialSubscription(
  input: ManualCommercialSubscriptionInput
) {
  if (input.currentPeriodEnd <= input.startsAt) throw new Error("SAAS_PERIOD_INVALID");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "companies" WHERE id = ${input.companyId} FOR UPDATE`;
    const catalog = await tx.saasCatalogVersion.findFirst({
      where: { status: "ACTIVE", effectiveAt: { lte: input.startsAt } },
      orderBy: { effectiveAt: "desc" },
      include: { plans: { where: { code: input.planCode }, take: 1 } },
    });
    const plan = catalog?.plans[0];
    if (!catalog || !plan) throw new Error("SAAS_CATALOG_PLAN_NOT_FOUND");

    const subscription = await tx.saasSubscription.upsert({
      where: { companyId: input.companyId },
      update: {
        catalogVersionId: catalog.id,
        kind: "COMMERCIAL",
        status: "ACTIVE",
        billingInterval: input.billingInterval,
        startsAt: input.startsAt,
        currentPeriodStart: input.startsAt,
        currentPeriodEnd: input.currentPeriodEnd,
        cancelAtPeriodEnd: false,
        endedAt: null,
        premiumDiscoveryEndsAt: null,
        snapshot: {
          schemaVersion: 1,
          catalogCode: catalog.code,
          currency: catalog.currency,
          vatRateBps: catalog.vatRateBps,
        },
      },
      create: {
        companyId: input.companyId,
        catalogVersionId: catalog.id,
        kind: "COMMERCIAL",
        status: "ACTIVE",
        billingInterval: input.billingInterval,
        startsAt: input.startsAt,
        currentPeriodStart: input.startsAt,
        currentPeriodEnd: input.currentPeriodEnd,
        premiumDiscoveryEndsAt: null,
        snapshot: {
          schemaVersion: 1,
          catalogCode: catalog.code,
          currency: catalog.currency,
          vatRateBps: catalog.vatRateBps,
        },
      },
    });

    const currentAssignment = await tx.saasPlanAssignment.findFirst({
      where: { subscriptionId: subscription.id, effectiveTo: null },
      orderBy: { effectiveFrom: "desc" },
    });
    if (currentAssignment && currentAssignment.effectiveFrom > input.startsAt) {
      throw new Error("SAAS_PLAN_CHANGE_OUT_OF_ORDER");
    }
    if (currentAssignment?.effectiveFrom.getTime() === input.startsAt.getTime()) {
      await tx.saasPlanAssignment.update({
        where: { id: currentAssignment.id },
        data: { planId: plan.id, snapshot: snapshotPlan(plan) },
      });
      return subscription;
    }
    if (currentAssignment) {
      await tx.saasPlanAssignment.update({
        where: { id: currentAssignment.id },
        data: { effectiveTo: input.startsAt },
      });
    }
    await tx.saasPlanAssignment.create({
      data: {
        subscriptionId: subscription.id,
        planId: plan.id,
        effectiveFrom: input.startsAt,
        snapshot: snapshotPlan(plan),
      },
    });
    return subscription;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function activateManualPilot(input: ManualPilotInput) {
  if (input.endsAt <= input.startsAt) throw new Error("SAAS_PERIOD_INVALID");
  const snapshot: PilotSnapshot = {
    schemaVersion: 1,
    mode: "PILOT",
    limits: input.limits,
    orderOverageUnitPriceCents: 0,
    features: input.features ?? [...SAAS_FEATURES],
  };
  return prisma.saasSubscription.upsert({
    where: { companyId: input.companyId },
    update: {
      catalogVersionId: null,
      kind: "PILOT",
      status: "ACTIVE",
      billingInterval: null,
      startsAt: input.startsAt,
      currentPeriodStart: input.startsAt,
      currentPeriodEnd: input.endsAt,
      cancelAtPeriodEnd: false,
      endedAt: null,
      premiumDiscoveryEndsAt: null,
      snapshot,
    },
    create: {
      companyId: input.companyId,
      kind: "PILOT",
      status: "ACTIVE",
      startsAt: input.startsAt,
      currentPeriodStart: input.startsAt,
      currentPeriodEnd: input.endsAt,
      premiumDiscoveryEndsAt: null,
      snapshot,
    },
  });
}

export async function activateManualSubscriptionItem(input: ManualSubscriptionItemInput) {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new Error("SAAS_ITEM_QUANTITY_INVALID");
  }

  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "saas_subscriptions" WHERE "company_id" = ${input.companyId} FOR UPDATE
    `;
    if (!locked[0]) throw new Error("SAAS_SUBSCRIPTION_REQUIRED");

    const subscription = await tx.saasSubscription.findUnique({
      where: { companyId: input.companyId },
      include: {
        planAssignments: {
          where: {
            effectiveFrom: { lte: input.effectiveFrom },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveFrom } }],
          },
          orderBy: { effectiveFrom: "desc" },
          take: 1,
        },
      },
    });
    if (!subscription || subscription.kind !== "COMMERCIAL" || !subscription.catalogVersionId) {
      throw new Error("SAAS_COMMERCIAL_SUBSCRIPTION_REQUIRED");
    }
    if (!["ACTIVE", "PAST_DUE", "CANCEL_AT_PERIOD_END"].includes(subscription.status)) {
      throw new Error("SAAS_ACCOUNT_READ_ONLY");
    }

    const assignment = subscription.planAssignments[0];
    if (!assignment) throw new Error("SAAS_PLAN_ASSIGNMENT_REQUIRED");
    const plan = planSnapshotFromJson(assignment.snapshot);
    const option = await tx.saasOption.findFirst({
      where: {
        catalogVersionId: subscription.catalogVersionId,
        code: input.optionCode,
      },
    });
    if (!option || !option.applicablePlans.includes(plan.planCode)) {
      throw new Error("SAAS_OPTION_NOT_AVAILABLE");
    }
    if (option.featureKey && plan.features.includes(option.featureKey)) {
      throw new Error("SAAS_FEATURE_ALREADY_INCLUDED");
    }
    if (option.kind === "OPTION" && input.quantity !== 1) {
      throw new Error("SAAS_ITEM_QUANTITY_INVALID");
    }

    const activeItems = await tx.saasSubscriptionItem.findMany({
      where: {
        subscriptionId: subscription.id,
        effectiveFrom: { lte: input.effectiveFrom },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.effectiveFrom } }],
      },
    });
    const replacing = await tx.saasSubscriptionItem.findFirst({
      where: { subscriptionId: subscription.id, code: option.code, effectiveTo: null },
    });
    if (replacing && replacing.effectiveFrom > input.effectiveFrom) {
      throw new Error("SAAS_ITEM_CHANGE_OUT_OF_ORDER");
    }
    const otherQuantity = activeItems
      .filter((item) => item.kind === option.kind && item.code !== option.code)
      .reduce((sum, item) => sum + item.quantity, 0);
    const requestedExtras = otherQuantity + input.quantity;
    if (
      option.kind === "DRIVER_SEAT" &&
      !plan.unlimitedDriverSeats &&
      plan.maxDriverSeats != null &&
      plan.includedDriverSeats + requestedExtras > plan.maxDriverSeats
    ) {
      throw new Error("SAAS_DRIVERS_LIMIT_REACHED");
    }
    if (
      option.kind === "ADMIN_SEAT" &&
      plan.maxAdminSeats != null &&
      plan.includedAdminSeats + requestedExtras > plan.maxAdminSeats
    ) {
      throw new Error("SAAS_ADMINS_LIMIT_REACHED");
    }
    if (
      option.kind === "DISPATCHER_SEAT" &&
      plan.maxDispatcherSeats != null &&
      plan.includedDispatcherSeats + requestedExtras > plan.maxDispatcherSeats
    ) {
      throw new Error("SAAS_DISPATCHERS_LIMIT_REACHED");
    }

    const unitPriceCents = subscription.billingInterval === "ANNUAL"
      ? option.annualPriceCents
      : option.monthlyPriceCents;
    const snapshot = {
      schemaVersion: 1,
      optionCode: option.code,
      optionName: option.name,
      featureKey: option.featureKey,
      seatRole: option.seatRole,
      billingInterval: subscription.billingInterval,
      unitPriceCents,
    };
    if (replacing) {
      if (replacing.effectiveFrom.getTime() === input.effectiveFrom.getTime()) {
        return tx.saasSubscriptionItem.update({
          where: { id: replacing.id },
          data: { quantity: input.quantity, unitPriceCents, snapshot },
        });
      }
      await tx.saasSubscriptionItem.update({
        where: { id: replacing.id },
        data: { effectiveTo: input.effectiveFrom },
      });
    }
    return tx.saasSubscriptionItem.create({
      data: {
        subscriptionId: subscription.id,
        optionId: option.id,
        code: option.code,
        kind: option.kind,
        source: input.source ?? "ADDED_LATER",
        quantity: input.quantity,
        unitPriceCents,
        effectiveFrom: input.effectiveFrom,
        snapshot,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

function meteredRole(role: SystemRole) {
  if (role === "DRIVER") return { key: "drivers" as const, roles: ["DRIVER"] as SystemRole[] };
  if (role === "COMPANY_ADMIN") {
    return { key: "admins" as const, roles: ["COMPANY_ADMIN"] as SystemRole[] };
  }
  if (role === "DISPATCHER" || role === "MINI_ADMIN") {
    return {
      key: "dispatchers" as const,
      roles: ["DISPATCHER", "MINI_ADMIN"] as SystemRole[],
    };
  }
  return null;
}

export function assertSeatAvailable(
  currentSeats: number,
  reservedSeats: number,
  limit: number | null,
  key: "drivers" | "admins" | "dispatchers"
) {
  if (limit != null && currentSeats + reservedSeats >= limit) {
    throw new Error(`SAAS_${key.toUpperCase()}_LIMIT_REACHED`);
  }
}

export async function reserveSaasSeat(
  companyId: string,
  role: SystemRole,
  reservationKey: string,
  ttlMs = 10 * 60 * 1000
) {
  const metered = meteredRole(role);
  if (!metered) return null;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "saas_subscriptions" WHERE "company_id" = ${companyId} FOR UPDATE
    `;
    if (!locked[0]) throw new Error("SAAS_SUBSCRIPTION_REQUIRED");
    await tx.saasSeatReservation.deleteMany({ where: { companyId, expiresAt: { lte: now } } });
    const access = await resolveCompanySaasAccess(companyId, now, tx);
    if (!access.canMutate) throw new Error("SAAS_ACCOUNT_READ_ONLY");
    const limit = access.limits[metered.key];
    if (limit == null) return null;

    const [users, reservations] = await Promise.all([
      tx.user.count({
        where: {
          companyId,
          status: { in: ["ACTIVE", "PENDING_VERIFICATION"] },
          role: { systemRole: { in: metered.roles } },
        },
      }),
      tx.saasSeatReservation.count({
        where: { companyId, role: { in: metered.roles }, expiresAt: { gt: now } },
      }),
    ]);
    assertSeatAvailable(users, reservations, limit, metered.key);
    await tx.saasSeatReservation.create({
      data: {
        reservationKey,
        companyId,
        subscriptionId: access.subscriptionId,
        role,
        expiresAt,
      },
    });
    return reservationKey;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function releaseSaasSeat(reservationKey: string | null | undefined, db: DbClient = prisma) {
  if (!reservationKey) return;
  await db.saasSeatReservation.deleteMany({ where: { reservationKey } });
}

export async function assertCanCreateOrder(companyId: string, db: DbClient = prisma) {
  const access = await resolveCompanySaasAccess(companyId, new Date(), db);
  if (!access.canCreateOrders) throw new Error("SAAS_ORDER_CREATION_BLOCKED");
  return access;
}

export async function assertSaasFeature(
  companyId: string,
  feature: SaasFeature,
  db: DbClient = prisma
) {
  const access = await resolveCompanySaasAccess(companyId, new Date(), db);
  if (!access.features.has(feature)) throw new Error("SAAS_FEATURE_NOT_AVAILABLE");
  return access;
}

export async function assertSaasMutationFeature(
  companyId: string,
  feature: SaasFeature,
  db: DbClient = prisma
) {
  const access = await assertSaasFeature(companyId, feature, db);
  if (!access.canMutate) throw new Error("SAAS_ACCOUNT_READ_ONLY");
  return access;
}

export function orderUsageAlertPercent(orderCount: number, includedOrders: number) {
  if (includedOrders <= 0) return 120;
  const percent = (orderCount / includedOrders) * 100;
  if (percent >= 120) return 120;
  if (percent >= 100) return 100;
  if (percent >= 80) return 80;
  return null;
}

export async function recordOrderCreatedUsage(
  db: DbClient,
  input: { companyId: string; orderId: string; occurredAt?: Date }
) {
  const occurredAt = input.occurredAt ?? new Date();
  const access = await resolveCompanySaasAccess(input.companyId, occurredAt, db);
  const eventKey = `order-created:${input.orderId}`;
  const existing = await db.saasUsageEvent.findUnique({ where: { eventKey } });
  if (existing) return existing;
  const { startsAt, endsAt } = utcMonthBounds(occurredAt);
  const period = await db.saasUsagePeriod.upsert({
    where: { subscriptionId_startsAt: { subscriptionId: access.subscriptionId, startsAt } },
    update: {},
    create: {
      subscriptionId: access.subscriptionId,
      companyId: input.companyId,
      startsAt,
      endsAt,
      includedOrders: access.limits.monthlyOrders,
      orderOverageUnitPriceCents: access.orderOverageUnitPriceCents,
    },
  });
  const event = await db.saasUsageEvent.create({
    data: {
      eventKey,
      kind: "ORDER_CREATED",
      companyId: input.companyId,
      subscriptionId: access.subscriptionId,
      usagePeriodId: period.id,
      orderId: input.orderId,
      createdAt: occurredAt,
    },
  });
  const updated = await db.$executeRaw`
    UPDATE "saas_usage_periods"
    SET
      "order_count" = "order_count" + 1,
      "overage_count" = GREATEST(("order_count" + 1) - "included_orders", 0),
      "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = ${period.id} AND "closed_at" IS NULL
  `;
  if (updated !== 1) throw new Error("SAAS_USAGE_PERIOD_CLOSED");
  return event;
}
