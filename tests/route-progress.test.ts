import assert from "node:assert/strict";
import test from "node:test";
import { buildRouteTrack, pointAtDistance, projectOnRoute, remainingPath, type LatLng } from "../src/lib/maps/route-progress";

// Tracé en L : 0,01° vers le nord (≈ 1 112 m), puis 0,01° vers l'est à cette latitude.
const route: LatLng[] = [[48.85, 2.35], [48.86, 2.35], [48.86, 2.36]];
const track = buildRouteTrack(route);
const near = (a: LatLng, b: LatLng, epsilon = 1e-6) => Math.abs(a[0] - b[0]) < epsilon && Math.abs(a[1] - b[1]) < epsilon;

test("tracé mesuré en mètres le long de la route", () => {
  assert.ok(Math.abs(track.cumulative[1]! - 1112) < 2, String(track.cumulative[1]));
  assert.ok(track.length > 1800 && track.length < 1850, String(track.length));
});

test("point à une distance donnée : suit les virages, borné au départ et à l'arrivée", () => {
  assert.ok(near(pointAtDistance(track, track.cumulative[1]! / 2), [48.855, 2.35]));
  const afterCorner = pointAtDistance(track, track.cumulative[1]! + 100);
  assert.ok(Math.abs(afterCorner[0] - 48.86) < 1e-9 && afterCorner[1] > 2.35, "tourne à l'angle, ne coupe pas en diagonale");
  assert.deepEqual(pointAtDistance(track, -50), route[0]);
  assert.deepEqual(pointAtDistance(track, track.length + 500), route[2]);
});

test("trace effacée derrière le livreur : seule la route restante est rendue", () => {
  const half = remainingPath(track, track.cumulative[1]! / 2);
  assert.equal(half.length, 3);
  assert.ok(near(half[0]!, [48.855, 2.35]));
  assert.deepEqual(half.slice(1), route.slice(1));
  const pastCorner = remainingPath(track, track.cumulative[1]! + 100);
  assert.equal(pastCorner.length, 2, "le premier segment, déjà parcouru, a disparu");
  assert.deepEqual(pastCorner[1], route[2]);
  assert.equal(remainingPath(track, track.length).length, 2);
});

test("projection d'un relevé : distance parcourue et écart à la route", () => {
  const onRoad = projectOnRoute(track, [48.855, 2.35]);
  assert.ok(Math.abs(onRoad.distance - track.cumulative[1]! / 2) < 1);
  assert.ok(onRoad.offsetMeters < 0.5);
  const beside = projectOnRoute(track, [48.855, 2.3505]);
  assert.ok(Math.abs(beside.offsetMeters - 36.6) < 2, String(beside.offsetMeters));
  const farAway = projectOnRoute(track, [48.80, 2.30]);
  assert.ok(farAway.offsetMeters > 1000);
});

test("tracé dégénéré : un seul point, jamais d'erreur", () => {
  const single = buildRouteTrack([[48.85, 2.35]]);
  assert.equal(single.length, 0);
  assert.deepEqual(pointAtDistance(single, 100), [48.85, 2.35]);
  assert.deepEqual(remainingPath(single, 100), [[48.85, 2.35]]);
});
