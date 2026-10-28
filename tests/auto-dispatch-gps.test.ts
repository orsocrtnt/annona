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
import type { DispatchProximity } from "../src/lib/dispatch/dispatch-proximity";

type Row = Record<string, unknown>;
type Pick = { driverId: string; reason: string } | null;
type Service = {
  resolveDriverForDelivery: (
    delivery: Row, settings: Row, drivers: Row[], zones: Row[], proximities?: Map<string, DispatchProximity>
  ) => Pick;
  tryAutoAssignDelivery: (company: string, id: string) => Promise<Row>;
  getEligibleDriversForDelivery: (company: string, id: string) => Promise<Row[] | null>;
};

function load(deps: { prisma?: Row; settings?: Row; drivers?: Row[]; assign?: (...args: unknown[]) => Promise<unknown>; zone?: Row | null }) {
  const module = { exports: {} };
  const all: Record<string, unknown> = {
    "@/services/prisma/client": { prisma: deps.prisma ?? {} },
    "@/domains/company/dispatch-settings.service": { getCompanyDispatchSettings: async () => deps.settings },
    "@/domains/company/tariff-settings.service": { getCompanyTariffSettings: async () => ({ tariffZones: [] }) },
    "@/lib/tariff/find-tariff-zone": { findTariffZoneForPostalCode: () => deps.zone ?? null },
    "@/domains/delivery/delivery.service": {
      getCompanyDriversWithActivity: async () => deps.drivers ?? [],
      assignDeliveryToDriver: deps.assign ?? (async () => undefined),
    },
    "@/lib/dispatch/driver-eligibility": eligibility,
    "@/lib/dispatch/dispatch-proximity": proximityLib,
    "@/domains/tracking/tracking.policy": trackingPolicy,
    "@/lib/query/list-limits": { AUTO_DISPATCH_QUEUE_TAKE: 100 },
    "@/lib/validations/dispatch-settings": dispatchSettings,
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

function connectedFixture(options: { delivery?: Row; settings?: Row } = {}) {
  const calls: string[] = [];
  const userQueries: Row[] = [];
  let current: Row = { ...delivery, pickupLatitude: 48.8532, pickupLongitude: 2.3692, ...options.delivery };
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
    delivery: { findFirst: async ({ where }: { where: Row }) => (where.companyId === "company" && where.id === current.id ? { ...current } : null) },
    user: {
      findMany: async ({ where }: { where: { companyId: string; id: { in: string[] } } }) => {
        calls.push("positions"); userQueries.push(where);
        return users.filter((u) => u.companyId === where.companyId && where.id.in.includes(u.id));
      },
    },
  };
  const svc = load({
    prisma,
    settings: { ...settings, ...options.settings },
    drivers: [{ id: "offduty", assigned: 0 }, { id: "close", assigned: 0 }, { id: "idle", assigned: 0 }],
    assign: async (...args: unknown[]) => { calls.push(`assign:${args[2]}:${(args[3] as Row).reason}`); current = { ...current, driverId: args[2], status: "ASSIGNED" }; },
  });
  return { svc, calls, userQueries };
}

test("dispatch GPS : positions lues hors transaction, restreintes à l'entreprise, distance et âge dans la réponse", async () => {
  const f = connectedFixture();
  const result = await f.svc.tryAutoAssignDelivery("company", "d1");
  assert.equal(result.assigned, true);
  assert.equal(result.driverId, "close");
  const proximity = result.proximity as DispatchProximity;
  assert.equal(proximity.status, "NEAR");
  assert.ok(proximity.distanceMeters! > 1000 && proximity.distanceMeters! < 1200);
  assert.ok(proximity.positionAgeSeconds! >= 89 && proximity.positionAgeSeconds! <= 95);
  assert.deepEqual(f.calls.map((c) => c.split(":")[0]), ["positions", "assign"], "distances calculées avant l'affectation, une seule affectation");
  assert.doesNotMatch(f.calls[1]!, NO_NUMBERS_ABOUT_POSITION);
  const where = f.userQueries[0] as Row;
  assert.equal(where.companyId, "company");
  assert.equal(JSON.stringify(where.role), JSON.stringify({ systemRole: "DRIVER" }));
  assert.equal(where.status, "ACTIVE");
  assert.doesNotMatch(JSON.stringify(result), /latitude|longitude|48\.8|2\.36/);
});

test("dispatch GPS : dispatch relancé sur une livraison déjà affectée → aucun calcul ni seconde affectation", async () => {
  const f = connectedFixture();
  await f.svc.tryAutoAssignDelivery("company", "d1");
  const again = await f.svc.tryAutoAssignDelivery("company", "d1");
  assert.equal(again.assigned, false);
  assert.equal(again.skippedReason, "Déjà assignée");
  assert.equal(f.calls.filter((c) => c.startsWith("assign")).length, 1);
  assert.equal(f.calls.filter((c) => c === "positions").length, 1);
});

test("dispatch GPS : critère désactivé → aucune lecture de position, ancien choix", async () => {
  const f = connectedFixture({ settings: { gpsProximityEnabled: false } });
  const result = await f.svc.tryAutoAssignDelivery("company", "d1");
  assert.equal(result.driverId, "offduty", "ancien algorithme : premier des moins chargés");
  assert.equal((result.proximity as DispatchProximity).status, "DISABLED");
  assert.equal(f.calls.includes("positions"), false);
});

test("dispatch GPS : retrait non géolocalisé → repli sur les critères actuels, sans exclusion", async () => {
  const f = connectedFixture({ delivery: { pickupLatitude: null, pickupLongitude: null } });
  const result = await f.svc.tryAutoAssignDelivery("company", "d1");
  assert.equal(result.assigned, true);
  assert.equal(result.driverId, "offduty");
  assert.equal((result.proximity as DispatchProximity).status, "OFF_DUTY");
});

test("dispatch GPS : éligibles du dispatcher avec distance et âge, sans coordonnées ni livreur étranger", async () => {
  const f = connectedFixture();
  const rows = await f.svc.getEligibleDriversForDelivery("company", "d1");
  assert.ok(rows);
  const byId = new Map(rows.map((row) => [(row.driver as Row).id as string, row.proximity as DispatchProximity]));
  assert.equal(byId.get("close")?.status, "NEAR");
  assert.equal(byId.get("offduty")?.status, "OFF_DUTY");
  assert.equal(byId.get("offduty")?.distanceMeters, null);
  assert.equal(byId.get("idle")?.status, "NO_POSITION");
  assert.equal(byId.has("foreign"), false);
  assert.doesNotMatch(JSON.stringify(rows), /latitude|longitude|48\.8|2\.36/);
  assert.equal(await f.svc.getEligibleDriversForDelivery("other", "d1"), null, "autre entreprise : livraison introuvable");
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
