export type PlanCode = "STARTER" | "PRO" | "BUSINESS";
export type BillingInterval = "MONTHLY" | "ANNUAL";

export type SignupCatalogPlan = {
  code: PlanCode;
  name: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  includedDriverSeats: number;
  unlimitedDriverSeats: boolean;
  maxDriverSeats: number | null;
  includedAdminSeats: number;
  includedDispatcherSeats: number;
  includedMonthlyOrders: number;
  orderOverageUnitPriceCents: number;
  includedFeatures: string[];
};

export type SignupCatalogOption = {
  code: string;
  name: string;
  kind: "OPTION" | "DRIVER_SEAT" | "ADMIN_SEAT" | "DISPATCHER_SEAT";
  featureKey: string | null;
  monthlyPriceCents: number;
  annualPriceCents: number;
  applicablePlans: PlanCode[];
};

export type SignupCatalog = {
  currency: string;
  vatRateBps: number;
  plans: SignupCatalogPlan[];
  options: SignupCatalogOption[];
};

export type ComparisonCellKind = "value" | "included" | "option" | "missing";

export type ComparisonCell = {
  kind: ComparisonCellKind;
  text: string;
  struckText?: string;
};

export type ComparisonRow = {
  id: string;
  label: string;
  cells: Record<PlanCode, ComparisonCell>;
};

export const FEATURE_COMPARISON_ORDER = [
  { key: "auto_dispatch", label: "Dispatch intelligent" },
  { key: "admin_gps", label: "Carte GPS administrateur" },
  { key: "client_gps", label: "Carte GPS client" },
  { key: "advanced_analytics", label: "Statistiques avancées" },
  { key: "priority_support", label: "Assistance prioritaire" },
] as const;

export function formatSignupMoney(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(cents / 100);
}

function emptyCell(): ComparisonCell {
  return { kind: "missing", text: "Non inclus" };
}

function cellsFor(plans: SignupCatalogPlan[], build: (plan: SignupCatalogPlan) => ComparisonCell): Record<PlanCode, ComparisonCell> {
  return {
    STARTER: plans.find((plan) => plan.code === "STARTER") ? build(plans.find((plan) => plan.code === "STARTER")!) : emptyCell(),
    PRO: plans.find((plan) => plan.code === "PRO") ? build(plans.find((plan) => plan.code === "PRO")!) : emptyCell(),
    BUSINESS: plans.find((plan) => plan.code === "BUSINESS") ? build(plans.find((plan) => plan.code === "BUSINESS")!) : emptyCell(),
  };
}

function featureCell(
  plan: SignupCatalogPlan,
  featureKey: string,
  options: SignupCatalogOption[],
  billingInterval: BillingInterval,
): ComparisonCell {
  if (plan.includedFeatures.includes(featureKey)) return { kind: "included", text: "Inclus" };
  const option = options.find((candidate) => candidate.kind === "OPTION" && candidate.featureKey === featureKey && candidate.applicablePlans.includes(plan.code));
  if (option) {
    const price = billingInterval === "ANNUAL" ? option.annualPriceCents : option.monthlyPriceCents;
    return { kind: "option", text: `En option · ${formatSignupMoney(price)} HT / ${billingInterval === "ANNUAL" ? "an" : "mois"}` };
  }
  return { kind: "missing", text: "Non inclus" };
}

function autoDispatchCell(
  plan: SignupCatalogPlan,
  options: SignupCatalogOption[],
  billingInterval: BillingInterval,
): ComparisonCell {
  if (!plan.includedFeatures.includes("auto_dispatch")) {
    return featureCell(plan, "auto_dispatch", options, billingInterval);
  }
  return {
    kind: "included",
    text: plan.includedDispatcherSeats > 0 ? `${plan.includedDispatcherSeats} inclus` : "Inclus",
  };
}

export function buildSignupPlanComparison(catalog: SignupCatalog, billingInterval: BillingInterval): ComparisonRow[] {
  const { plans, options } = catalog;
  const period = billingInterval === "ANNUAL" ? "an" : "mois";
  return [
    {
      id: "price",
      label: `Prix HT / ${period}`,
      cells: cellsFor(plans, (plan) => {
        if (billingInterval !== "ANNUAL") {
          return { kind: "value", text: formatSignupMoney(plan.monthlyPriceCents, catalog.currency) };
        }
        const listPriceCents = plan.monthlyPriceCents * 12;
        const discounted = formatSignupMoney(plan.annualPriceCents, catalog.currency);
        if (listPriceCents <= plan.annualPriceCents) {
          return { kind: "value", text: discounted };
        }
        return {
          kind: "value",
          text: discounted,
          struckText: formatSignupMoney(listPriceCents, catalog.currency),
        };
      }),
    },
    {
      id: "drivers",
      label: "Livreurs inclus",
      cells: cellsFor(plans, (plan) => ({
        kind: plan.unlimitedDriverSeats ? "included" : "value",
        text: plan.unlimitedDriverSeats ? "Illimités, usage mesuré" : `${plan.includedDriverSeats}`,
      })),
    },
    {
      id: "drivers-max",
      label: "Plafond de livreurs",
      cells: cellsFor(plans, (plan) => ({
        kind: plan.maxDriverSeats == null ? "included" : "value",
        text: plan.maxDriverSeats == null ? "Sans plafond chiffré" : `${plan.maxDriverSeats}`,
      })),
    },
    {
      id: "orders",
      label: "Commandes / mois",
      cells: cellsFor(plans, (plan) => ({ kind: "value", text: plan.includedMonthlyOrders.toLocaleString("fr-FR") })),
    },
    {
      id: "overage",
      label: "Commande supplémentaire",
      cells: cellsFor(plans, (plan) => ({
        kind: "value",
        text: `${formatSignupMoney(plan.orderOverageUnitPriceCents, catalog.currency)} HT, sans blocage`,
      })),
    },
    {
      id: "admins",
      label: "Administrateurs inclus",
      cells: cellsFor(plans, (plan) => ({ kind: "value", text: `${plan.includedAdminSeats}` })),
    },
    ...FEATURE_COMPARISON_ORDER.map((feature) => ({
      id: feature.key,
      label: feature.label,
      cells: cellsFor(plans, (plan) =>
        feature.key === "auto_dispatch"
          ? autoDispatchCell(plan, options, billingInterval)
          : featureCell(plan, feature.key, options, billingInterval)
      ),
    })),
  ];
}
