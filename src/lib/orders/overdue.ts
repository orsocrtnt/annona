/** Mêmes statuts « en cours » que les alertes de retard : une commande close n'est jamais en retard. */
const ACTIVE_ORDER_STATUSES = new Set(["PENDING", "ASSIGNED", "PURCHASING", "IN_DELIVERY"]);

export function isOrderOverdue(status: string, requestedDeliveryDate?: string | Date | null, now = new Date()): boolean {
  if (!requestedDeliveryDate || !ACTIVE_ORDER_STATUSES.has(status)) return false;
  const due = new Date(requestedDeliveryDate).getTime();
  return !Number.isNaN(due) && due < now.getTime();
}
