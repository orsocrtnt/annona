import assert from "node:assert/strict";
import test from "node:test";
import { resolveRecurringPickupStops, recurringPickupStopsToRoute } from "../src/lib/order/recurring-pickups";

test("une ancienne commande coursier garde son adresse de collecte", () => {
  const stops = resolveRecurringPickupStops({ deliveryCategory: "COURIER", pickupAddress: "10 rue des Lilas", pickupCity: "Paris", pickupPostalCode: "75001", pickupInstructions: "Accueil" });
  assert.equal(stops.length, 1);
  assert.equal(stops[0]?.address, "10 rue des Lilas");
  assert.equal(stops[0]?.instructions, "Accueil");
});
test("des collectes multiples préservent l'ordre et priment sur l'ancienne adresse", () => {
  const pickupStops = [
    { address: "Collecte A", city: "Paris", postalCode: "75001", items: [] },
    { address: "Collecte B", city: "Paris", postalCode: "75002", items: [] },
  ];
  const stops = resolveRecurringPickupStops({ deliveryCategory: "COURIER", pickupStops, pickupAddress: "Ancienne adresse" });
  assert.deepEqual(recurringPickupStopsToRoute(stops).map(s => s.address), ["Collecte A", "Collecte B"]);
  assert.deepEqual(recurringPickupStopsToRoute(stops).map(s => s.label), ["Collecte 1", "Collecte 2"]);
});
test("sans collecte, aucun arrêt artificiel n'est ajouté", () => {
  assert.deepEqual(resolveRecurringPickupStops({ deliveryCategory: "COURIER" }), []);
  assert.deepEqual(resolveRecurringPickupStops({ pickupAddress: "Adresse hors coursier" }), []);
});
