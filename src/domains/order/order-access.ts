import { Prisma, type SystemRole } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { STAFF_ROLES } from "@/lib/permissions/rbac";

/** Utilisateur connecté qui lit une commande : son entreprise, son rôle et ses permissions viennent de la session. */
export type OrderActor = { id: string; companyId: string | null; role: SystemRole; permissions: string[]; name: string };

export class OrderAccessError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = "OrderAccessError"; }
}

export function isOrderStaff(actor: OrderActor) { return STAFF_ROLES.includes(actor.role); }

/** Commandes visibles : celles du client, celles confiées au livreur, ou toute l'entreprise pour l'équipe. */
export function orderActorScope(actor: OrderActor): Prisma.OrderWhereInput {
  if (!actor.companyId) throw new OrderAccessError(403, "Entreprise non associée.");
  if (actor.role === "CLIENT" && actor.permissions.includes("dashboard:client")) return { companyId: actor.companyId, customerId: actor.id };
  if (actor.role === "DRIVER" && actor.permissions.includes("dashboard:driver")) return { companyId: actor.companyId, deliveries: { some: { companyId: actor.companyId, driverId: actor.id } } };
  if (isOrderStaff(actor) && actor.permissions.some(p => ["orders:read", "deliveries:read"].includes(p))) return { companyId: actor.companyId };
  throw new OrderAccessError(403, "Accès refusé.");
}

/** Transaction sérialisable rejouée sur conflit d'écriture (P2034) ou de clé unique (P2002). */
export async function serializableTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 }); }
    catch (e) { if (attempt < 3 && e instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(e.code)) continue; throw e; }
  }
}
