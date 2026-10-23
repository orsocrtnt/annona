import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSessionSeatMeter,
  canInviteSaasSeat,
  hasSaasFeature,
  hasSaasSeat,
  isOfferAccessPending,
  lockedOfferReason,
  seatRemainingLabel,
  unlockedSessionSaasAccess,
  type SessionSaasAccess,
} from "../src/domains/saas/saas-access";
import { OFFER_ENVIRONMENTS } from "../src/domains/saas/offer-environments";
import { applyOfferNavLocks } from "../src/features/saas/offer-nav";

function commercial(
  planCode: SessionSaasAccess["planCode"],
  features: string[],
  dispatchers: number
): SessionSaasAccess {
  return {
    kind: "COMMERCIAL",
    planCode,
    features,
    limits: { drivers: 5, admins: 1, dispatchers, monthlyOrders: 1000 },
    canCreateOrders: true,
    canMutate: true,
  };
}

const nav: Array<{ href: string; title: string; disabled?: boolean; disabledReason?: string }> = [
  { href: "/dashboard", title: "Tableau de bord" },
  { href: "/dashboard/analytics", title: "Analyse" },
  { href: "/dispatch", title: "Dispatch" },
  { href: "/dispatch/map", title: "Carte livraison" },
  { href: "/dispatch/drivers", title: "Carte chauffeurs" },
  { href: "/portal/deliveries", title: "Livraisons" },
];

test("offre : Starter sans option laisse le cœur actif et grise le reste", () => {
  const locked = applyOfferNavLocks(nav, commercial("STARTER", [], 0));
  assert.equal(locked.find((item) => item.href === "/dashboard")?.disabled, undefined);
  assert.equal(locked.find((item) => item.href === "/dispatch")?.disabled, undefined);
  assert.equal(locked.find((item) => item.href === "/dashboard/analytics")?.disabled, true);
  assert.equal(locked.find((item) => item.href === "/dispatch/map")?.disabled, true);
  assert.equal(locked.find((item) => item.href === "/dispatch/drivers")?.disabled, true);
  assert.equal(locked.find((item) => item.href === "/portal/deliveries")?.disabled, true);
  assert.match(
    locked.find((item) => item.href === "/dashboard/analytics")?.disabledReason ?? "",
    /Starter/
  );
});

test("offre : Starter + dispatcher débloque le siège sans ouvrir les options logicielles", () => {
  const starter = commercial("STARTER", [], 0);
  const withDispatcher = commercial("STARTER", [], 1);
  assert.equal(hasSaasSeat(starter, "dispatchers"), false);
  assert.equal(hasSaasSeat(withDispatcher, "dispatchers"), true);
  assert.equal(hasSaasFeature(withDispatcher, "auto_dispatch"), false);
  assert.equal(hasSaasFeature(withDispatcher, "admin_gps"), false);
});

test("offre : Pro inclut dispatch auto et GPS admin, pas la carte client", () => {
  const pro = applyOfferNavLocks(
    nav,
    commercial("PRO", ["auto_dispatch", "admin_gps"], 1)
  );
  assert.equal(pro.find((item) => item.href === "/dispatch/map")?.disabled, undefined);
  assert.equal(pro.find((item) => item.href === "/dispatch/drivers")?.disabled, undefined);
  assert.equal(pro.find((item) => item.href === "/dashboard/analytics")?.disabled, true);
  assert.equal(pro.find((item) => item.href === "/portal/deliveries")?.disabled, true);
});

test("offre : tant que la session n’est pas chargée, on n’ouvre pas les options", () => {
  assert.equal(isOfferAccessPending(null, true), true);
  assert.equal(isOfferAccessPending(null, false), false);
  assert.equal(isOfferAccessPending(commercial("STARTER", [], 0), true), false);
});

test("offre : Business et démo/historique ne grisent rien", () => {
  const business = applyOfferNavLocks(
    nav,
    commercial("BUSINESS", [
      "auto_dispatch",
      "admin_gps",
      "client_gps",
      "advanced_analytics",
      "priority_support",
    ], 1)
  );
  assert.equal(business.some((item) => item.disabled), false);
  assert.equal(applyOfferNavLocks(nav, unlockedSessionSaasAccess()).some((item) => item.disabled), false);
  assert.equal(applyOfferNavLocks(nav, null).some((item) => item.disabled), false);
  assert.equal(hasSaasFeature(null, "admin_gps"), true);
});

test("offre : les environnements recette couvrent Starter nu, Starter + dispatcher, Pro et Business", () => {
  assert.deepEqual(
    OFFER_ENVIRONMENTS.map((environment) => ({
      key: environment.key,
      planCode: environment.planCode,
      optionCodes: environment.optionCodes,
    })),
    [
      { key: "starter", planCode: "STARTER", optionCodes: [] },
      { key: "starter-dispatcher", planCode: "STARTER", optionCodes: ["DISPATCHER_ALL"] },
      { key: "pro", planCode: "PRO", optionCodes: [] },
      { key: "business", planCode: "BUSINESS", optionCodes: [] },
    ]
  );
  assert.match(lockedOfferReason("auto_dispatch", "STARTER"), /Dispatch automatique/);
});

test("offre : un siège à 0 restant affiche le prix d’ajout et bloque l’invitation", () => {
  const starterDispatcher = buildSessionSeatMeter({
    used: 0,
    limit: 0,
    extraMonthlyPriceCents: 800,
  });
  assert.equal(starterDispatcher.remaining, 0);
  assert.equal(starterDispatcher.canAddExtra, true);
  assert.equal(canInviteSaasSeat(starterDispatcher), false);
  assert.match(seatRemainingLabel(starterDispatcher), /8,00/);

  const remainingDrivers = buildSessionSeatMeter({ used: 2, limit: 5, hardMax: 10, extraMonthlyPriceCents: 1200 });
  assert.equal(remainingDrivers.remaining, 3);
  assert.equal(canInviteSaasSeat(remainingDrivers), true);
  assert.match(seatRemainingLabel(remainingDrivers), /3 postes restants/);

  const driverCap = buildSessionSeatMeter({ used: 10, limit: 10, hardMax: 10, extraMonthlyPriceCents: 1200 });
  assert.equal(driverCap.canAddExtra, false);
  assert.equal(seatRemainingLabel(driverCap), "Plafond atteint");

  const unlimited = buildSessionSeatMeter({ used: 40, limit: null });
  assert.equal(unlimited.remaining, null);
  assert.equal(canInviteSaasSeat(unlimited), true);
});
