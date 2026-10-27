/** Frise d'avancement d'une commande : où elle en est, sans lire de statut technique. */

export type OrderProgressStep = { key: "received" | "assigned" | "onTheWay" | "delivered"; label: string };
export type OrderProgress =
  | { kind: "steps"; steps: OrderProgressStep[]; current: number }
  | { kind: "stopped"; label: string; tone: "danger" | "neutral" };

const STEP_INDEX: Record<string, number> = {
  QUOTE_REQUESTED: 0,
  PENDING: 0,
  ASSIGNED: 1,
  PURCHASING: 2,
  IN_DELIVERY: 2,
  DELIVERED: 3,
  INVOICED: 3,
  PAID: 3,
};

export function orderProgress(status: string, category?: string | null): OrderProgress {
  if (status === "CANCELLED") return { kind: "stopped", label: "Commande annulée", tone: "neutral" };
  if (status === "FAILED") return { kind: "stopped", label: "Échec de livraison", tone: "danger" };
  const steps: OrderProgressStep[] = [
    { key: "received", label: status === "QUOTE_REQUESTED" ? "Devis demandé" : "Reçue" },
    { key: "assigned", label: "Livreur assigné" },
    { key: "onTheWay", label: category === "COURIER" ? "Course en cours" : "En livraison" },
    { key: "delivered", label: "Livrée" },
  ];
  return { kind: "steps", steps, current: STEP_INDEX[status] ?? 0 };
}
