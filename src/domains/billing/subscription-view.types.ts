export type SubscriptionView = {
  formula: { code: string; name: string };
  /** Absente pour un pilote ou un accès historique, sans facturation périodique. */
  billingInterval: "MONTHLY" | "ANNUAL" | null;
  period: { startsAt: string; endsAt: string | null };
  premiumDiscovery: {
    endsAt: string;
    features: Array<{ code: string; name: string }>;
  } | null;
  options: Array<{ code: string; name: string; quantity: number; unitPriceCents: number }>;
  usage: {
    usedOrders: number;
    includedOrders: number;
    overageOrders: number;
  } | null;
  status: string;
  alerts: Array<{ code: string; label: string }>;
  history: Array<{ type: "operation" | "invoice"; label: string; status: string; occurredAt: string; amountCents?: number }>;
  /** SELF_SERVICE : compte de facturation en ligne ; TUTELLIV_TEAM : changements par l'équipe TutelLiv. */
  management: "SELF_SERVICE" | "TUTELLIV_TEAM";
};

/** Plafond de commandes des pilotes et formules sans limite (entier PostgreSQL maximal). */
export const UNLIMITED_MONTHLY_ORDERS = 2_147_483_647;
