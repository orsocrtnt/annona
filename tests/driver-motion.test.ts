import assert from "node:assert/strict";
import test from "node:test";
import { blendPoint, motionPoint, motionTrail, reuseRoad, travelledMeters } from "../src/lib/maps/driver-motion";
import { buildRouteTrack, type LatLng } from "../src/lib/maps/route-progress";

const since = "2026-10-27T12:00:00.000Z";
const t0 = Date.parse(since);
// Route en L de ≈ 1 112 m puis ≈ 732 m ; la cible est au bout.
const route: LatLng[] = [[48.85, 2.35], [48.86, 2.35], [48.86, 2.36]];
const motion = { from: { latitude: 48.85, longitude: 2.35 }, target: { latitude: 48.86, longitude: 2.36 }, since };
const road = { track: buildRouteTrack(route), startDistance: 0 };

test("25 km/h depuis le dernier relevé, arrêt au bout de 3 min", () => {
  assert.ok(Math.abs(travelledMeters(motion, t0 + 36_000) - 250) < 1e-6);
  assert.equal(travelledMeters(motion, t0 + 600_000), travelledMeters(motion, t0 + 180_000));
  assert.equal(travelledMeters(motion, t0 - 5_000), 0);
});

test("suit la route, virage compris, au lieu de couper en ligne droite", () => {
  const afterTurn = motionPoint(motion, road, t0 + 170_000); // ≈ 1 180 m : passé l'angle
  assert.ok(Math.abs(afterTurn[0] - 48.86) < 1e-9 && afterTurn[1] > 2.35, String(afterTurn));
  const straight = motionPoint(motion, null, t0 + 170_000);
  assert.ok(straight[0] < 48.86 && straight[1] > 2.35, "sans route chargée : ligne droite vers la cible");
});

test("la trace commence au livreur et s'efface derrière lui", () => {
  const shown = motionPoint(motion, road, t0 + 170_000);
  const trail = motionTrail(motion, road, t0 + 170_000, shown);
  assert.deepEqual(trail[0], shown);
  assert.equal(trail.length, 2, "le premier tronçon est déjà parcouru");
  assert.deepEqual(trail[1], route[2]);
  assert.deepEqual(motionTrail(motion, null, t0, [48.85, 2.35]), [[48.85, 2.35], [48.86, 2.36]]);
});

test("recalage fluide : glisse vers le nouveau point en 800 ms, sans saut", () => {
  const from: LatLng = [48.85, 2.35], to: LatLng = [48.851, 2.351];
  assert.deepEqual(blendPoint(from, to, 0), from);
  const mid = blendPoint(from, to, 400);
  assert.ok(mid[0] > from[0] && mid[0] < to[0]);
  assert.deepEqual(blendPoint(from, to, 800), to);
  assert.deepEqual(blendPoint(from, to, 5_000), to);
});

test("nouveau relevé sur la route : itinéraire réutilisé depuis sa projection ; sinon recalculé", () => {
  const next = { ...motion, from: { latitude: 48.855, longitude: 2.35 }, since: "2026-10-27T12:00:10.000Z" };
  const reused = reuseRoad(road, next);
  assert.ok(reused && Math.abs(reused.startDistance - 556) < 2, String(reused?.startDistance));
  assert.equal(reuseRoad(road, { ...next, from: { latitude: 48.855, longitude: 2.352 } }), null, "relevé hors de la route");
  assert.equal(reuseRoad(road, { ...next, target: { latitude: 48.9, longitude: 2.4 } }), null, "autre cible");
  assert.equal(reuseRoad(null, next), null);
});
