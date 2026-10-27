import { SAAS_FEATURE_LABELS } from "@/domains/saas/saas-access";
import { PREMIUM_DISCOVERY_DAYS, PREMIUM_DISCOVERY_FEATURES } from "@/domains/saas/saas.service";
import { buildSignupQuote, type SignupCatalog } from "@/domains/signup/signup.service";
import type { SaasPlanCode } from "@prisma/client";

export type PublicPricingPlan = {
  code: SaasPlanCode;
  name: string;
  monthlyHtCents: number;
  annualHtCents: number;
  monthlyTtcCents: number;
  annualTtcCents: number;
  includedDriverSeats: number;
  unlimitedDriverSeats: boolean;
  maxDriverSeats: number | null;
  includedFeatureLabels: string[];
  includedAdminSeats: number;
  maxAdminSeats: number | null;
  includedDispatcherSeats: number;
  maxDispatcherSeats: number | null;
  includedMonthlyOrders: number;
  orderOverageUnitPriceCents: number;
  discovery: boolean;
  options: Array<{
    code: string;
    name: string;
    monthlyPriceCents: number;
    annualPriceCents: number;
  }>;
};

export type PublicPricing = {
  catalogCode: string;
  currency: string;
  vatRateBps: number;
  discoveryDays: number;
  discoveryFeatures: string[];
  plans: PublicPricingPlan[];
};

export function toPublicPricing(catalog: SignupCatalog): PublicPricing {
  return {
    catalogCode: catalog.code,
    currency: catalog.currency,
    vatRateBps: catalog.vatRateBps,
    discoveryDays: PREMIUM_DISCOVERY_DAYS,
    discoveryFeatures: PREMIUM_DISCOVERY_FEATURES.map((feature) => SAAS_FEATURE_LABELS[feature]),
    plans: catalog.plans.map((plan) => {
      const monthly = buildSignupQuote(catalog, plan.code, "MONTHLY", []);
      const annual = buildSignupQuote(catalog, plan.code, "ANNUAL", []);
      return {
        code: plan.code,
        name: plan.name,
        monthlyHtCents: monthly.planPriceCents,
        annualHtCents: annual.planPriceCents,
        monthlyTtcCents: monthly.totalTtcCents,
        annualTtcCents: annual.totalTtcCents,
        includedDriverSeats: plan.includedDriverSeats,
        unlimitedDriverSeats: plan.unlimitedDriverSeats,
        maxDriverSeats: plan.maxDriverSeats,
        includedFeatureLabels: plan.includedFeatures.map((feature) =>
          feature in SAAS_FEATURE_LABELS ? SAAS_FEATURE_LABELS[feature as keyof typeof SAAS_FEATURE_LABELS] : feature
        ),
        includedAdminSeats: plan.includedAdminSeats,
        maxAdminSeats: plan.maxAdminSeats,
        includedDispatcherSeats: plan.includedDispatcherSeats,
        maxDispatcherSeats: plan.maxDispatcherSeats,
        includedMonthlyOrders: plan.includedMonthlyOrders,
        orderOverageUnitPriceCents: plan.orderOverageUnitPriceCents,
        discovery: plan.code === "STARTER" || plan.code === "PRO",
        options: catalog.options
          .filter((option) => option.applicablePlans.includes(plan.code))
          .filter((option) => !option.featureKey || !plan.includedFeatures.includes(option.featureKey))
          .map((option) => ({
            code: option.code,
            name: option.name,
            monthlyPriceCents: option.monthlyPriceCents,
            annualPriceCents: option.annualPriceCents,
          })),
      };
    }),
  };
}
