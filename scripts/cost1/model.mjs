import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import assert from "node:assert/strict";

const outputPath = resolve(process.argv[2] ?? "outputs/cost1/model.json");
const outputDir = dirname(outputPath);

const profiles = {
  starter: {
    label: "Starter",
    monthlyPriceEur: 79,
    drivers: 5,
    monthlyOrders: 1_000,
    admins: 1,
    activeGpsHoursPerDriverDay: 4,
    supportHoursPerMonth: 0.5,
  },
  pro: {
    label: "Pro",
    monthlyPriceEur: 179,
    drivers: 10,
    monthlyOrders: 3_000,
    admins: 1,
    activeGpsHoursPerDriverDay: 6,
    supportHoursPerMonth: 1,
  },
  business: {
    label: "Business",
    monthlyPriceEur: 349,
    drivers: 25,
    monthlyOrders: 6_000,
    admins: 2,
    activeGpsHoursPerDriverDay: 8,
    supportHoursPerMonth: 2,
  },
};

const variants = {
  low: {
    label: "bas",
    gpsHoursFactor: 0.5,
    routeCallsPerOrder: 3,
    proofRate: 0.5,
    proofAverageMb: 0.5,
    emailsPerOrder: 2,
    supportFactor: 0.5,
    appApiCallsPerOrder: 12,
    functionCpuMs: 5,
    functionWallMs: 100,
  },
  central: {
    label: "central",
    gpsHoursFactor: 1,
    routeCallsPerOrder: 60,
    proofRate: 0.7,
    proofAverageMb: 1,
    emailsPerOrder: 3,
    supportFactor: 1,
    appApiCallsPerOrder: 20,
    functionCpuMs: 10,
    functionWallMs: 150,
  },
  high: {
    label: "haut",
    gpsHoursFactor: 1.5,
    routeCallsPerOrder: 120,
    proofRate: 1,
    proofAverageMb: 3,
    emailsPerOrder: 5,
    supportFactor: 2,
    appApiCallsPerOrder: 35,
    functionCpuMs: 25,
    functionWallMs: 300,
  },
};

const companyCounts = [1, 10, 50, 100];
const commissionRates = [0.15, 0.25, 0.35];

const constants = {
  businessDaysPerMonth: 22,
  gpsIntervalSeconds: 4,
  adminMapRefreshSeconds: 20,
  adminMapHoursPerDay: 2,
  adminMapSessionsPerDay: 20,
  mapTileCreditsPerSession: 12.5,
  geocodingCreditsPerOrder: 2,
  proofRetentionMonths: 12,
  proofDownloadsPerProof: 2,
  databaseKbPerOrder: 25,
  databaseRetentionMonths: 12,
  supportLoadedHourlyCostEur: 30,
  stripeCardRate: 0.015,
  stripeCardFixedEur: 0.25,
  stripeBillingRate: 0.007,
  vercelCpuEurPerHour: 0.177,
  vercelMemoryEurPerGbHour: 0.0146,
  vercelMemoryGb: 2,
  vercelInvocationEur: 0.0000006,
  vercelProMinimumEur: 20,
  resendProBaseEur: 20,
  resendIncludedEmails: 50_000,
  resendExtraEmailEur: 0.0009,
  supabaseStorageIncludedGb: 100,
  supabaseStorageExtraEurPerGb: 0.0213,
  supabaseDatabaseIncludedGb: 8,
  supabaseDatabaseExtraEurPerGb: 0.125,
  supabaseCachedEgressIncludedGb: 250,
  supabaseCachedEgressExtraEurPerGb: 0.03,
};

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function supabaseComputeBudget(monthlyGpsWrites) {
  if (monthlyGpsWrites <= 5_000_000) return { tier: "Micro", monthlyEur: 25 };
  if (monthlyGpsWrites <= 20_000_000) return { tier: "Small", monthlyEur: 30 };
  if (monthlyGpsWrites <= 80_000_000) return { tier: "Medium", monthlyEur: 75 };
  if (monthlyGpsWrites <= 200_000_000) return { tier: "Large", monthlyEur: 125 };
  if (monthlyGpsWrites <= 400_000_000) return { tier: "XL", monthlyEur: 225 };
  if (monthlyGpsWrites <= 800_000_000) return { tier: "2XL", monthlyEur: 425 };
  return { tier: "4XL (budget minimal)", monthlyEur: 975 };
}

function mapBudget(dailyCredits) {
  if (dailyCredits <= 3_000) return { tier: "Free", monthlyEur: 0, customQuote: false };
  if (dailyCredits <= 10_000) return { tier: "API 10", monthlyEur: 59, customQuote: false };
  if (dailyCredits <= 25_000) return { tier: "API 25", monthlyEur: 109, customQuote: false };
  if (dailyCredits <= 50_000) return { tier: "API 50", monthlyEur: 179, customQuote: false };
  if (dailyCredits <= 100_000) return { tier: "API 100", monthlyEur: 299, customQuote: false };
  if (dailyCredits <= 250_000) return { tier: "API 250", monthlyEur: 609, customQuote: false };
  return { tier: "Custom (plancher public)", monthlyEur: 860, customQuote: true };
}

