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
  /** `documentUrl` : page de la facture chez Stripe, seulement pour une adresse `invoice.stripe.com`. */
  history: Array<{ type: "operation" | "invoice"; label: string; status: string; occurredAt: string; amountCents?: number; documentUrl?: string }>;
  /** SELF_SERVICE : compte de facturation en ligne ; ANNONA_TEAM : changements par l'équipe Annona. */
  management: "SELF_SERVICE" | "ANNONA_TEAM";
  /** Résiliation déjà demandée : l'abonnement court jusqu'à la fin de la période payée. */
  cancelAtPeriodEnd: boolean;
  /** Résiliation en libre-service possible (compte en ligne, abonnement actif ou en retard de paiement). */
  canCancel: boolean;
  /** Changement de formule possible : actif, sans résiliation ni changement déjà en attente. */
  canChange: boolean;
  /** Portail Stripe du moyen de paiement : compte en ligne activé, non résilié définitivement. */
  canManagePaymentMethod: boolean;
};

/** Plafond de commandes des pilotes et formules sans limite (entier PostgreSQL maximal). */
export const UNLIMITED_MONTHLY_ORDERS = 2_147_483_647;
