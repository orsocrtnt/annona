import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as eligibility from "../src/lib/dispatch/driver-eligibility";
import * as proximityLib from "../src/lib/dispatch/dispatch-proximity";
import * as trackingPolicy from "../src/domains/tracking/tracking.policy";
import * as dispatchSettings from "../src/lib/validations/dispatch-settings";
import * as dispatchScore from "../src/lib/dispatch/dispatch-score";
import * as travelTime from "../src/lib/dispatch/travel-time";
import type { DispatchProximity } from "../src/lib/dispatch/dispatch-proximity";

type Row = Record<string, unknown>;
type Pick = { driverId: string; reason: string } | null;
type Service = {
  resolveDriverForDelivery: (
    delivery: Row, settings: Row, drivers: Row[], zones: Row[], proximities?: Map<string, DispatchProximity>
  ) => Pick;
  tryAutoAssignDelivery: (company: string, id: string) => Promise<Row>;
  runAutoDispatchQueue: (company: string) => Promise<{ assigned: number; skipped: number; results: Row[] }>;
  getEligibleDriversForDelivery: (company: string, id: string) => Promise<Row[] | null>;
};

type GetDrivers = (companyId: string, options?: { withDispatchPosition?: boolean }) => Promise<Row[]>;
function load(deps: { prisma?: Row; settings?: Row; drivers?: Row[]; getDrivers?: GetDrivers; assign?: (...args: unknown[]) => Promise<unknown>; zone?: Row | null }) {
  const module = { exports: {} };
  const all: Record<string, unknown> = {
    "@/services/prisma/client": { prisma: deps.prisma ?? {} },
    "@/domains/company/dispatch-settings.service": { getCompanyDispatchSettings: async () => deps.settings },
    "@/domains/company/tariff-settings.service": { getCompanyTariffSettings: async () => ({ tariffZones: [] }) },
    "@/lib/tariff/find-tariff-zone": { findTariffZoneForPostalCode: () => deps.zone ?? null },
    "@/domains/delivery/delivery.service": {
      getCompanyDriversWithActivity: deps.getDrivers ?? (async () => deps.drivers ?? []),
      assignDeliveryToDriver: deps.assign ?? (async () => undefined),
    },
    "@/lib/dispatch/driver-eligibility": eligibility,
    "@/lib/dispatch/dispatch-proximity": proximityLib,
    "@/domains/tracking/tracking.policy": trackingPolicy,
    "@/lib/query/list-limits": { AUTO_DISPATCH_QUEUE_TAKE: 100 },
    "@/lib/validations/dispatch-settings": dispatchSettings,
    "@/lib/dispatch/dispatch-score": dispatchScore,
    "@/lib/dispatch/travel-time": travelTime,
  };
  runInNewContext(ts.transpileModule(readFileSync(resolve("src/domains/delivery/auto-dispatch.service.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { Date, Math, Map, Set, Error, Promise, console, exports: module.exports, module,
    require: (id: string) => { assert.ok(id in all, id); return all[id]; } });
  return module.exports as Service;
}

const base = dispatchSettings.DEFAULT_DISPATCH_SETTINGS;
const settings = { ...base, enabled: true };
const delivery = { id: "d1", driverId: null, status: "PENDING", deliveryCategory: "STANDARD", postalCode: "75011", pickupPostalCode: null, createdAt: new Date() };
const near = (distanceMeters: number): DispatchProximity => ({ status: "NEAR", distanceMeters, positionAgeSeconds: 60 });
const neutral = (status: DispatchProximity["status"]): DispatchProximity => ({ status, distanceMeters: null, positionAgeSeconds: null });
const rule = (driverId: string, priority: number) => dispatchSettings.normalizeDispatchDriverRule({ driverId, priority });
const NO_NUMBERS_ABOUT_POSITION = /km|\d+\s?m\b|min|position/i;

test("dispatch GPS : sans règle, à charge égale, le livreur proche du retrait passe avant un livreur sans position", () => {
  const svc = load({});
  const drivers = [{ id: "idle", assigned: 0 }, { id: "close", assigned: 0 }];
  const pick = svc.resolveDriverForDelivery(delivery, settings, drivers, [], new Map([["close", near(900)], ["idle", neutral("NO_POSITION")]]));
  assert.equal(pick?.driverId, "close");
  assert.equal(pick!.reason, "Chauffeur le moins chargé (0 active(s)) · plus proche du point de retrait");
  assert.doesNotMatch(pick!.reason, NO_NUMBERS_ABOUT_POSITION, "raison stockée dans l'historique visible du client : aucune distance");
});

test("dispatch GPS : aucune position exploitable → choix identique à l'ancien algorithme", () => {
  const svc = load({});
  const drivers = [{ id: "busy", assigned: 2 }, { id: "idle", assigned: 0 }];
  const legacy = svc.resolveDriverForDelivery(delivery, settings, drivers, []);
  assert.equal(legacy?.driverId, "idle");
  for (const status of ["NO_POSITION", "STALE", "OFF_DUTY", "NO_PICKUP", "DISABLED", "FAR"] as const) {
    const pick = svc.resolveDriverForDelivery(delivery, settings, drivers, [], new Map([["busy", neutral(status)], ["idle", neutral(status)]]));
    assert.deepEqual(pick, legacy, status);
  }
  // Un livreur loin ou périmé n'est jamais pénalisé face à un livreur sans position.
  const mixed = svc.resolveDriverForDelivery(delivery, settings, [{ id: "a", assigned: 0 }, { id: "b", assigned: 1 }], [], new Map([["a", { status: "FAR", distanceMeters: 40_000, positionAgeSeconds: 5 }], ["b", neutral("NO_POSITION")]]));
  assert.equal(mixed?.driverId, "a");
});

test("dispatch GPS : le plus proche gagne ; à distance égale, la charge départage", () => {
  const svc = load({});
  const drivers = [{ id: "far", assigned: 0 }, { id: "nearest", assigned: 0 }];
  assert.equal(svc.resolveDriverForDelivery(delivery, settings, drivers, [], new Map([["far", near(2300)], ["nearest", near(900)]]))?.driverId, "nearest");
  const tie = [{ id: "loaded", assigned: 2 }, { id: "free", assigned: 0 }];
  const pick = svc.resolveDriverForDelivery(delivery, settings, tie, [], new Map([["loaded", near(1100)], ["free", near(1100)]]));
  assert.equal(pick?.driverId, "free");
  assert.doesNotMatch(pick!.reason, /plus proche/, "égalité : la distance n'a pas décidé");
});

test("dispatch GPS : un livreur proche mais ineligible (pause, charge max) reste écarté", () => {
  const svc = load({});
  const paused = { ...settings, driverRules: [{ ...rule("close", 1), dispatchStatus: "PAUSED" }] };
  const drivers = [{ id: "close", assigned: 0 }, { id: "other", assigned: 0 }];
  assert.equal(svc.resolveDriverForDelivery(delivery, paused, drivers, [], new Map([["close", near(100)]])), null, "règles explicites : seul un livreur listé et actif est choisi");
  const full = svc.resolveDriverForDelivery(delivery, { ...settings, maxActiveDeliveriesPerDriver: 1 }, [{ id: "close", assigned: 1 }, { id: "other", assigned: 0 }], [], new Map([["close", near(100)]]));
  assert.equal(full?.driverId, "other");
});

test("dispatch GPS : « moins chargé » garde la charge en premier, la distance départage à charge égale", () => {
  const svc = load({});
  const least = { ...settings, strategy: "LEAST_LOADED" };
  assert.equal(svc.resolveDriverForDelivery(delivery, least, [{ id: "free", assigned: 0 }, { id: "close", assigned: 1 }], [], new Map([["close", near(200)]]))?.driverId, "free");
  const pick = svc.resolveDriverForDelivery(delivery, least, [{ id: "a", assigned: 0 }, { id: "b", assigned: 0 }], [], new Map([["a", near(2300)], ["b", near(900)]]));
  assert.equal(pick?.driverId, "b");
  assert.match(pick!.reason, /^Moins chargé : 0 livraison\(s\) active\(s\) · plus proche du point de retrait$/);
});

test("dispatch GPS : la priorité explicite et le livreur de zone l'emportent sur la distance", () => {
  const svc = load({ zone: { id: "z1", name: "Est" } });
  const ranked = { ...settings, driverRules: [rule("first", 1), rule("second", 2)] };
  const drivers = [{ id: "first", assigned: 0 }, { id: "second", assigned: 0 }];
  assert.equal(svc.resolveDriverForDelivery(delivery, ranked, drivers, [], new Map([["second", near(100)]]))?.driverId, "first");
  const tied = { ...settings, driverRules: [rule("first", 1), rule("second", 1)] };
  const tiePick = svc.resolveDriverForDelivery(delivery, tied, drivers, [], new Map([["second", near(100)]]));
  assert.equal(tiePick?.driverId, "second");
  assert.equal(tiePick?.reason, "Priorité 1 (liste de priorité) · plus proche du point de retrait");
  assert.equal(svc.resolveDriverForDelivery(delivery, tied, drivers, [])?.driverId, "first", "sans GPS : ordre des règles conservé");
  const zoned = { ...settings, strategy: "ZONE_THEN_PRIORITY", zoneDriverMap: { z1: "first" } };
  assert.equal(svc.resolveDriverForDelivery(delivery, zoned, drivers, [], new Map([["second", near(100)]]))?.driverId, "first");
});

function connectedFixture(options: { delivery?: Row; settings?: Row; pending?: string[] } = {}) {
  const calls: string[] = [];
  const driverQueries: string[] = [];
  const deliveries = new Map<string, Row>(
    (options.pending ?? ["d1"]).map((id) => [id, { ...delivery, id, pickupLatitude: 48.8532, pickupLongitude: 2.3692, ...options.delivery }])
  );
  const fresh = new Date(Date.now() - 90_000);
  const onDuty = { trackingService: { active: true, startedAt: new Date().toISOString() } };
  const users = [
    // Hors service, juste à côté du retrait : sa position ne doit pas compter.
    { id: "offduty", companyId: "company", settings: {}, driverLocation: { latitude: 48.8533, longitude: 2.3692, updatedAt: fresh } },
    { id: "close", companyId: "company", settings: onDuty, driverLocation: { latitude: 48.8632, longitude: 2.3692, updatedAt: fresh } },
    { id: "idle", companyId: "company", settings: onDuty, driverLocation: null },
    { id: "foreign", companyId: "other", settings: onDuty, driverLocation: { latitude: 48.8532, longitude: 2.3692, updatedAt: fresh } },
  ];
  const prisma = {
    delivery: {
      findFirst: async ({ where }: { where: Row }) => {
        const row = deliveries.get(where.id as string);
        return row && where.companyId === "company" ? { ...row } : null;
      },
      findMany: async ({ where }: { where: Row }) =>
        where.companyId === "company" ? [...deliveries.values()].filter((row) => !row.driverId && row.status === "PENDING") : [],
    },
    // Ancienne seconde requête utilisateurs : ne doit plus servir.
    user: {
      findMany: async ({ where }: { where: { companyId: string; id: { in: string[] } } }) => {
        calls.push("positions-separate");
        return users.filter((u) => u.companyId === where.companyId && where.id.in.includes(u.id));
      },
    },
  };
  const svc = load({
    prisma,
    settings: { ...settings, ...options.settings },
    getDrivers: async (companyId, opts) => {
      const kind = opts?.withDispatchPosition ? "drivers+positions" : "drivers";
      calls.push(kind); driverQueries.push(kind);
      return users
        .filter((u) => u.companyId === companyId)
        .map((u) => ({ id: u.id, firstName: u.id, assigned: 0, ...(opts?.withDispatchPosition ? { settings: u.settings, driverLocation: u.driverLocation } : {}) }));
    },
    assign: async (...args: unknown[]) => {
      calls.push(`assign:${args[2]}:${(args[3] as Row).reason}`);
      const row = deliveries.get(args[1] as string)!;
      deliveries.set(args[1] as string, { ...row, driverId: args[2], status: "ASSIGNED" });
    },
  });
  return { svc, calls, driverQueries };
}

test("dispatch GPS (P9) : positions lues hors transaction ; ni distance ni âge dans le résultat d'affectation", async () => {
  const f = connectedFixture();
  const result = await f.svc.tryAutoAssignDelivery("company", "d1");
  assert.equal(result.assigned, true);
  assert.equal(result.driverId, "close");
  assert.equal("proximity" in result, false, "aucun écran ne le lit : rien n'est exposé dans les résultats de file");
  assert.deepEqual(f.calls.map((c) => c.split(":")[0]), ["drivers+positions", "assign"], "une seule requête livreurs, distances avant l'affectation, une seule affectation");
  assert.doesNotMatch(f.calls[1]!, NO_NUMBERS_ABOUT_POSITION);
  assert.doesNotMatch(JSON.stringify(result), /latitude|longitude|48\.8|2\.36/);
});

test("dispatch GPS : dispatch relancé sur une livraison déjà affectée → aucun calcul ni seconde affectation", async () => {
  const f = connectedFixture();
  await f.svc.tryAutoAssignDelivery("company", "d1");
  const again = await f.svc.tryAutoAssignDelivery("company", "d1");
  assert.equal(again.assigned, false);
  assert.equal(again.skippedReason, "Déjà assignée");
  assert.equal(f.calls.filter((c) => c.startsWith("assign")).length, 1);
  assert.deepEqual(f.driverQueries, ["drivers+positions"]);
});

test("dispatch GPS : critère désactivé → positions non lues, ancien choix", async () => {
  const f = connectedFixture({ settings: { gpsProximityEnabled: false } });
  const result = await f.svc.tryAutoAssignDelivery("company", "d1");
  assert.equal(result.driverId, "offduty", "ancien algorithme : premier des moins chargés");
  assert.doesNotMatch(String(result.reason), /plus proche/);
  assert.deepEqual(f.calls.map((c) => c.split(":")[0]), ["drivers", "assign"], "critère coupé : positions non lues");
});

test("dispatch GPS : retrait non géolocalisé → repli sur les critères actuels, sans exclusion", async () => {
  const f = connectedFixture({ delivery: { pickupLatitude: null, pickupLongitude: null } });
  const result = await f.svc.tryAutoAssignDelivery("company", "d1");
  assert.equal(result.assigned, true);
  assert.equal(result.driverId, "offduty");
  assert.doesNotMatch(String(result.reason), /plus proche/);
});

test("dispatch GPS : éligibles du dispatcher avec distance et âge, sans coordonnées ni livreur étranger", async () => {
  const f = connectedFixture();
  const rows = await f.svc.getEligibleDriversForDelivery("company", "d1");
  assert.ok(rows);
  const byId = new Map(rows.map((row) => [(row.driver as Row).id as string, row.proximity as DispatchProximity]));
  assert.equal(byId.get("close")?.status, "NEAR");
  assert.ok(byId.get("close")!.distanceMeters! > 1000 && byId.get("close")!.distanceMeters! < 1200);
  assert.ok(byId.get("close")!.positionAgeSeconds! >= 89 && byId.get("close")!.positionAgeSeconds! <= 95);
  assert.equal(byId.get("offduty")?.status, "OFF_DUTY");
  assert.equal(byId.get("offduty")?.distanceMeters, null);
  assert.equal(byId.get("idle")?.status, "NO_POSITION");
  assert.equal(byId.has("foreign"), false);
  assert.doesNotMatch(JSON.stringify(rows), /latitude|longitude|48\.8|2\.36/);
  assert.equal(await f.svc.getEligibleDriversForDelivery("other", "d1"), null, "autre entreprise : livraison introuvable");
});

test("dispatch GPS (P1) : des règles enregistrées sans champs GPS donnent la même affectation qu'avant hors égalité", () => {
  const svc = load({ zone: { id: "z1", name: "Est" } });
  const autoAssignCategories = { STANDARD: true, COURIER: true, SPECIAL_MISSION: false };
  const stored = [
    { enabled: true, strategy: "PRIORITY_LIST", autoAssignCategories },
    { enabled: true, strategy: "PRIORITY_LIST", autoAssignCategories, driverRules: [rule("a", 1), rule("b", 2), rule("c", 3)] },
    { enabled: true, strategy: "LEAST_LOADED", autoAssignCategories, driverRules: [rule("a", 1), rule("b", 5), rule("c", 3)] },
    { enabled: true, strategy: "LEAST_LOADED", autoAssignCategories },
    { enabled: true, strategy: "ZONE_THEN_PRIORITY", autoAssignCategories, zoneDriverMap: { z1: "c" } },
  ];
  const drivers = [{ id: "a", assigned: 0 }, { id: "b", assigned: 1 }, { id: "c", assigned: 2 }];
  // Le plus proche est toujours le livreur que l'ancien algorithme ne choisirait pas.
  const proximities = new Map([["a", neutral("NO_POSITION")], ["b", near(200)], ["c", near(300)]]);
  for (const raw of stored) {
    const parsed = dispatchSettings.companyDispatchSettingsSchema.parse(raw);
    assert.equal(parsed.gpsProximityEnabled, true, "option active par défaut");
    for (const category of ["STANDARD", "COURIER"]) {
      const target = { ...delivery, deliveryCategory: category };
      const before = svc.resolveDriverForDelivery(target, parsed, drivers, []);
      const after = svc.resolveDriverForDelivery(target, parsed, drivers, [], proximities);
      assert.deepEqual(after, before, `${raw.strategy} ${category} ${raw.driverRules ? "avec règles" : "sans règle"}`);
    }
  }
});

test("dispatch GPS (P2) : « moins chargé » — la priorité réglée passe avant la distance à charge égale", () => {
  const svc = load({});
  const least = { ...settings, strategy: "LEAST_LOADED", driverRules: [rule("A", 1), rule("B", 5)] };
  const drivers = [{ id: "A", assigned: 0 }, { id: "B", assigned: 0 }];
  for (const category of ["STANDARD", "COURIER"]) {
    const pick = svc.resolveDriverForDelivery({ ...delivery, deliveryCategory: category }, least, drivers, [], new Map([["B", near(150)]]));
    assert.equal(pick?.driverId, "A", category);
    assert.doesNotMatch(pick!.reason, /plus proche/);
  }
});

test("dispatch GPS (P3) : sans règle, la charge passe avant la distance", () => {
  const svc = load({});
  const roomy = { ...settings, maxActiveDeliveriesPerDriver: 10 };
  const drivers = [{ id: "A", assigned: 6 }, { id: "B", assigned: 0 }];
  const proximities = new Map([["A", near(9000)], ["B", { status: "FAR" as const, distanceMeters: 11_000, positionAgeSeconds: 60 }]]);
  const pick = svc.resolveDriverForDelivery(delivery, roomy, drivers, [], proximities);
  assert.equal(pick?.driverId, "B");
  assert.equal(pick?.reason, "Chauffeur le moins chargé (0 active(s))");
});

test("dispatch GPS (P4) : la liste des livreurs ne charge la position et l'état de service que sur demande, en une requête", async () => {
  const selects: Row[] = [];
  const prisma = {
    user: { findMany: async (args: { where: Row; select: Row }) => { selects.push(args); return [{ id: "drv", firstName: "A", lastName: "B", email: "a@b.test", phone: null, lastLoginAt: null, ...("driverLocation" in args.select ? { settings: {}, driverLocation: null } : {}) }]; } },
    delivery: { groupBy: async () => [], findMany: async () => [] },
  };
  const module = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(resolve("src/domains/delivery/delivery.service.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { Date, Math, Map, Set, Error, Promise, console, exports: module.exports, module,
    require: (id: string) => (id === "@/services/prisma/client" ? { prisma } : {}) });
  const { getCompanyDriversWithActivity } = module.exports as { getCompanyDriversWithActivity: (company: string, options?: Row) => Promise<Row[]> };
  const plain = await getCompanyDriversWithActivity("company");
  const withPosition = await getCompanyDriversWithActivity("company", { withDispatchPosition: true });
  assert.equal(selects.length, 2, "une requête utilisateurs par appel");
  assert.equal("driverLocation" in (selects[0]!.select as Row), false, "la liste /api/drivers ne lit aucune position");
  assert.equal("settings" in (selects[0]!.select as Row), false);
  assert.equal(JSON.stringify((selects[1]!.select as Row).driverLocation), JSON.stringify({ select: { latitude: true, longitude: true, updatedAt: true } }));
  assert.equal((selects[1]!.select as Row).settings, true);
  assert.equal(JSON.stringify(selects[0]!.where), JSON.stringify(selects[1]!.where), "même filtre entreprise / actif / livreur");
  assert.equal("driverLocation" in plain[0]!, false);
  assert.equal("driverLocation" in withPosition[0]!, true);
});

test("dispatch GPS (P5) : la file lit les positions une fois par passage et les réutilise", async () => {
  const f = connectedFixture({ pending: ["d1", "d2", "d3"] });
  const run = await f.svc.runAutoDispatchQueue("company");
  assert.equal(run.assigned, 3);
  assert.deepEqual(f.driverQueries, ["drivers+positions", "drivers", "drivers"], "charge relue à chaque livraison, positions une seule fois");
  const assigns = f.calls.filter((c) => c.startsWith("assign"));
  assert.equal(assigns.length, 3);
  for (const call of assigns) assert.match(call, /^assign:close:.*plus proche du point de retrait$/, "positions réutilisées pour chaque livraison");
  assert.equal(f.calls.includes("positions-separate"), false);
});

test("dispatch GPS (P6) : éligibles — positions lues dans le Promise.all, option appliquée ensuite, rien de brut renvoyé", async () => {
  const f = connectedFixture();
  const rows = await f.svc.getEligibleDriversForDelivery("company", "d1");
  assert.deepEqual(f.driverQueries, ["drivers+positions"]);
  assert.equal(f.calls.includes("positions-separate"), false);
  for (const row of rows!) {
    assert.equal("settings" in (row.driver as Row), false);
    assert.equal("driverLocation" in (row.driver as Row), false);
  }
  const off = connectedFixture({ settings: { gpsProximityEnabled: false } });
  const offRows = await off.svc.getEligibleDriversForDelivery("company", "d1");
  assert.deepEqual(offRows!.map((row) => (row.proximity as DispatchProximity).status), ["DISABLED", "DISABLED", "DISABLED"]);
});

test("dispatch GPS (P9) : la file ne renvoie aucune donnée de position", async () => {
  const f = connectedFixture({ pending: ["d1", "d2"] });
  const run = await f.svc.runAutoDispatchQueue("company");
  assert.doesNotMatch(JSON.stringify(run), /proximity|distance|positionAge/);
});
