import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { outOfRangeIncidentBody } from "../src/lib/maps/out-of-range-note";

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

test("MOB-01C : texte du signalement avec la distance arrondie, sans donnée du client", () => {
  assert.equal(
    outOfRangeIncidentBody({ kind: "delivery", status: "DELIVERED", hasLocation: true, distanceMeters: 373.4, thresholdMeters: 200 }),
    "Livraison validée hors zone par le livreur : à 373 m du point de livraison (zone attendue : 200 m)."
  );
  assert.match(outOfRangeIncidentBody({ kind: "pickup", status: "PURCHASING", hasLocation: true, distanceMeters: 1200, thresholdMeters: 200 }), /^Retrait confirmé hors zone .* 1200 m du point de retrait/);
  assert.match(outOfRangeIncidentBody({ kind: "delivery", status: "FAILED", hasLocation: false, distanceMeters: null, thresholdMeters: 200 }), /^Échec de livraison déclaré hors zone .*position inconnue/);
});

test("MOB-01C : le signalement est une note interne de type incident, rattachée à l'étape (jamais visible du client)", () => {
  const source = readFileSync("src/domains/delivery/delivery.service.ts", "utf8");
  const start = source.indexOf("if (forcedOutOfRange) {");
  assert.ok(start > 0);
  const block = source.slice(start, source.indexOf("const notificationJob = await queueDeliveryStatusNotification", start));
  assert.match(block, /tx\.orderMessage\.create/);
  assert.match(block, /kind: "INCIDENT"/);
  assert.match(block, /internal: true/);
  assert.match(block, /requestKey: `out-of-range:\$\{trackingEvent\.id\}`/);
  // Les messages internes sont filtrés pour tout acteur qui n'est pas de l'équipe.
  const conversation = readFileSync("src/domains/order-conversation/order-conversation.service.ts", "utf8");
  assert.match(conversation, /isConversationStaff\(actor\) \? \{\} : \{ internal: false \}/);
});
