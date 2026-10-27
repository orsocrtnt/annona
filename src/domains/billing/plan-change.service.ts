import type { Prisma, SystemRole } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { assessPlanChange, type PlanChangeAssessment, type SeatResource } from "./plan-change";
import type { BillingContract } from "./billing-core";

export function normalizePlanChangeSelections(
  catalog: BillingContract["catalog"],
  planCode: BillingContract["quote"]["planCode"],
  selections: BillingContract["quote"]["selections"],
) {
  const plan = catalog.plans.find((candidate) => candidate.code === planCode);
  if (!plan) throw new Error("PLAN_CHANGE_PLAN_UNKNOWN");
  return selections.filter((selection) => {
    const option = catalog.options.find((candidate) => candidate.code === selection.code);
    return Boolean(option?.applicablePlans.includes(planCode) && (!option.featureKey || !plan.includedFeatures.includes(option.featureKey)));
  });
}

/** Mêmes rôles facturés que le moteur de droits (mini-admins comptés comme dispatchers). */
const METERED_ROLES: Record<SeatResource, SystemRole[]> = {
  drivers: ["DRIVER"],
  admins: ["COMPANY_ADMIN"],
  dispatchers: ["DISPATCHER", "MINI_ADMIN"],
};

type PlanChangeReader = Pick<Prisma.TransactionClient, "user" | "saasSeatReservation" | "saasUsagePeriod">;

function contractFeatures(contract: BillingContract) {
  const plan = contract.catalog.plans.find((candidate) => candidate.code === contract.quote.planCode);
  if (!plan) throw new Error("PLAN_CHANGE_PLAN_UNKNOWN");
  const options = contract.quote.selections.flatMap((selection) => {
    const option = contract.catalog.options.find((candidate) => candidate.code === selection.code);
    return option?.featureKey ? [option.featureKey] : [];
  });
  return { plan, features: [...plan.includedFeatures, ...options] };
}

/**
 * Décision C10 : une baisse qui laisserait des comptes en excès est refusée avant tout
 * appel au fournisseur. Comptes ACTIVE/PENDING_VERIFICATION et réservations en cours,
 * plafonds de la formule visée appliqués : jamais plus permissif que la projection.
 */
export async function assessBillingContractChange(
  companyId: string,
  current: BillingContract,
  target: BillingContract,
  now = new Date(),
  db: PlanChangeReader = prisma
): Promise<PlanChangeAssessment> {
  const before = contractFeatures(current);
  const { plan: targetPlan } = contractFeatures(target);
  const usage = { drivers: 0, admins: 0, dispatchers: 0, monthlyOrders: 0 };
  for (const resource of ["drivers", "admins", "dispatchers"] as const) {
    const roles = METERED_ROLES[resource];
    const [users, reservations] = await Promise.all([
      db.user.count({ where: { companyId, status: { in: ["ACTIVE", "PENDING_VERIFICATION"] }, role: { systemRole: { in: roles } } } }),
      db.saasSeatReservation.count({ where: { companyId, role: { in: roles }, expiresAt: { gt: now } } }),
    ]);
    usage[resource] = users + reservations;
  }
  const period = await db.saasUsagePeriod.findFirst({
    where: { companyId, startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: { startsAt: "desc" },
    select: { orderCount: true },
  });
  usage.monthlyOrders = period?.orderCount ?? 0;

  return assessPlanChange({
    currentPlanCode: current.quote.planCode,
    currentPlanFeatures: before.features,
    items: target.quote.selections.map((selection) => {
      const option = target.catalog.options.find((candidate) => candidate.code === selection.code);
      if (!option) throw new Error("PLAN_CHANGE_OPTION_UNKNOWN");
      return { code: option.code, kind: option.kind, quantity: selection.quantity, featureKey: option.featureKey, applicablePlans: option.applicablePlans };
    }),
    usage,
    target: targetPlan,
  });
}
