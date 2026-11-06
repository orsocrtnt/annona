import { Prisma, type SystemRole } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { STAFF_ROLES } from "@/lib/permissions/rbac";

/** Utilisateur connecté qui lit une commande : son entreprise, son rôle et ses permissions viennent de la session. */
export type OrderActor = {
  id: string;
  companyId: string | null;
  /** Commerçant représenté (rôle MERCHANT). */
  merchantId?: string | null;
  role: SystemRole;
  permissions: string[];
  name: string;
};

export class OrderAccessError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = "OrderAccessError"; }
}

export function isOrderStaff(actor: OrderActor) { return STAFF_ROLES.includes(actor.role); }

/**
 * Commandes visibles, toujours bornées à l'entreprise (PLA-01) : celles de son commerçant pour un
 * client, celles de ses tournées pour un livreur, toute l'entreprise pour l'administrateur et le boulanger.
 */
export function orderActorScope(actor: OrderActor): Prisma.OrderWhereInput {
  if (!actor.companyId) throw new OrderAccessError(403, "Entreprise non associée.");
  const companyId = actor.companyId;
  if (actor.role === "MERCHANT" && actor.permissions.includes("dashboard:merchant")) {
    if (!actor.merchantId) throw new OrderAccessError(403, "Compte client non rattaché à un commerçant.");
    return { companyId, merchantId: actor.merchantId };
  }
  if (actor.role === "DRIVER" && actor.permissions.includes("dashboard:driver")) {
    return { companyId, stop: { is: { companyId, round: { is: { companyId, driverId: actor.id } } } } };
  }
  if ((isOrderStaff(actor) || actor.role === "BAKER") && actor.permissions.includes("orders:read")) return { companyId };
  throw new OrderAccessError(403, "Accès refusé.");
}

/** Transaction sérialisable rejouée sur conflit d'écriture (P2034) ou de clé unique (P2002). */
export async function serializableTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 }); }
    catch (e) { if (attempt < 3 && e instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(e.code)) continue; throw e; }
  }
}
