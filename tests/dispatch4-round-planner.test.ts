import assert from "node:assert/strict";
import test from "node:test";
import { evaluateRound, planRounds, stopsForDelivery, type RoundDelivery, type RoundDriver, type RoundOptions } from "../src/lib/dispatch/round-planner";
import { createTravelTimeState, estimateTravelMatrix, straightLineSeconds } from "../src/lib/dispatch/travel-time";

const now = Date.UTC(2026, 10, 2, 8, 0);
const HOUR = 3_600_000;
const options: RoundOptions = { now, stopSeconds: 300, maxDaySeconds: 8 * 3600, maxDeliveries: 12, travelSeconds: straightLineSeconds };
// Ligne est-ouest à Paris : environ 1 km tous les 0,0137° de longitude.
const at = (km: number) => ({ latitude: 48.8566, longitude: 2.3 + km * 0.0137 });
const delivery = (id: string, km: number, over: Partial<RoundDelivery> = {}): RoundDelivery => ({
  id, destination: at(km), pickup: null, weightKg: null, windowStart: null, windowEnd: null, urgent: false, ...over,
});
const driver = (id: string, km: number | null, ids: string[], over: Partial<RoundDriver> = {}): RoundDriver => ({
  id, start: km === null ? null : at(km), readyAt: now, capacityKg: null, eligibleDeliveryIds: new Set(ids), ...over,
});
const dropoffs = (plan: ReturnType<typeof planRounds>, driverId: string) =>
  plan.rounds.find((round) => round.driverId === driverId)?.evaluation.stops.filter((stop) => stop.kind === "DROPOFF").map((stop) => stop.deliveryId) ?? [];

test("trois voisines et un seul livreur : ordre de passage du plus proche au plus loin, depuis sa position", () => {
  const plan = planRounds([delivery("c", 3), delivery("a", 1), delivery("b", 2)], [driver("d1", 0, ["a", "b", "c"])], options);
  assert.deepEqual(dropoffs(plan, "d1"), ["a", "b", "c"]);
  assert.deepEqual(plan.unplanned, []);
});

test("deux quartiers et deux livreurs : chacun garde le sien", () => {
  const ids = ["w1", "w2", "e1", "e2"];
  const plan = planRounds([delivery("w1", 1), delivery("w2", 2), delivery("e1", 20), delivery("e2", 21)], [driver("west", 0, ids), driver("east", 22, ids)], options);
  assert.deepEqual(new Set(dropoffs(plan, "west")), new Set(["w1", "w2"]));
  assert.deepEqual(new Set(dropoffs(plan, "east")), new Set(["e1", "e2"]));
});

test("créneau : on livre d'abord la livraison promise tôt, même plus loin, et on attend l'ouverture", () => {
  const plan = planRounds(
    [delivery("near", 1), delivery("far", 6, { windowStart: now + HOUR, windowEnd: now + 1.2 * HOUR })],
    [driver("d1", 0, ["near", "far"])],
    options
  );
  const round = plan.rounds[0]!.evaluation;
  const far = round.stops.find((stop) => stop.deliveryId === "far")!;
  assert.equal(far.arrivalAt, now + HOUR, "arrivée recalée à l'ouverture du créneau");
  assert.ok(far.waitSeconds > 0);
  assert.deepEqual(round.violations, []);
});

test("créneau impossible à tenir : la livraison reste à affecter, avec la raison", () => {
  const plan = planRounds([delivery("x", 30, { windowEnd: now + 60_000 })], [driver("d1", 0, ["x"])], options);
  assert.deepEqual(plan.unplanned, [{ deliveryId: "x", reason: "SLOT_MISSED" }]);
  assert.equal(plan.rounds.length, 0);
});

