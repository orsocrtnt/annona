import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as policy from "../src/domains/tracking/tracking.policy";
import * as live from "../src/lib/demo/demo-live-position";
import * as routeProgress from "../src/lib/maps/route-progress";
const { buildRouteTrack, pointAtDistance } = routeProgress;
import { DEFAULT_DRIVER_LOCATION_SETTINGS } from "../src/lib/validations/driver-location-settings";
import {
  DEMO_POSITION_CYCLE_MS,
  DEMO_SIGNAL_LAG_SECONDS,
  demoSignalLagSeconds,
  demoTripProgress,
  demoTripStart,
  isDemoCompanyForSimulation,
  pointAlongPolyline,
} from "../src/lib/demo/demo-live-position";

test("la simulation ne vise que les entreprises de démo", () => {
  assert.equal(isDemoCompanyForSimulation({ isDemo: true, slug: "logiexpress-demo" }), true);
  assert.equal(isDemoCompanyForSimulation({ isDemo: true, slug: "logiexpress-demo-pool-3" }), true);
  assert.equal(isDemoCompanyForSimulation({ isDemo: false, slug: "logiexpress-demo-pool-3" }), false, "drapeau démo absent");
  assert.equal(isDemoCompanyForSimulation({ isDemo: true, slug: "transports-martin" }), false, "slug hors démo");
  assert.equal(isDemoCompanyForSimulation(null), false);
});

test("l'avancement va de 8 % à 90 % puis revient, sans jamais atteindre la cible", () => {
  const startedAt = new Date("2026-10-26T10:00:00Z");
  const at = (fraction: number) => demoTripProgress(startedAt, new Date(startedAt.getTime() + fraction * DEMO_POSITION_CYCLE_MS));
  assert.ok(Math.abs(at(0) - 0.08) < 1e-9);
  assert.ok(Math.abs(at(0.5) - 0.9) < 1e-9, "au plus près à mi-cycle, sans arriver");
  assert.ok(at(0.25) > at(0) && at(0.75) < at(0.5), "aller puis retour");
  assert.equal(at(1), at(0), "cycle stable");
});

test("la position simulée reste sur le tracé routier", () => {
  // Tracé en L : 2 segments égaux. À 75 %, le point est au milieu du second segment.
  const polyline: [number, number][] = [[48.85, 2.3], [48.86, 2.3], [48.86, 2.3 + 0.01 / Math.cos((48.85 * Math.PI) / 180)]];
  const point = pointAlongPolyline(polyline, 0.75);
  assert.ok(Math.abs(point.latitude - 48.86) < 1e-9, "sur le second segment");
  assert.ok(point.longitude > 2.3 && point.longitude < polyline[2]![1]);
  assert.deepEqual(pointAlongPolyline(polyline, 0), { latitude: 48.85, longitude: 2.3 });
});

test("le départ simulé reste dans Paris, entre la cible et le centre", () => {
  const start = demoTripStart({ latitude: 48.85803, longitude: 2.28223 });
  assert.ok(start.longitude > 2.28223 && start.longitude < 2.3522, "vers le centre");
  const central = demoTripStart({ latitude: 48.857, longitude: 2.352 });
  assert.ok(Math.hypot(central.latitude - 48.857, central.longitude - 2.352) > 0.015, "décalé quand la cible est au centre");
});

