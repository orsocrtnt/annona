import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function proximityModule(position: { latitude: number; longitude: number } | null, near: boolean, distance: number) {
  const module = { exports: {} as Record<string, (...args: unknown[]) => Promise<unknown>> };
  const source = ts.transpileModule(readFileSync("src/domains/delivery/driver-proximity.service.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const deps: Record<string, unknown> = {
    "@/services/prisma/client": { prisma: { driverLocation: { findUnique: async () => position } } },
    "@/domains/delivery/driver-navigation.service": {
      getDriverMissionNavigation: async () => ({ destination: { latitude: 40.76, longitude: -73.97 }, pickup: null, pickups: [] }),
    },
    "@/lib/maps/driver-proximity": { DRIVER_PROXIMITY_THRESHOLD_METERS: 200, isNearLocation: () => near },
    "@/lib/maps/navigation-utils": { haversineMeters: () => distance },
  };
  runInNewContext(source, { module, exports: module.exports, Error, require: (id: string) => deps[id] });
  return module.exports;
}

test("MOB-01C : confirmée hors zone, l'étape passe et la distance est renvoyée pour le signalement", async () => {
  const far = proximityModule({ latitude: 40.77, longitude: -73.97 }, false, 373.4);
  const forced = (await far.assertDriverMissionProximityOrThrow!("d", "c", "m", "delivery", true)) as Record<string, unknown>;
  assert.equal(forced.distanceMeters, 373.4);
  assert.equal(forced.hasLocation, true);
  assert.equal(forced.thresholdMeters, 200);
  await assert.rejects(() => far.assertDriverMissionProximityOrThrow!("d", "c", "m", "delivery", false), { name: "DriverProximityError" });
});

test("MOB-01C : dans la zone, rien à signaler, avec ou sans confirmation", async () => {
  const near = proximityModule({ latitude: 40.76, longitude: -73.97 }, true, 25);
  assert.equal(await near.assertDriverMissionProximityOrThrow!("d", "c", "m", "delivery", true), null);
  assert.equal(await near.assertDriverMissionProximityOrThrow!("d", "c", "m", "delivery", false), null);
});

test("MOB-01C : position inconnue confirmée = signalée sans distance inventée", async () => {
  const unknown = proximityModule(null, false, 0);
  const forced = (await unknown.assertDriverMissionProximityOrThrow!("d", "c", "m", "delivery", true)) as Record<string, unknown>;
  assert.equal(forced.hasLocation, false);
  assert.equal(forced.distanceMeters, null);
});
