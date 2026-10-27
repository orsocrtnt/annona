import assert from "node:assert/strict";
import test from "node:test";
import { buildDrivePlan, CRUISE_SPEED_MS, distanceAt, isRedLight, lightPhase, positionAt, simulateDrive } from "../src/lib/maps/drive-simulation";
import type { LatLng } from "../src/lib/maps/route-progress";

const t0 = Date.parse("2026-10-27T12:00:00Z");
const speedAround = (timeline: ReturnType<typeof simulateDrive>, seconds: number) => distanceAt(timeline, seconds + 0.5) - distanceAt(timeline, seconds - 0.5);
// Ligne droite de ≈ 1 112 m vers le nord.
const straight: LatLng[] = [[48.85, 2.35], [48.86, 2.35]];

test("ligne droite : accélère jusqu'à la croisière, freine et s'arrête à la cible", () => {
  const timeline = simulateDrive(buildDrivePlan({ points: straight, lights: [] }), t0, 600);
  assert.ok(Math.abs(speedAround(timeline, 2) - CRUISE_SPEED_MS) < 0.05, "au dernier relevé, le livreur roulait déjà");
  assert.ok(Math.abs(speedAround(timeline, 40) - CRUISE_SPEED_MS) < 0.05, "30 km/h en croisière");
  const length = timeline.plan.track.length;
  assert.ok(Math.abs(distanceAt(timeline, 600) - length) < 0.5, "arrive à la cible");
  assert.ok(distanceAt(timeline, 600) <= length);
});

test("virage à 90° : ralentit nettement avant l'angle puis réaccélère", () => {
  const corner: LatLng[] = [[48.85, 2.35], [48.854, 2.35], [48.854, 2.356]]; // ≈ 445 m puis ≈ 440 m
  const timeline = simulateDrive(buildDrivePlan({ points: corner, lights: [] }), t0, 600);
  const cornerAt = timeline.plan.track.cumulative[1]!;
  let cornerTime = 0;
  while (distanceAt(timeline, cornerTime) < cornerAt) cornerTime += 0.25;
  const inTurn = speedAround(timeline, cornerTime);
  assert.ok(inTurn < 4.5, `≈ 15 km/h au plus dans l'angle : ${(inTurn * 3.6).toFixed(1)} km/h`);
  assert.ok(speedAround(timeline, cornerTime - 25) > 7.5, "vite sur la ligne droite avant");
  assert.ok(speedAround(timeline, cornerTime + 20) > speedAround(timeline, cornerTime) + 2, "réaccélère après");
});

test("grand carrefour à feu : arrêt au rouge, repart au vert ; même résultat partout", () => {
  // Carrefour à mi-parcours ; on cherche un point qui a un feu (deux sur trois en ont).
  let light: LatLng = [48.855, 2.35];
  for (let k = 0; lightPhase(light) === null; k += 1) light = [48.855 + k * 0.0002, 2.35];
  const phase = lightPhase(light)!;
  const route = { points: straight, lights: [light] };
  const plan = buildDrivePlan(route);
  const lightAt = plan.lights[0]!.distance;
  // Départ calé pour arriver au feu au début du rouge : le livreur doit attendre.
  const free = simulateDrive(buildDrivePlan({ points: straight, lights: [] }), t0, 600);
  let arrival = 0;
  while (distanceAt(free, arrival) < lightAt - 30) arrival += 0.25;
  let start = t0;
  while (!isRedLight(phase, start + arrival * 1000) || isRedLight(phase, start + arrival * 1000 - 1000)) start += 250;
  const timeline = simulateDrive(plan, start, 600);
  const stopped = [...Array(40).keys()].map((k) => distanceAt(timeline, arrival + 8 + k * 0.25)); // rouge : 24 s
  assert.ok(stopped.every((d) => d < lightAt) && Math.max(...stopped) - Math.min(...stopped) < 0.5, "immobile avant le feu pendant le rouge");
  assert.ok(distanceAt(timeline, arrival + 60) > lightAt + 20, "repart au vert et franchit le carrefour");
  assert.deepEqual(simulateDrive(buildDrivePlan(route), start, 600).distances, timeline.distances, "déterministe");
});

test("au-delà de la durée simulée, le livreur reste à l'endroit atteint", () => {
  const timeline = simulateDrive(buildDrivePlan({ points: straight, lights: [] }), t0, 30);
  assert.equal(distanceAt(timeline, 30), distanceAt(timeline, 900));
  assert.deepEqual(positionAt(timeline, 0), straight[0]);
});
