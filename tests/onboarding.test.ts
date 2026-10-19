import assert from "node:assert/strict";
import test from "node:test";
import { buildCompanyOnboardingStatus } from "../src/domains/onboarding/onboarding.service";

test("ONBOARD-1 : une entreprise neuve voit les sept étapes à accomplir", () => {
  const result = buildCompanyOnboardingStatus({
    companyName: "Entreprise test",
    companyStatus: "TRIAL",
    settings: {},
    clientCount: 0,
    driverCount: 0,
    orderCount: 0,
    completedDeliveryCount: 0,
  });

  assert.equal(result.completedSteps, 0);
  assert.equal(result.totalSteps, 7);
  assert.equal(result.readyForInternalTest, false);
  assert.equal(result.steps.every((step) => !step.complete), true);
});

test("ONBOARD-1 : comptes, réglages et livraison réelle complètent le jalon interne", () => {
  const result = buildCompanyOnboardingStatus({
    companyName: "Entreprise test",
    companyStatus: "ACTIVE",
    settings: {
      deliveryCategories: { STANDARD: true, COURIER: false, SPECIAL_MISSION: false },
      billing: { courier: { minimumPrice: 10 } },
      dispatchRules: { enabled: false, driverRules: [] },
    },
    clientCount: 1,
    driverCount: 1,
    orderCount: 1,
    completedDeliveryCount: 1,
  });

  assert.equal(result.completedSteps, 7);
  assert.equal(result.readyForInternalTest, true);
  assert.equal(result.steps.every((step) => step.complete), true);
  assert.deepEqual(result.limits, {
    invitationEmailValidated: false,
    initialImportAvailable: false,
  });
});

test("ONBOARD-1 : une mission terminée ne masque pas l'absence de livreur", () => {
  const result = buildCompanyOnboardingStatus({
    companyName: "Entreprise test",
    companyStatus: "ACTIVE",
    settings: { deliveryOptions: {}, tariffs: {}, dispatch: {} },
    clientCount: 1,
    driverCount: 0,
    orderCount: 1,
    completedDeliveryCount: 1,
  });

  assert.equal(result.steps.find((step) => step.key === "driver")?.complete, false);
  assert.equal(result.steps.find((step) => step.key === "dispatch")?.complete, false);
  assert.equal(result.readyForInternalTest, false);
});