function calculate(profileKey, companyCount, variantKey) {
  const profile = profiles[profileKey];
  const variant = variants[variantKey];
  const orders = profile.monthlyOrders * companyCount;
  const gpsHours = Math.min(10, profile.activeGpsHoursPerDriverDay * variant.gpsHoursFactor);
  const gpsWrites = Math.ceil(
    companyCount * profile.drivers * gpsHours * 3_600 /
      constants.gpsIntervalSeconds * constants.businessDaysPerMonth
  );
  const adminMapPolls = Math.ceil(
    companyCount * profile.admins * constants.adminMapHoursPerDay * 3_600 /
      constants.adminMapRefreshSeconds * constants.businessDaysPerMonth
  );
  const applicationApiCalls = orders * variant.appApiCallsPerOrder;
  const vercelInvocations = gpsWrites + adminMapPolls + applicationApiCalls;
  const cpuCost = vercelInvocations * (variant.functionCpuMs / 3_600_000) * constants.vercelCpuEurPerHour;
  const memoryCost = vercelInvocations * (variant.functionWallMs / 3_600_000) *
    constants.vercelMemoryGb * constants.vercelMemoryEurPerGbHour;
  const invocationCost = vercelInvocations * constants.vercelInvocationEur;
  const vercelMeteredCost = cpuCost + memoryCost + invocationCost;
  const vercelCost = Math.max(constants.vercelProMinimumEur, vercelMeteredCost);

  const proofStorageGb = orders * variant.proofRate * variant.proofAverageMb /
    1_024 * constants.proofRetentionMonths;
  const databaseStorageGb = orders * constants.databaseKbPerOrder /
    (1_024 * 1_024) * constants.databaseRetentionMonths;
  const proofEgressGb = orders * variant.proofRate * variant.proofAverageMb /
    1_024 * constants.proofDownloadsPerProof;
  const compute = supabaseComputeBudget(gpsWrites);
  const supabaseCost = compute.monthlyEur +
    Math.max(0, proofStorageGb - constants.supabaseStorageIncludedGb) * constants.supabaseStorageExtraEurPerGb +
    Math.max(0, databaseStorageGb - constants.supabaseDatabaseIncludedGb) * constants.supabaseDatabaseExtraEurPerGb +
    Math.max(0, proofEgressGb - constants.supabaseCachedEgressIncludedGb) * constants.supabaseCachedEgressExtraEurPerGb;

  const emails = orders * variant.emailsPerOrder;
  const resendCost = constants.resendProBaseEur +
    Math.max(0, emails - constants.resendIncludedEmails) * constants.resendExtraEmailEur;

  const routeCredits = orders * variant.routeCallsPerOrder;
  const tileCredits = orders * constants.mapTileCreditsPerSession +
    companyCount * profile.admins * constants.adminMapSessionsPerDay *
      constants.businessDaysPerMonth * constants.mapTileCreditsPerSession;
  const geocodingCredits = orders * constants.geocodingCreditsPerOrder;
  const dailyMapCredits = (routeCredits + tileCredits + geocodingCredits) /
    constants.businessDaysPerMonth;
  const map = mapBudget(dailyMapCredits);

  const revenue = profile.monthlyPriceEur * companyCount;
  const paymentFees = companyCount * (
    profile.monthlyPriceEur * constants.stripeCardRate + constants.stripeCardFixedEur +
    profile.monthlyPriceEur * constants.stripeBillingRate
  );
  const supportCost = companyCount * profile.supportHoursPerMonth *
    variant.supportFactor * constants.supportLoadedHourlyCostEur;
  const infrastructureCost = vercelCost + supabaseCost + resendCost + map.monthlyEur;
  const contributionBeforeCommission = revenue - paymentFees - supportCost - infrastructureCost;
  const commissions = Object.fromEntries(commissionRates.map((rate) => {
    const commission = revenue * rate;
    const contribution = contributionBeforeCommission - commission;
    return [`${Math.round(rate * 100)}pct`, {
      commissionEur: round(commission),
      contributionEur: round(contribution),
      contributionRatePct: round(contribution / revenue * 100, 1),
    }];
  }));

  return {
    profile: profile.label,
    profileKey,
    variant: variant.label,
    variantKey,
    companies: companyCount,
    revenueEur: round(revenue),
    volumes: {
      orders,
      gpsWrites,
      adminMapPolls,
      vercelInvocations,
      emails,
      proofStorageSteadyGb: round(proofStorageGb, 1),
      databaseStorageSteadyGb: round(databaseStorageGb, 1),
      proofEgressGb: round(proofEgressGb, 1),
      dailyMapCredits: round(dailyMapCredits),
      realtimeMessages: 0,
    },
    costsEur: {
      vercel: round(vercelCost),
      vercelMeteredBeforeCredit: round(vercelMeteredCost),
      supabase: round(supabaseCost),
      resend: round(resendCost),
      mapping: round(map.monthlyEur),
      payment: round(paymentFees),
      support: round(supportCost),
      infrastructure: round(infrastructureCost),
      totalBeforeCommission: round(paymentFees + supportCost + infrastructureCost),
    },
    tiers: {
      supabaseCompute: compute.tier,
      mapping: map.tier,
      mappingRequiresQuote: map.customQuote,
    },
    contributionBeforeCommissionEur: round(contributionBeforeCommission),
    contributionBeforeCommissionRatePct: round(contributionBeforeCommission / revenue * 100, 1),
    commissions,
  };
}