test("capacité : au-delà du véhicule, le colis va au livreur suivant ou reste à affecter", () => {
  const ids = ["a", "b"];
  const heavy = [delivery("a", 1, { weightKg: 60 }), delivery("b", 2, { weightKg: 60 })];
  const shared = planRounds(heavy, [driver("d1", 0, ids, { capacityKg: 100 }), driver("d2", 10, ids, { capacityKg: 100 })], options);
  assert.equal(shared.rounds.length, 2);
  assert.deepEqual(shared.unplanned, []);
  const alone = planRounds(heavy, [driver("d1", 0, ids, { capacityKg: 100 })], options);
  assert.deepEqual(alone.unplanned, [{ deliveryId: "b", reason: "CAPACITY_EXCEEDED" }]);
});

test("capacité avec retraits : le colis déjà déposé libère la place", () => {
  const deliveries = [
    delivery("a", 2, { pickup: at(1), weightKg: 80 }),
    delivery("b", 4, { pickup: at(3), weightKg: 80 }),
  ];
  const plan = planRounds(deliveries, [driver("d1", 0, ["a", "b"], { capacityKg: 100 })], options);
  assert.deepEqual(plan.unplanned, []);
  assert.equal(plan.rounds[0]!.evaluation.maxLoadKg, 80);
});

test("poids inconnu : compté à part, jamais inventé", () => {
  const plan = planRounds([delivery("a", 1), delivery("b", 2, { weightKg: 5 })], [driver("d1", 0, ["a", "b"], { capacityKg: 10 })], options);
  assert.equal(plan.rounds[0]!.evaluation.unknownWeightCount, 1);
  assert.equal(plan.rounds[0]!.evaluation.maxLoadKg, 5);
});

test("zone : un livreur non autorisé n'est jamais choisi, même tout proche", () => {
  const plan = planRounds([delivery("a", 1)], [driver("near", 1, []), driver("far", 40, ["a"])], options);
  assert.deepEqual(dropoffs(plan, "far"), ["a"]);
  const none = planRounds([delivery("a", 1)], [driver("near", 1, [])], options);
  assert.deepEqual(none.unplanned, [{ deliveryId: "a", reason: "NO_ELIGIBLE_DRIVER" }]);
});

test("durée de la journée : ce qui dépasse reste à affecter", () => {
  const plan = planRounds([delivery("a", 1), delivery("b", 2)], [driver("d1", 0, ["a", "b"])], { ...options, maxDaySeconds: 600 });
  assert.equal(plan.rounds[0]!.evaluation.stops.length, 1);
  assert.equal(plan.unplanned[0]!.reason, "DAY_EXCEEDED");
});

test("nombre de livraisons par tournée plafonné", () => {
  const ids = ["a", "b", "c"];
  const plan = planRounds([delivery("a", 1), delivery("b", 2), delivery("c", 3)], [driver("d1", 0, ids)], { ...options, maxDeliveries: 2 });
  assert.equal(new Set(plan.rounds[0]!.evaluation.stops.map((stop) => stop.deliveryId)).size, 2);
  assert.deepEqual(plan.unplanned.map((item) => item.reason), ["TOO_MANY_DELIVERIES"]);
});

test("course avec retrait : le retrait précède toujours la livraison", () => {
  const plan = planRounds([delivery("a", 1, { pickup: at(5) })], [driver("d1", 0, ["a"])], options);
  assert.deepEqual(plan.rounds[0]!.evaluation.stops.map((stop) => stop.kind), ["PICKUP", "DROPOFF"]);
});

test("tournée modifiée à la main : les limites dépassées sont signalées, pas masquées", () => {
  const byId = new Map([["a", delivery("a", 2, { pickup: at(1), windowEnd: now - 1 })]]);
  const reversed = evaluateRound(driver("d1", 0, []), [{ deliveryId: "a", kind: "DROPOFF" }, { deliveryId: "a", kind: "PICKUP" }], byId, options);
  assert.deepEqual(new Set(reversed.violations.map((violation) => violation.code)), new Set(["PICKUP_AFTER_DROPOFF", "SLOT_MISSED", "NOT_ELIGIBLE"]));
});

