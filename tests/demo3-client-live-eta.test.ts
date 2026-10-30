import assert from "node:assert/strict";
import test from "node:test";
import { attachClientLiveEta, MAX_ETA_NETWORK_CALLS, type LiveEtaDelivery } from "../src/domains/delivery/client-live-eta";
import { createTravelTimeState } from "../src/lib/dispatch/travel-time";
import { liveEtaLabel } from "../src/lib/format/live-eta";

const destination = { latitude: 48.8566, longitude: 2.3522 };
const position = { latitude: 48.87, longitude: 2.37, isOnline: true, estimated: false };
const delivery = (over: Partial<LiveEtaDelivery> = {}): LiveEtaDelivery => ({
  id: "d1",
  status: "IN_DELIVERY",
  deliveryCategory: "STANDARD",
  destination,
  driverLocation: position,
  ...over,
});
const osrmOk = (seconds: number) => async () => ({ ok: true, status: 200, json: async () => ({ code: "Ok", durations: [[seconds]] }) });
const base = { baseUrl: "https://osrm.test", state: createTravelTimeState() };

test("en livraison, avec position fraîche : minutes du service de trajet, arrondies au supérieur", async () => {
  const [result] = await attachClientLiveEta([delivery()], { ...base, state: createTravelTimeState(), fetchImpl: osrmOk(601) });
  assert.deepEqual(result!.liveEta, { minutes: 11, approximate: false });
});

test("un trajet de quelques secondes affiche au moins 1 minute", async () => {
  const [result] = await attachClientLiveEta([delivery()], { ...base, state: createTravelTimeState(), fetchImpl: osrmOk(5) });
  assert.equal(result!.liveEta?.minutes, 1);
});

test("service de trajet absent ou en panne : estimation marquée approximative, jamais d'exception", async () => {
  const [absent] = await attachClientLiveEta([delivery()], { baseUrl: null, state: createTravelTimeState() });
  assert.equal(absent!.liveEta?.approximate, true);
  assert.ok(absent!.liveEta!.minutes >= 1);
  const [down] = await attachClientLiveEta([delivery()], {
    ...base,
    state: createTravelTimeState(),
    fetchImpl: async () => { throw new Error("panne"); },
  });
  assert.equal(down!.liveEta?.approximate, true);
});

test("seule une mission en route vers le client reçoit une arrivée estimée", async () => {
  const options = { baseUrl: null, state: createTravelTimeState() };
  for (const status of ["PENDING", "ASSIGNED", "PURCHASING", "DELIVERED", "FAILED", "CANCELLED"]) {
    const [result] = await attachClientLiveEta([delivery({ status })], options);
    assert.equal(result!.liveEta, null, status);
  }
  const [courierPickup] = await attachClientLiveEta([delivery({ status: "ASSIGNED", deliveryCategory: "COURIER" })], options);
  assert.equal(courierPickup!.liveEta, null, "course pas encore collectée : le livreur va au retrait");
  const [courierCollected] = await attachClientLiveEta([delivery({ status: "PURCHASING", deliveryCategory: "COURIER" })], options);
  assert.ok(courierCollected!.liveEta, "course collectée : le livreur va au client");
});

test("position périmée, absente ou destination inconnue : pas d'arrivée inventée", async () => {
  const options = { baseUrl: null, state: createTravelTimeState() };
  const cases = [
    delivery({ driverLocation: null }),
    delivery({ driverLocation: { ...position, isOnline: false, estimated: false } }),
    delivery({ destination: null }),
  ];
  for (const item of await attachClientLiveEta(cases, options)) assert.equal(item.liveEta, null);
  const [estimated] = await attachClientLiveEta([delivery({ driverLocation: { ...position, isOnline: false, estimated: true } })], options);
  assert.ok(estimated!.liveEta, "signal perdu depuis peu : la position estimée reste utilisable");
});

test("le réseau est plafonné par lecture : au-delà, repli local sans appel", async () => {
  let calls = 0;
  const many = Array.from({ length: MAX_ETA_NETWORK_CALLS + 4 }, (_, index) =>
    delivery({ id: `d${index}`, destination: { latitude: 48.8 + index / 100, longitude: 2.3 } }));
  const results = await attachClientLiveEta(many, {
    ...base,
    state: createTravelTimeState(),
    fetchImpl: async () => { calls += 1; return { ok: true, status: 200, json: async () => ({ code: "Ok", durations: [[300]] }) }; },
  });
  assert.equal(calls, MAX_ETA_NETWORK_CALLS);
  assert.equal(results.filter((item) => item.liveEta?.approximate === false).length, MAX_ETA_NETWORK_CALLS);
  assert.equal(results.filter((item) => item.liveEta?.approximate === true).length, 4);
});

test("la réponse garde les autres champs et n'ajoute ni secondes ni coordonnées", async () => {
  const [result] = await attachClientLiveEta([delivery()], { ...base, state: createTravelTimeState(), fetchImpl: osrmOk(300) });
  assert.equal(result!.id, "d1");
  assert.deepEqual(Object.keys(result!.liveEta!).sort(), ["approximate", "minutes"]);
});

test("libellés affichés au client", () => {
  assert.equal(liveEtaLabel({ minutes: 12, approximate: false }), "Arrive dans 12 min");
  assert.equal(liveEtaLabel({ minutes: 12, approximate: true }), "Arrive dans environ 12 min");
});
