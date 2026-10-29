/** Rôles autorisés sur les échanges de commande et les alertes (miroir de src/lib/api/conversation-auth.ts, vérifié par test). */
export const CONVERSATION_ROLES = ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER", "DRIVER", "CLIENT"] as const;

export function canUseConversations(role: string | null | undefined): boolean {
  return Boolean(role) && (CONVERSATION_ROLES as readonly string[]).includes(role as string);
}