const scenarios = [];
for (const profileKey of Object.keys(profiles)) {
  for (const companyCount of companyCounts) {
    for (const variantKey of Object.keys(variants)) {
      scenarios.push(calculate(profileKey, companyCount, variantKey));
    }
  }
}

assert.equal(scenarios.length, 36, "Le modèle doit produire 3 profils × 4 volumes × 3 variantes.");
for (const scenario of scenarios) {
  assert.ok(scenario.revenueEur > 0, "Le revenu doit être positif.");
  assert.ok(scenario.volumes.gpsWrites > 0, "Les écritures GPS doivent être estimées.");
  assert.equal(scenario.volumes.realtimeMessages, 0, "Le code audité n'utilise pas Supabase Realtime.");
  for (const value of Object.values(scenario.costsEur)) {
    assert.ok(Number.isFinite(value) && value >= 0, "Chaque coût doit être fini et positif.");
  }
}

for (const scenario of scenarios) {
  const next = calculate(scenario.profileKey, scenario.companies + 1, scenario.variantKey);
  scenario.costsEur.marginalInfrastructureNextCompany = round(
    next.costsEur.infrastructure - scenario.costsEur.infrastructure
  );
  scenario.costsEur.marginalTotalBeforeCommissionNextCompany = round(
    next.costsEur.totalBeforeCommission - scenario.costsEur.totalBeforeCommission
  );
}

const result = {
  generatedAt: new Date().toISOString(),
  currencyConvention: "1 USD de tarif fournisseur = 1 EUR de budget, hypothèse volontairement prudente ; TVA fournisseur exclue.",
  status: "Estimation documentaire. Les paliers de calcul Supabase et les temps Vercel doivent être remplacés par PERF-02.",
  profiles,
  variants,
  constants,
  scenarios,
};

const csvHeader = [
  "profil", "variante", "entreprises", "revenu_eur", "commandes", "ecritures_gps",
  "invocations_vercel", "emails", "stockage_preuves_go", "credits_carte_jour",
  "palier_supabase", "palier_cartographie", "devis_cartographie_requis",
  "cout_vercel_eur", "cout_supabase_eur", "cout_email_eur", "cout_cartographie_eur",
  "frais_paiement_eur", "cout_support_eur", "cout_total_hors_commission_eur",
  "marge_avant_commission_eur", "marge_avant_commission_pct",
  "marge_commission_15_eur", "marge_commission_15_pct",
  "marge_commission_25_eur", "marge_commission_25_pct",
  "marge_commission_35_eur", "marge_commission_35_pct",
  "cout_marginal_infra_client_suivant_eur", "cout_marginal_total_client_suivant_eur",
];

const csvRows = scenarios.map((s) => [
  s.profile, s.variant, s.companies, s.revenueEur, s.volumes.orders, s.volumes.gpsWrites,
  s.volumes.vercelInvocations, s.volumes.emails, s.volumes.proofStorageSteadyGb,
  s.volumes.dailyMapCredits, s.tiers.supabaseCompute, s.tiers.mapping,
  s.tiers.mappingRequiresQuote, s.costsEur.vercel, s.costsEur.supabase,
  s.costsEur.resend, s.costsEur.mapping, s.costsEur.payment, s.costsEur.support,
  s.costsEur.totalBeforeCommission, s.contributionBeforeCommissionEur,
  s.contributionBeforeCommissionRatePct, s.commissions["15pct"].contributionEur,
  s.commissions["15pct"].contributionRatePct, s.commissions["25pct"].contributionEur,
  s.commissions["25pct"].contributionRatePct, s.commissions["35pct"].contributionEur,
  s.commissions["35pct"].contributionRatePct,
  s.costsEur.marginalInfrastructureNextCompany,
  s.costsEur.marginalTotalBeforeCommissionNextCompany,
].map((value) => String(value).replaceAll(";", ",")).join(";"));

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(resolve(outputDir, "scenarios.csv"), `${csvHeader.join(";")}\n${csvRows.join("\n")}\n`, "utf8");

console.log(`COST-1: ${scenarios.length} scénarios écrits dans ${outputDir}`);
