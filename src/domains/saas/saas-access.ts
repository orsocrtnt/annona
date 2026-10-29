import type { SaasPlanCode } from "@prisma/client";

export const SESSION_SAAS_FEATURES = [
  "auto_dispatch",
  "admin_gps",
  "client_gps",
  "advanced_analytics",
  "priority_support",
] as const;

export type OfferSaasFeature = (typeof SESSION_SAAS_FEATURES)[number];

export type SessionSaasSeatMeter = {
  used: number;
  limit: number | null;
  remaining: number | null;
  extraMonthlyPriceCents: number | null;
  canAddExtra: boolean;
};

export type SessionSaasAccess = {
  kind: "COMMERCIAL" | "PILOT" | "LEGACY";
  planCode: SaasPlanCode | null;
  features: string[];
  limits: {
    drivers: number | null;
    admins: number | null;
    dispatchers: number | null;
    monthlyOrders: number;
  };
  seats?: {
    drivers: SessionSaasSeatMeter;
    admins: SessionSaasSeatMeter;
    dispatchers: SessionSaasSeatMeter;
  };
  canCreateOrders: boolean;
  canMutate: boolean;
};

export function buildSessionSeatMeter(input: {
  used: number;
  limit: number | null;
  hardMax?: number | null;
  extraMonthlyPriceCents?: number | null;
}): SessionSaasSeatMeter {
  const extraMonthlyPriceCents = input.extraMonthlyPriceCents ?? null;
  if (input.limit == null) {
    return {
      used: input.used,
      limit: null,
      remaining: null,
      extraMonthlyPriceCents,
      canAddExtra: false,
    };
  }
  const remaining = Math.max(0, input.limit - input.used);
  const hardMax = input.hardMax ?? null;
  const canAddExtra =
    remaining === 0 &&
    extraMonthlyPriceCents != null &&
    (hardMax == null || input.limit < hardMax);
  return {
    used: input.used,
    limit: input.limit,
    remaining,
    extraMonthlyPriceCents,
    canAddExtra,
  };
}

function formatSeatEuros(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function seatRemainingLabel(meter: SessionSaasSeatMeter) {
  if (meter.remaining == null) return "Sans plafond chiffré";
  if (meter.remaining > 0) {
    return meter.remaining === 1 ? "1 poste restant" : `${meter.remaining} postes restants`;
  }
  if (meter.canAddExtra && meter.extraMonthlyPriceCents != null) {
    return `Aucun poste restant · ${formatSeatEuros(meter.extraMonthlyPriceCents)} HT / mois pour en ajouter un`;
  }
  return "Plafond atteint";
}

export function canInviteSaasSeat(meter: SessionSaasSeatMeter | undefined) {
  if (!meter) return true;
  if (meter.remaining == null) return true;
  return meter.remaining > 0;
}

export const SAAS_FEATURE_LABELS: Record<OfferSaasFeature, string> = {
  auto_dispatch: "Dispatch intelligent",
  admin_gps: "Carte GPS administrateur",
  client_gps: "Carte GPS client",
  advanced_analytics: "Statistiques avancées",
  priority_support: "Assistance prioritaire",
};

export const SAAS_PLAN_LABELS: Record<SaasPlanCode, string> = {
  STARTER: "Starter",
  PRO: "Pro",
  BUSINESS: "Business",
};

export const OFFER_FEATURE_HREFS: Record<string, OfferSaasFeature> = {
  "/dashboard/analytics": "advanced_analytics",
  "/dispatch/drivers": "admin_gps",
  "/dispatch/map": "admin_gps",
  "/portal/deliveries": "client_gps",
};

export function unlockedSessionSaasAccess(): SessionSaasAccess {
  return {
    kind: "LEGACY",
    planCode: null,
    features: [...SESSION_SAAS_FEATURES],
    limits: {
      drivers: null,
      admins: null,
      dispatchers: null,
      monthlyOrders: 2_147_483_647,
    },
    seats: {
      drivers: buildSessionSeatMeter({ used: 0, limit: null }),
      admins: buildSessionSeatMeter({ used: 0, limit: null }),
      dispatchers: buildSessionSeatMeter({ used: 0, limit: null }),
    },
    canCreateOrders: true,
    canMutate: true,
  };
}

export function isOfferAccessPending(
  access: SessionSaasAccess | null | undefined,
  isLoading: boolean
) {
  return isLoading && !access;
}

export function hasSaasFeature(
  access: SessionSaasAccess | null | undefined,
  feature: OfferSaasFeature
) {
  if (!access) return true;
  return access.features.includes(feature);
}

export function hasSaasSeat(
  access: SessionSaasAccess | null | undefined,
  key: "drivers" | "admins" | "dispatchers"
) {
  if (!access) return true;
  const limit = access.limits[key];
  return limit == null || limit > 0;
}

export function lockedOfferReason(
  feature: OfferSaasFeature,
  planCode: SaasPlanCode | null | undefined
) {
  const label = SAAS_FEATURE_LABELS[feature];
  if (planCode) {
    return `${label} n’est pas inclus dans ${SAAS_PLAN_LABELS[planCode]}. Disponible en option ou dans une offre supérieure.`;
  }
  return `${label} n’est pas inclus dans cette offre.`;
}

export function lockedSeatReason(
  key: "dispatchers" | "drivers" | "admins",
  planCode: SaasPlanCode | null | undefined
) {
  const labels = {
    dispatchers: "Les sièges dispatcher",
    drivers: "Les sièges livreur",
    admins: "Les sièges administrateur",
  };
  if (planCode) {
    return `${labels[key]} ne sont pas inclus dans ${SAAS_PLAN_LABELS[planCode]}. Ajoutez l’option correspondante.`;
  }
  return `${labels[key]} ne sont pas inclus dans cette offre.`;
}