test("livreur occupé : son départ est décalé, un livreur libre passe devant à distance égale", () => {
  const plan = planRounds([delivery("a", 1)], [driver("busy", 0, ["a"], { readyAt: now + HOUR }), driver("free", 0, ["a"])], options);
  assert.deepEqual(dropoffs(plan, "free"), ["a"]);
  const late = evaluateRound(driver("busy", 0, ["a"], { readyAt: now + HOUR }), stopsForDelivery(delivery("a", 1)), new Map([["a", delivery("a", 1)]]), options);
  assert.ok(late.stops[0]!.arrivalAt > now + HOUR);
});

test("livreur sans position : la tournée commence au premier arrêt, sans trajet inventé", () => {
  const evaluation = evaluateRound(driver("d1", null, ["a"]), stopsForDelivery(delivery("a", 5)), new Map([["a", delivery("a", 5)]]), options);
  assert.equal(evaluation.stops[0]!.arrivalAt, now);
});

test("résultat déterministe, et 200 livraisons pour 20 livreurs tiennent sous 3 s", () => {
  const many = Array.from({ length: 200 }, (_, index) => delivery(`d${index}`, (index * 7) % 40));
  const ids = many.map((item) => item.id);
  const fleet = Array.from({ length: 20 }, (_, index) => driver(`v${index}`, index * 2, ids));
  const startedAt = performance.now();
  const first = planRounds(many, fleet, options);
  assert.ok(performance.now() - startedAt < 3000);
  assert.deepEqual(planRounds([...many].reverse(), fleet, options), first);
  assert.equal(new Set(first.rounds.flatMap((round) => round.evaluation.stops.map((stop) => stop.deliveryId))).size + first.unplanned.length, 200);
});

const points = [at(0), at(1), at(2)];
test("matrice : un seul appel, repli par cellule et panne sans exception", async () => {
  let calls = 0;
  const ok = await estimateTravelMatrix(points, {
    baseUrl: "https://osrm.test",
    state: createTravelTimeState(),
    fetchImpl: async () => { calls += 1; return { ok: true, status: 200, json: async () => ({ code: "Ok", durations: [[0, 111, null], [111, 0, 222], [333, 222, 0]] }) }; },
  });
  assert.equal(calls, 1);
  assert.equal(ok.approximate, false);
  assert.equal(ok.seconds(at(0), at(1)), 111);
  assert.equal(ok.seconds(at(0), at(2)), straightLineSeconds(at(0), at(2)));

  const state = createTravelTimeState();
  const down = await estimateTravelMatrix(points, { baseUrl: "https://osrm.test", state, fetchImpl: async () => { throw new Error("panne"); } });
  assert.equal(down.approximate, true);
  assert.ok(state.unavailableUntil > 0);
  let again = 0;
  await estimateTravelMatrix(points, { baseUrl: "https://osrm.test", state, fetchImpl: async () => { again += 1; throw new Error("x"); } });
  assert.equal(again, 0, "pause après une panne");

  assert.equal((await estimateTravelMatrix(points, { baseUrl: null, state: createTravelTimeState() })).approximate, true);
});

test("ordre côté livreur : la tournée se suit dans l'ordre de passage, les autres missions gardent leur place", async () => {
  const { orderMissionsByRound } = await import("../src/lib/dispatch/round-order");
  const missions = [
    { id: "solo1" },
    { id: "r3", roundId: "r", roundSequence: 3 },
    { id: "r1", roundId: "r", roundSequence: 1 },
    { id: "solo2", roundId: null, roundSequence: null },
    { id: "r2", roundId: "r", roundSequence: 2 },
  ];
  assert.deepEqual(orderMissionsByRound(missions).map((mission) => mission.id), ["solo1", "r1", "r2", "r3", "solo2"]);
});
