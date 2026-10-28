import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { optionMaxQuantity, type BillingOption, type BillingPlan } from "../src/features/back-office/subscription-api";

const seats = (driverMax: number | null) => ({
  DRIVER_SEAT: { included: 20, max: driverMax },
  ADMIN_SEAT: { included: 1, max: 3 },
  DISPATCHER_SEAT: { included: 2, max: 2 },
});
const plan = (code: BillingPlan["code"], includedFeatures: string[] = [], driverMax: number | null = 50): BillingPlan =>
  ({ code, name: code, monthlyPriceCents: 0, annualPriceCents: 0, includedFeatures, seats: seats(driverMax) });
const option = (kind: BillingOption["kind"], patch: Partial<BillingOption> = {}): BillingOption =>
  ({ code: kind, name: kind, kind, featureKey: null, applicablePlans: ["STARTER", "PRO", "BUSINESS"], monthlyPriceCents: 900, annualPriceCents: 10800, ...patch });

test("SAAS-03 : plafond d'une option selon la formule, comme le devis serveur", () => {
  assert.equal(optionMaxQuantity(option("OPTION", { featureKey: "auto_dispatch" }), plan("STARTER")), 1);
  assert.equal(optionMaxQuantity(option("OPTION", { featureKey: "auto_dispatch" }), plan("PRO", ["auto_dispatch"])), 0, "fonction déjà incluse");
  assert.equal(optionMaxQuantity(option("OPTION", { applicablePlans: ["BUSINESS"] }), plan("PRO")), 0, "option d'une autre formule");
  assert.equal(optionMaxQuantity(option("DRIVER_SEAT"), plan("BUSINESS")), 30, "Business : 20 inclus, 50 au plus");
  assert.equal(optionMaxQuantity(option("DRIVER_SEAT"), plan("BUSINESS", [], null)), 500, "sans plafond : borne de saisie du serveur");
  assert.equal(optionMaxQuantity(option("ADMIN_SEAT"), plan("PRO")), 2);
  assert.equal(optionMaxQuantity(option("DISPATCHER_SEAT"), plan("PRO")), 0, "plafond déjà atteint par les comptes inclus");
});

test("SAAS-03 : l'API expose noms, prix et plafonds sans identifiant interne, et l'écran passe par l'aperçu serveur", () => {
  const route = readFileSync(resolve("src/app/api/billing/route.ts"), "utf8");
  assert.match(route, /seats: \{\s*DRIVER_SEAT: \{ included: plan\.includedDriverSeats, max: plan\.unlimitedDriverSeats \? null : plan\.maxDriverSeats \}/);
  assert.match(route, /options = catalog\?\.options\.map\(\(option\) => \(\{ code: option\.code, name: option\.name, kind: option\.kind,/);
  assert.doesNotMatch(route.slice(route.indexOf("const options ="), route.indexOf("const active =")), /option\.id\b/);
  const ui = readFileSync(resolve("src/features/back-office/subscription-options.tsx"), "utf8");
  assert.match(ui, /subscriptionApi\.preview\(selection!\)/);
  assert.match(ui, /subscriptionApi\.change\(selection!, key, preview\.data!\)/);
  assert.match(ui, /if \(!subscription\.canChange\) return null;/);
});
