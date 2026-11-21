/**
 * RETOURS-1 (tour de Théo, 21 novembre 2026), ADM-04 : l'administrateur classe les commandes du jour par client
 * (ordre alphabétique) ou par montant, croissant ou décroissant. « default » garde l'ordre du serveur (créneau,
 * tournée, arrêt).
 */
export const ADMIN_ORDER_SORTS = ["default", "client", "price-asc", "price-desc"] as const;
export type AdminOrderSort = (typeof ADMIN_ORDER_SORTS)[number];

export const ADMIN_ORDER_SORT_LABELS: Record<AdminOrderSort, string> = {
  default: "Tournée et arrêt",
  client: "Client (A à Z)",
  "price-asc": "Montant croissant",
  "price-desc": "Montant décroissant",
};

export function parseAdminOrderSort(value: string | null | undefined): AdminOrderSort {
  return (ADMIN_ORDER_SORTS as readonly string[]).includes(value ?? "") ? (value as AdminOrderSort) : "default";
}

export function sortAdminOrders<T extends { merchant: { name: string }; subtotalCents: number; reference: string }>(
  orders: readonly T[],
  sort: AdminOrderSort
): T[] {
  const byName = (a: T, b: T) => a.merchant.name.localeCompare(b.merchant.name, "fr", { sensitivity: "base" }) || a.reference.localeCompare(b.reference);
  const list = [...orders];
  if (sort === "client") return list.sort(byName);
  if (sort === "price-asc") return list.sort((a, b) => a.subtotalCents - b.subtotalCents || byName(a, b));
  if (sort === "price-desc") return list.sort((a, b) => b.subtotalCents - a.subtotalCents || byName(a, b));
  return list;
}
