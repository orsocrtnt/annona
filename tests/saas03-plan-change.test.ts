import assert from "node:assert/strict";
import test from "node:test";
import { assessPlanChange, type PlanChangeInput, type PlanChangeTarget } from "../src/domains/billing/plan-change";

// Valeurs du catalogue C9 actif (prisma/migrations/*_catalog_c8_prices et *_catalog_c9_business).
const STARTER: PlanChangeTarget = {
  code: "STARTER", includedDriverSeats: 5, unlimitedDriverSeats: false, maxDriverSeats: 10,
  includedAdminSeats: 1, maxAdminSeats: null, includedDispatcherSeats: 0, maxDispatcherSeats: null,
  includedMonthlyOrders: 1000, includedFeatures: [],
};
const PRO: PlanChangeTarget = {
  code: "PRO", includedDriverSeats: 10, unlimitedDriverSeats: false, maxDriverSeats: 30,
  includedAdminSeats: 1, maxAdminSeats: null, includedDispatcherSeats: 1, maxDispatcherSeats: null,
  includedMonthlyOrders: 3000, includedFeatures: ["auto_dispatch", "admin_gps"],
};
const BUSINESS: PlanChangeTarget = {
  code: "BUSINESS", includedDriverSeats: 20, unlimitedDriverSeats: false, maxDriverSeats: 50,
  includedAdminSeats: 2, maxAdminSeats: null, includedDispatcherSeats: 1, maxDispatcherSeats: null,
  includedMonthlyOrders: 6000,
  includedFeatures: ["auto_dispatch", "admin_gps", "client_gps", "advanced_analytics", "priority_support"],
};

const driverPro = { code: "DRIVER_PRO", kind: "DRIVER_SEAT", quantity: 2, featureKey: null, applicablePlans: ["PRO"] } as const;
const driverStarter = { code: "DRIVER_STARTER", kind: "DRIVER_SEAT", quantity: 3, featureKey: null, applicablePlans: ["STARTER"] } as const;
const clientGps = { code: "CLIENT_GPS", kind: "OPTION", quantity: 1, featureKey: "client_gps", applicablePlans: ["STARTER", "PRO"] } as const;
const autoDispatch = { code: "AUTO_DISPATCH", kind: "OPTION", quantity: 1, featureKey: "auto_dispatch", applicablePlans: ["STARTER"] } as const;
const adminExtra = { code: "ADMIN_EXTRA", kind: "ADMIN_SEAT", quantity: 1, featureKey: null, applicablePlans: ["STARTER", "PRO", "BUSINESS"] } as const;
const dispatcherAll = { code: "DISPATCHER_ALL", kind: "DISPATCHER_SEAT", quantity: 2, featureKey: null, applicablePlans: ["STARTER", "PRO", "BUSINESS"] } as const;

function input(overrides: Partial<PlanChangeInput>): PlanChangeInput {
  return {
    currentPlanCode: "PRO",
    currentPlanFeatures: PRO.includedFeatures,
    items: [],
    usage: { drivers: 0, admins: 1, dispatchers: 0, monthlyOrders: 0 },
    target: STARTER,
    ...overrides,
  };
}

test("SAAS-03 : Pro → Starter décrit dépassements, sièges incompatibles et fonctions perdues, au renouvellement", () => {
  const result = assessPlanChange(input({
    items: [driverPro, clientGps],
    usage: { drivers: 8, admins: 1, dispatchers: 1, monthlyOrders: 2500 },
  }));
  assert.equal(result.direction, "DOWNGRADE");
  assert.equal(result.timing, "AT_RENEWAL");
  assert.deepEqual(result.limits, { drivers: 5, admins: 1, dispatchers: 0 }, "le siège Pro ne compte pas en Starter");
  assert.deepEqual(result.blockers, [
    { resource: "drivers", current: 8, limit: 5, excess: 3 },
    { resource: "dispatchers", current: 1, limit: 0, excess: 1 },
  ]);
  assert.deepEqual(result.droppedItems, [{ code: "DRIVER_PRO", kind: "DRIVER_SEAT", quantity: 2 }]);
  assert.deepEqual(result.lostFeatures, ["admin_gps", "auto_dispatch"], "l'option GPS client compatible est conservée");
  assert.deepEqual(result.orderOverage, { current: 2500, included: 1000, overage: 1500 }, "dépassement signalé, non bloquant");
  assert.equal(result.allowed, false);
});

test("SAAS-03 : Starter → Pro est immédiat après prorata ; l'option incluse dans Pro ne fait perdre aucune fonction", () => {
  const result = assessPlanChange(input({
    currentPlanCode: "STARTER",
    currentPlanFeatures: [],
    items: [autoDispatch, driverStarter],
    usage: { drivers: 8, admins: 1, dispatchers: 0, monthlyOrders: 900 },
    target: PRO,
  }));
  assert.equal(result.direction, "UPGRADE");
  assert.equal(result.timing, "IMMEDIATE_AFTER_PRORATA");
  assert.deepEqual(result.droppedItems.map((item) => item.code), ["AUTO_DISPATCH", "DRIVER_STARTER"]);
  assert.deepEqual(result.lostFeatures, [], "auto_dispatch est inclus dans Pro");
  assert.equal(result.limits.drivers, 10);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.orderOverage, null);
  assert.equal(result.allowed, true);
});

test("SAAS-03 : Business → Pro garde les sièges compatibles et plafonne au maximum de la cible", () => {
  const result = assessPlanChange(input({
    currentPlanCode: "BUSINESS",
    currentPlanFeatures: BUSINESS.includedFeatures,
    items: [adminExtra, dispatcherAll],
    usage: { drivers: 25, admins: 2, dispatchers: 3, monthlyOrders: 0 },
    target: PRO,
  }));
  assert.deepEqual(result.limits, { drivers: 10, admins: 2, dispatchers: 3 });
  assert.deepEqual(result.blockers, [{ resource: "drivers", current: 25, limit: 10, excess: 15 }]);
  assert.deepEqual(result.lostFeatures, ["advanced_analytics", "client_gps", "priority_support"]);

  const capped = assessPlanChange(input({
    currentPlanCode: "STARTER",
    currentPlanFeatures: [],
    items: [{ ...driverStarter, quantity: 8 }],
    usage: { drivers: 10, admins: 1, dispatchers: 0, monthlyOrders: 0 },
    target: STARTER,
  }));
  assert.equal(capped.limits.drivers, 10, "5 inclus + 8 achetés restent plafonnés à 10");
});

test("SAAS-03 : même formule et livreurs illimités", () => {
  const same = assessPlanChange(input({ target: PRO }));
  assert.equal(same.direction, "SAME");
  assert.equal(same.timing, "NONE");
  assert.equal(same.allowed, false, "aucun changement à appliquer");

  const unlimited = assessPlanChange(input({
    usage: { drivers: 400, admins: 1, dispatchers: 0, monthlyOrders: 0 },
    target: { ...BUSINESS, unlimitedDriverSeats: true, maxDriverSeats: null },
  }));
  assert.equal(unlimited.limits.drivers, null);
  assert.deepEqual(unlimited.blockers, []);
});

test("SAAS-03 : l'évaluation est pure et ne modifie pas son entrée", () => {
  const value = input({ items: [driverPro, clientGps], usage: { drivers: 8, admins: 1, dispatchers: 1, monthlyOrders: 2500 } });
  const snapshot = JSON.stringify(value);
  const first = assessPlanChange(value);
  assert.equal(JSON.stringify(value), snapshot);
  assert.deepEqual(assessPlanChange(value), first);
});
