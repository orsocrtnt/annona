import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PREMIUM_DISCOVERY_DAYS } from "../src/domains/saas/saas.service";
import { toPublicPricing } from "../src/domains/growth/public-pricing";
import { signupEntryFromSearch } from "../src/domains/growth/signup-entry";
import type { SignupCatalog } from "../src/domains/signup/signup.service";

function plan(code: SignupCatalog["plans"][number]["code"], monthly: number, features: string[]): SignupCatalog["plans"][number] {
  return {
    code,
    name: code,
    monthlyPriceCents: monthly,
    annualPriceCents: monthly * 10,
    includedDriverSeats: code === "BUSINESS" ? 20 : 4,
    unlimitedDriverSeats: code === "BUSINESS",
    maxDriverSeats: code === "BUSINESS" ? 50 : 9,
    includedAdminSeats: 1,
    maxAdminSeats: 2,
    includedDispatcherSeats: 0,
    maxDispatcherSeats: 3,
    includedMonthlyOrders: 80,
    orderOverageUnitPriceCents: 7,
    includedFeatures: features,
  };
}

const catalog: SignupCatalog = {
  id: "catalog-test",
  code: "CATALOGUE-TEST",
  currency: "EUR",
  vatRateBps: 2000,
  plans: [
    plan("STARTER", 1111, []),
    plan("PRO", 2222, ["auto_dispatch"]),
    plan("BUSINESS", 3333, ["auto_dispatch"]),
  ],
  options: [
    {
      id: "option-dispatch",
      code: "AUTO_DISPATCH",
      name: "Dispatch",
      kind: "OPTION",
      featureKey: "auto_dispatch",
      monthlyPriceCents: 444,
      annualPriceCents: 4440,
      applicablePlans: ["STARTER", "PRO", "BUSINESS"],
    },
    {
      id: "option-seat",
      code: "DRIVER_SEAT",
      name: "Siège livreur",
      kind: "DRIVER_SEAT",
      featureKey: null,
      monthlyPriceCents: 555,
      annualPriceCents: 5550,
      applicablePlans: ["STARTER"],
    },
  ],
};

test("les tarifs publics reprennent le catalogue sans prix écrits dans la page", () => {
  const pricing = toPublicPricing(catalog);
  const starter = pricing.plans.find((item) => item.code === "STARTER");
  const pro = pricing.plans.find((item) => item.code === "PRO");
  const business = pricing.plans.find((item) => item.code === "BUSINESS");
  assert.equal(starter?.monthlyHtCents, 1111);
  assert.equal(starter?.annualHtCents, 11110);
  assert.equal(starter?.monthlyTtcCents, 1111 + Math.round((1111 * 2000) / 10_000));
  assert.equal(starter?.options.map((option) => option.code).join(","), "AUTO_DISPATCH,DRIVER_SEAT");
  assert.equal(pro?.options.map((option) => option.code).join(","), "");
  assert.equal(business?.maxDriverSeats, 50);
  assert.equal(business?.unlimitedDriverSeats, true);
  assert.equal(pro?.includedFeatureLabels.includes("Dispatch intelligent"), true);
  assert.equal(starter?.includedFeatureLabels.length, 0);
  assert.equal(business?.discovery, false);
  assert.equal(starter?.discovery, true);
  assert.equal(pricing.discoveryDays, PREMIUM_DISCOVERY_DAYS);
  assert.equal(pricing.discoveryFeatures.includes("Assistance prioritaire"), false);

  // Depuis le 5 novembre 2026, /tarifs est une liste d'attente provisoire : aucun prix publié.
  // Le mapper reste prêt pour la grille réelle (ancienne page dans l'historique Git).
  const page = readFileSync(new URL("../src/app/tarifs/page.tsx", import.meta.url), "utf8");
  const mapper = readFileSync(new URL("../src/domains/growth/public-pricing.ts", import.meta.url), "utf8");
  assert.match(page, /WaitlistForm/);
  assert.doesNotMatch(page, /\/register\?plan=|€|onClick|7900|34900/);
  assert.doesNotMatch(mapper, /7900|34900|1111/);
  const publicNav = readFileSync(new URL("../src/features/landing/public-top-navbar.tsx", import.meta.url), "utf8");
  assert.match(publicNav, /href: "\/tarifs"/);
  const wizard = readFileSync(new URL("../src/features/auth/signup-wizard.tsx", import.meta.url), "utf8");
  assert.match(wizard, /signupEntryFromSearch/);
});

test("l'entrée d'inscription n'accepte qu'une formule du catalogue", () => {
  assert.deepEqual(signupEntryFromSearch("?plan=PRO&interval=ANNUAL"), { planCode: "PRO", billingInterval: "ANNUAL" });
  assert.deepEqual(signupEntryFromSearch("plan=BUSINESS"), { planCode: "BUSINESS", billingInterval: "MONTHLY" });
  assert.equal(signupEntryFromSearch("?plan=PILOT"), null);
  assert.equal(signupEntryFromSearch(""), null);
});
