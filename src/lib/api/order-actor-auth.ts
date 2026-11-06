import { requireAuth, requireRole } from "@/lib/api/auth-guard";
import type { OrderActor } from "@/domains/order/order-access";

/** Session d'un utilisateur d'entreprise (équipe, livreur ou client) qui consulte une commande. */
export async function orderActorAuth() {
  const auth = await requireAuth();
  if ("error" in auth) return auth;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER", "DRIVER", "CLIENT"]);
  if (denied) return { error: denied };
  const { user, permissions } = auth.context;
  const actor: OrderActor = { id: user.id, companyId: user.companyId ?? null, role: user.role.systemRole, permissions, name: `${user.firstName} ${user.lastName}`.trim() };
  return { actor };
}
