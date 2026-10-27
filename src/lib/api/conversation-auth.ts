import { requireAuth, requireRole } from "@/lib/api/auth-guard";
import type { ConversationActor } from "@/domains/order-conversation/order-conversation.service";
export async function conversationAuth() {
  const auth = await requireAuth();
  if ("error" in auth) return auth;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER", "DRIVER", "CLIENT"]);
  if (denied) return { error: denied };
  const { user, permissions } = auth.context;
  const actor: ConversationActor = { id: user.id, companyId: user.companyId ?? null, role: user.role.systemRole, permissions, name: `${user.firstName} ${user.lastName}`.trim() };
  return { actor };
}
