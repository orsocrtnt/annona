import type { SaasPlanCode, SaasSubscriptionItemKind, SystemRole } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { resolveCompanySaasAccess } from "@/domains/saas/saas.service";
import {
  SESSION_SAAS_FEATURES,
  buildSessionSeatMeter,
  unlockedSessionSaasAccess,
  type SessionSaasAccess,
  type SessionSaasSeatMeter,
} from "@/domains/saas/saas-access";

function extraPrice(
  options: Array<{ kind: SaasSubscriptionItemKind; monthlyPriceCents: number; applicablePlans: SaasPlanCode[] }>,
  kind: SaasSubscriptionItemKind,
  planCode: SaasPlanCode | null
) {
  if (!planCode) return null;
  const option = options.find((item) => item.kind === kind && item.applicablePlans.includes(planCode));
  return option?.monthlyPriceCents ?? null;
}

function countRoles(roles: SystemRole[], target: SystemRole[]) {
  return roles.filter((role) => target.includes(role)).length;
}

async function companySeatMeters(
  companyId: string,
  access: Awaited<ReturnType<typeof resolveCompanySaasAccess>>
): Promise<SessionSaasAccess["seats"]> {
  const now = new Date();
  const [users, reservations, subscription] = await Promise.all([
    prisma.user.findMany({
      where: { companyId, status: { in: ["ACTIVE", "PENDING_VERIFICATION"] } },
      select: { role: { select: { systemRole: true } } },
    }),
    prisma.saasSeatReservation.findMany({
      where: { companyId, expiresAt: { gt: now } },
      select: { role: true },
    }),
    prisma.saasSubscription.findUnique({
      where: { companyId },
      select: {
        catalogVersion: {
          select: {
            options: {
              where: { kind: { in: ["DRIVER_SEAT", "ADMIN_SEAT", "DISPATCHER_SEAT"] } },
              select: { kind: true, monthlyPriceCents: true, applicablePlans: true },
            },
          },
        },
      },
    }),
  ]);
  const roles = [
    ...users.map((user) => user.role.systemRole),
    ...reservations.map((reservation) => reservation.role),
  ];
  const options = subscription?.catalogVersion?.options ?? [];
  const meter = (
    key: "drivers" | "admins" | "dispatchers",
    used: number,
    kind: SaasSubscriptionItemKind
  ): SessionSaasSeatMeter =>
    buildSessionSeatMeter({
      used,
      limit: access.limits[key],
      hardMax: access.maxSeats[key],
      extraMonthlyPriceCents: extraPrice(options, kind, access.planCode),
    });

  return {
    drivers: meter("drivers", countRoles(roles, ["DRIVER"]), "DRIVER_SEAT"),
    admins: meter("admins", countRoles(roles, ["COMPANY_ADMIN"]), "ADMIN_SEAT"),
    dispatchers: meter("dispatchers", countRoles(roles, ["DISPATCHER", "MINI_ADMIN"]), "DISPATCHER_SEAT"),
  };
}

export async function getSessionSaasAccess(
  companyId: string | null | undefined
): Promise<SessionSaasAccess | null> {
  if (!companyId) return null;
  try {
    const access = await resolveCompanySaasAccess(companyId);
    return {
      kind: access.kind,
      planCode: access.planCode,
      features: SESSION_SAAS_FEATURES.filter((feature) => access.features.has(feature)),
      limits: access.limits,
      seats: await companySeatMeters(companyId, access),
      canCreateOrders: access.canCreateOrders,
      canMutate: access.canMutate,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "SAAS_SUBSCRIPTION_REQUIRED" ||
        error.message === "SAAS_PLAN_ASSIGNMENT_REQUIRED" ||
        error.message === "SAAS_PLAN_SNAPSHOT_INVALID" ||
        error.message === "SAAS_PILOT_SNAPSHOT_INVALID")
    ) {
      return unlockedSessionSaasAccess();
    }
    console.error("SAAS session access failed:", error);
    return unlockedSessionSaasAccess();
  }
}
