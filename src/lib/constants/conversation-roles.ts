/** Rôles autorisés sur les échanges de commande et les alertes (miroir de src/lib/api/conversation-auth.ts, vérifié par test). */
export const CONVERSATION_ROLES = ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER", "DRIVER", "CLIENT"] as const;

export function canUseConversations(role: string | null | undefined): boolean {
  return Boolean(role) && (CONVERSATION_ROLES as readonly string[]).includes(role as string);
}

/** Lecture exigée d'un profil d'équipe (miroir de `conversationScope` dans order-conversation.service.ts). */
export const STAFF_INBOX_PERMISSIONS = ["orders:read", "deliveries:read"] as const;

/**
 * Boîte des échanges et des alertes du back-office : un mini-admin sans module commandes ni livraisons
 * (support, facturation…) recevrait un 403 du serveur ; l'encart n'est donc pas monté pour lui.
 */
export function canOpenStaffInbox(role: string | null | undefined, permissions: readonly string[]): boolean {
  return canUseConversations(role) && permissions.some((permission) => (STAFF_INBOX_PERMISSIONS as readonly string[]).includes(permission));
}
