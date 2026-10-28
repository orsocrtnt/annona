import assert from "node:assert/strict";
import test from "node:test";
import {
  compareDispatchProximity,
  computeDispatchProximity,
  getDispatchPickupPoint,
} from "../src/lib/dispatch/dispatch-proximity";
import {
  DEFAULT_DISPATCH_SETTINGS,
  companyDispatchSettingsSchema,
} from "../src/lib/validations/dispatch-settings";

const now = new Date("2026-10-28T12:00:00.000Z");
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);
// Retrait : place de la Bastille. ~1,1 km et ~5,5 km plus loin.
const pickup = { latitude: 48.8532, longitude: 2.3692 };
const nearPoint = { latitude: 48.8632, longitude: 2.3692 };
const farPoint = { latitude: 48.9027, longitude: 2.3692 };
const settings = DEFAULT_DISPATCH_SETTINGS;

test("GPS : seuils par défaut documentés (15 min, 10 km, activé)", () => {
  assert.equal(settings.gpsProximityEnabled, true);
  assert.equal(settings.gpsPositionMaxAgeMinutes, 15);
  assert.equal(settings.gpsMaxDistanceKm, 10);
  // Un réglage enregistré avant cette tranche reçoit les valeurs par défaut.
  const legacy = companyDispatchSettingsSchema.parse({
    enabled: true, strategy: "PRIORITY_LIST",
    autoAssignCategories: { STANDARD: true, COURIER: true, SPECIAL_MISSION: false },
  });
  assert.equal(legacy.gpsPositionMaxAgeMinutes, 15);
  assert.equal(legacy.gpsMaxDistanceKm, 10);
  assert.throws(() => companyDispatchSettingsSchema.parse({ ...settings, gpsPositionMaxAgeMinutes: 0 }));
  assert.throws(() => companyDispatchSettingsSchema.parse({ ...settings, gpsMaxDistanceKm: 500 }));
});

test("GPS : position récente d'un livreur en service, proche du retrait", () => {
  const result = computeDispatchProximity({
    settings, pickup, onDuty: true, now,
    position: { ...nearPoint, updatedAt: ago(120) },
  });
  assert.equal(result.status, "NEAR");
  assert.ok(result.distanceMeters! > 1000 && result.distanceMeters! < 1200, String(result.distanceMeters));
  assert.equal(result.positionAgeSeconds, 120);
});

test("GPS : au-delà du rayon, la distance est connue mais ne donne aucun avantage", () => {
  const result = computeDispatchProximity({
    settings: { ...settings, gpsMaxDistanceKm: 5 }, pickup, onDuty: true, now,
    position: { ...farPoint, updatedAt: ago(30) },
  });
  assert.equal(result.status, "FAR");
  assert.ok(result.distanceMeters! > 5000);
});

test("GPS : aucune position, position périmée ou invalide → statut neutre sans distance", () => {
  assert.deepEqual(
    computeDispatchProximity({ settings, pickup, onDuty: true, now, position: null }),
    { status: "NO_POSITION", distanceMeters: null, positionAgeSeconds: null }
  );
  const stale = computeDispatchProximity({
    settings, pickup, onDuty: true, now, position: { ...nearPoint, updatedAt: ago(15 * 60 + 1) },
  });
  assert.equal(stale.status, "STALE");
  assert.equal(stale.distanceMeters, null);
  assert.equal(stale.positionAgeSeconds, 901);
  const limit = computeDispatchProximity({
    settings, pickup, onDuty: true, now, position: { ...nearPoint, updatedAt: ago(15 * 60) },
  });
  assert.equal(limit.status, "NEAR", "la limite de 15 min est incluse");
  const invalid = computeDispatchProximity({
    settings, pickup, onDuty: true, now, position: { latitude: Number.NaN, longitude: 2, updatedAt: ago(10) },
  });
  assert.equal(invalid.status, "NO_POSITION");
});

test("GPS : livreur hors service — sa position n'est ni lue ni exposée", () => {
  const result = computeDispatchProximity({
    settings, pickup, onDuty: false, now, position: { ...nearPoint, updatedAt: ago(10) },
  });
  assert.deepEqual(result, { status: "OFF_DUTY", distanceMeters: null, positionAgeSeconds: null });
});

test("GPS : retrait non géolocalisé ou critère désactivé → neutre", () => {
  const noPickup = computeDispatchProximity({
    settings, pickup: null, onDuty: true, now, position: { ...nearPoint, updatedAt: ago(60) },
  });
  assert.equal(noPickup.status, "NO_PICKUP");
  assert.equal(noPickup.distanceMeters, null);
  assert.equal(noPickup.positionAgeSeconds, 60);
  const disabled = computeDispatchProximity({
    settings: { ...settings, gpsProximityEnabled: false }, pickup, onDuty: true, now,
    position: { ...nearPoint, updatedAt: ago(60) },
  });
  assert.deepEqual(disabled, { status: "DISABLED", distanceMeters: null, positionAgeSeconds: null });
});

test("GPS : horloge du téléphone en avance → âge jamais négatif", () => {
  const result = computeDispatchProximity({
    settings, pickup, onDuty: true, now, position: { ...nearPoint, updatedAt: ago(-40) },
  });
  assert.equal(result.positionAgeSeconds, 0);
  assert.equal(result.status, "NEAR");
});

test("GPS : point de retrait lu sur la livraison, absent si incomplet", () => {
  assert.deepEqual(getDispatchPickupPoint({ pickupLatitude: 48.85, pickupLongitude: 2.36 }), { latitude: 48.85, longitude: 2.36 });
  assert.equal(getDispatchPickupPoint({ pickupLatitude: 48.85, pickupLongitude: null }), null);
  assert.equal(getDispatchPickupPoint({ pickupLatitude: null, pickupLongitude: null }), null);
});

test("GPS : comparaison — proche avant neutre, le plus proche d'abord, neutres à égalité", () => {
  const near1 = { status: "NEAR" as const, distanceMeters: 900, positionAgeSeconds: 10 };
  const near2 = { status: "NEAR" as const, distanceMeters: 2300, positionAgeSeconds: 10 };
  const far = { status: "FAR" as const, distanceMeters: 20_000, positionAgeSeconds: 10 };
  const none = { status: "NO_POSITION" as const, distanceMeters: null, positionAgeSeconds: null };
  assert.ok(compareDispatchProximity(near1, near2) < 0);
  assert.ok(compareDispatchProximity(near2, none) < 0);
  assert.ok(compareDispatchProximity(none, near2) > 0);
  assert.equal(compareDispatchProximity(far, none), 0, "loin ou inconnu : aucune pénalité l'un envers l'autre");
  assert.equal(compareDispatchProximity(undefined, none), 0);
  assert.equal(compareDispatchProximity(near1, { ...near1 }), 0);
});