test("les routes des cartes avancent les positions de démo sans bloquer la lecture", () => {
  for (const file of ["src/app/api/dispatch/map/route.ts", "src/app/api/dispatch/drivers-locations/route.ts", "src/app/api/dispatch/drivers-map/route.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /advanceDemoDriverPositions\(companyId\)\.catch\(/, file);
  }
});

test("un espace démo préparé avec une autre version du scénario est considéré comme dépassé", async () => {
  const { DEMO_SCENARIO_VERSION, isDemoScenarioOutdated } = await import("../src/lib/demo/constants");
  assert.equal(isDemoScenarioOutdated({ demoScenarioVersion: DEMO_SCENARIO_VERSION }), false);
  assert.equal(isDemoScenarioOutdated({ demoScenarioVersion: "ancienne" }), true);
  assert.equal(isDemoScenarioOutdated({}), true, "espace préparé avant le marquage");
  assert.equal(isDemoScenarioOutdated(null), true);
  const pool = readFileSync("src/domains/demo/demo-pool.service.ts", "utf8");
  assert.match(pool, /await queueOutdatedDemoPoolEnvironments\(now, poolKey\);/);
  assert.match(pool, /await ensureDemoSessionRosterUsers\(companyId\);\n\s*await resetDemoScenario\(companyId, now/);
});

test("démo : retard du signal lu dans les réglages, borné, absent par défaut", () => {
  assert.equal(demoSignalLagSeconds({ demoSignalLagSeconds: 180 }), 180);
  for (const settings of [null, {}, { demoSignalLagSeconds: "180" }, { demoSignalLagSeconds: Number.NaN }]) assert.equal(demoSignalLagSeconds(settings), 0);
  assert.equal(demoSignalLagSeconds({ demoSignalLagSeconds: -5 }), 0);
  assert.equal(demoSignalLagSeconds({ demoSignalLagSeconds: 99_999 }), 3600);
});

test("démo : trois livreurs en direct, un estimé, un au signal perdu", () => {
  const threshold = DEFAULT_DRIVER_LOCATION_SETTINGS.onlineThresholdSeconds;
  assert.equal(DEMO_SIGNAL_LAG_SECONDS.filter((lag) => lag === 0).length, 3);
  assert.equal(DEMO_SIGNAL_LAG_SECONDS.filter((lag) => lag > threshold && lag <= policy.ESTIMATION_MAX_SECONDS).length, 1);
  assert.equal(DEMO_SIGNAL_LAG_SECONDS.filter((lag) => lag > policy.ESTIMATION_MAX_SECONDS).length, 1);
});

function loadPositionsService(company: { isDemo: boolean; slug: string }, driverSettings: Record<string, unknown>, lastUpdate: Date | null) {
  const writes: any[] = [];
  const startedAt = new Date(Date.now() - 30 * 60_000);
  const prisma = {
    company: { findUnique: async () => company },
    delivery: { findMany: async () => [{ driverId: "driver", deliveryCategory: "STANDARD", missionStartedAt: startedAt, latitude: 48.85, longitude: 2.35, pickupLatitude: null, pickupLongitude: null, driver: { settings: driverSettings, driverLocation: lastUpdate ? { updatedAt: lastUpdate } : null } }] },
    user: { update: async (args: any) => { writes.push(["user", args]); } },
    driverLocation: { upsert: async (args: any) => { writes.push(["location", args]); } },
  };
  const deps: Record<string, unknown> = { "@/services/prisma/client": { prisma }, "@/domains/tracking/tracking.policy": policy, "@/lib/maps/osrm-route": { fetchOsrmRoute: async () => null }, "@/lib/maps/route-progress": routeProgress, "@/lib/demo/demo-live-position": live };
  const exportsObject = {};
  const sandbox = { module: { exports: exportsObject }, exports: exportsObject, Date, Math, Error, Map, Set, Promise, setTimeout, console, require: (id: string) => { assert.ok(id in deps, id); return deps[id]; } };
  runInNewContext(ts.transpileModule(readFileSync("src/domains/demo/demo-live-positions.service.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, sandbox);
  return { service: sandbox.module.exports as any, writes, startedAt };
}
const activeService = (extra: Record<string, unknown> = {}) => ({ trackingService: { active: true, startedAt: new Date(Date.now() - 3600_000).toISOString() }, ...extra });

test("démo : un livreur à retard reçoit la position qu'il avait alors, datée d'autant", async () => {
  const { service, writes, startedAt } = loadPositionsService({ isDemo: true, slug: "logiexpress-demo-pool-2" }, activeService({ demoSignalLagSeconds: 180 }), null);
  const now = new Date();
  assert.equal(await service.advanceDemoDriverPositions("c", now), 1);
  const upsert = writes.find((w) => w[0] === "location")[1];
  assert.equal(+upsert.update.updatedAt, +now - 180_000);
  const start = live.demoTripStart({ latitude: 48.85, longitude: 2.35 });
  const track = buildRouteTrack([[start.latitude, start.longitude], [48.85, 2.35]]);
  const expected = pointAtDistance(track, live.demoTripDistance(startedAt, new Date(+now - 180_000), track.length, policy.ESTIMATION_SPEED_KMH));
  assert.ok(Math.abs(upsert.update.latitude - expected[0]) < 1e-9);
});

test("démo : position déjà au bon retard non réécrite ; jamais datée avant le départ", async () => {
  const now = new Date();
  const upToDate = loadPositionsService({ isDemo: true, slug: "logiexpress-demo" }, activeService({ demoSignalLagSeconds: 180 }), new Date(+now - 182_000));
  assert.equal(await upToDate.service.advanceDemoDriverPositions("c", now), 0);
  const early = loadPositionsService({ isDemo: true, slug: "logiexpress-demo" }, activeService({ demoSignalLagSeconds: 120 }), null);
  await early.service.advanceDemoDriverPositions("c", new Date(+early.startedAt + 30_000));
  assert.equal(+early.writes.find((w) => w[0] === "location")[1].update.updatedAt, +early.startedAt + 1000);
});

test("démo : signal perdu, un seul relevé figé une minute après le départ, qui ne bouge plus", async () => {
  const now = new Date();
  const lost = loadPositionsService({ isDemo: true, slug: "logiexpress-demo" }, activeService({ demoSignalLagSeconds: 900 }), null);
  await lost.service.advanceDemoDriverPositions("c", now);
  const frozenAt = +lost.writes.find((w) => w[0] === "location")[1].update.updatedAt;
  assert.equal(frozenAt, +lost.startedAt + 60_000);
  const later = loadPositionsService({ isDemo: true, slug: "logiexpress-demo" }, activeService({ demoSignalLagSeconds: 900 }), new Date(frozenAt));
  assert.equal(await later.service.advanceDemoDriverPositions("c", new Date(+now + 5 * 60_000)), 0, "relevé figé : jamais réécrit");
});

test("démo : hors entreprise de démo, aucun retard ni position simulés", async () => {
  const { service, writes } = loadPositionsService({ isDemo: false, slug: "transports-martin" }, activeService({ demoSignalLagSeconds: 180 }), null);
  assert.equal(await service.advanceDemoDriverPositions("c"), 0);
  assert.equal(writes.length, 0);
});

test("démo : le livreur roule à la vitesse des cartes vers la cible, puis repart du début", () => {
  const startedAt = new Date("2026-10-27T10:00:00Z");
  const at = (seconds: number) => live.demoTripDistance(startedAt, new Date(+startedAt + seconds * 1000), 3000, 25);
  assert.equal(at(0), 240, "départ à 8 % du trajet");
  assert.ok(Math.abs(at(36) - (240 + 250)) < 1e-6, "25 km/h : 250 m en 36 s");
  assert.ok(at(120) > at(60) && at(60) > at(0), "toujours vers la cible");
  const cycle = (3000 * 0.82) / (25 / 3.6);
  assert.ok(at(cycle - 1) < 3000 * 0.9 + 1e-6, "jamais au-delà de 90 %");
  assert.ok(Math.abs(at(cycle + 1) - at(1)) < 1e-6, "repart du début");
  assert.equal(live.demoTripDistance(startedAt, new Date(+startedAt + 60_000), 0, 25), 0);
});
