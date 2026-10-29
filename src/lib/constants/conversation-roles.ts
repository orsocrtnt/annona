/** Rôles autorisés sur les échanges de commande et les alertes opérationnelles (API et interface). */
export const CONVERSATION_ROLES = ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER", "DRIVER", "CLIENT"] as const;

export function canUseConversations(role: string | null | undefined): boolean {
  return Boolean(role) && (CONVERSATION_ROLES as readonly string[]).includes(role as string);
}
