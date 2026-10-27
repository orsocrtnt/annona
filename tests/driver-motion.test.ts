import assert from "node:assert/strict";
import test from "node:test";
import { motionTimeline } from "../src/domains/tracking/tracking.policy";
import { blendPoint, motionPoint, motionSettled, motionTrail } from "../src/lib/maps/driver-motion";
import type { LatLng } from "../src/lib/maps/route-progress";

const since = "2026-10-27T12:00:00.000Z";
const t0 = Date.parse(since);
// Itinéraire en L de ≈ 1 112 m puis ≈ 732 m ; la cible est au bout.
const points: LatLng[] = [[48.85, 2.35], [48.86, 2.35], [48.86, 2.36]];
const motion = { from: { latitude: 48.85, longitude: 2.35 }, target: { latitude: 48.86, longitude: 2.36 }, since, route: { points, lights: [] as LatLng[] } };
const timeline = motionTimeline(motion);

test("suit la route reçue du serveur, virage compris ; sans route, reste au dernier relevé", () => {
  const afterTurn = motionPoint(motion, timeline, t0 + 175_000);
  assert.ok(Math.abs(afterTurn[0] - 48.86) < 1e-9 && afterTurn[1] > 2.35, `passé l'angle : ${afterTurn}`);
  const early = motionPoint(motion, timeline, t0 + 20_000);
  assert.ok(early[0] > 48.85 && early[1] === 2.35, "sur la première rue");
  assert.deepEqual(motionPoint({ ...motion, route: null }, null, t0 + 60_000), [48.85, 2.35], "jamais de ligne droite");
});

test("la trace commence au livreur et s'efface derrière lui", () => {
  const shown = motionPoint(motion, timeline, t0 + 175_000);
  const trail = motionTrail(motion, timeline, t0 + 175_000, shown);
  assert.deepEqual(trail[0], shown);
  assert.equal(trail.length, 2, "le premier tronçon est déjà parcouru");
  assert.deepEqual(trail[1], points[2]);
  assert.deepEqual(motionTrail(motion, null, t0, [48.85, 2.35]), [], "sans route, aucune trace inventée");
});

test("plus rien à animer une fois le signal perdu ou la cible atteinte", () => {
  assert.equal(motionSettled(motion, timeline, t0 + 60_000), false);
  assert.equal(motionSettled(motion, timeline, t0 + 180_000), true);
  const short = { ...motion, route: { points: [[48.85, 2.35], [48.8505, 2.35]] as LatLng[], lights: [] } };
  assert.equal(motionSettled(short, motionTimeline(short), t0 + 60_000), true, "cible de 55 m atteinte");
  assert.equal(motionSettled(motion, null, t0), true);
});

test("recalage fluide : glisse vers le nouveau point en 800 ms, sans saut", () => {
  const from: LatLng = [48.85, 2.35], to: LatLng = [48.851, 2.351];
  assert.deepEqual(blendPoint(from, to, 0), from);
  const mid = blendPoint(from, to, 400);
  assert.ok(mid[0] > from[0] && mid[0] < to[0]);
  assert.deepEqual(blendPoint(from, to, 800), to);
  assert.deepEqual(blendPoint(from, to, 5_000), to);
});
