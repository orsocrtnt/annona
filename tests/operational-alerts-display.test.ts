import assert from "node:assert/strict";
import test from "node:test";
import { describeAlertTarget } from "../src/domains/operational-alerts/operational-alerts.policy";
import { alertCountLabel, alertDeadlineLabel, alertKindLabel } from "../src/lib/operational-alerts-display";

test("une alerte se lit par son client et son adresse, pas par ses références", () => {
  const order = {
    shippingAddress: "1 rue de Rivoli",
    shippingCity: "Paris",
    customer: { firstName: "Claire", lastName: "Moreau" },
    deliveries: [{ id: "d1", address: "12 rue Lepic", city: "Paris" }],
  };
  assert.deepEqual(describeAlertTarget(order, "d1"), { customerName: "Claire Moreau", place: "12 rue Lepic, Paris" });
  assert.deepEqual(describeAlertTarget(order, null), { customerName: "Claire Moreau", place: "1 rue de Rivoli, Paris" }, "incident : adresse de la commande");
  assert.equal(describeAlertTarget({ deliveries: [{ id: "d", address: "8 rue Oberkampf, 75011 Paris", city: "Paris" }] }, "d").place, "8 rue Oberkampf, 75011 Paris", "ville déjà dans l'adresse");
  assert.deepEqual(describeAlertTarget({ customer: null, deliveries: [] }, null), { customerName: null, place: null });
});

test("le type d'alerte remplace le titre technique « Retard — LIV-… »", () => {
  assert.equal(alertKindLabel({ id: "late:d1:2026-10-26T10:00:00.000Z", title: "Retard — LIV-41073762" }), "Retard");
  assert.equal(alertKindLabel({ id: "incident:m1", title: "Incident signalé" }), "Incident signalé");
});

test("l'échéance dit l'heure prévue et l'ampleur du retard", () => {
  const now = new Date("2026-10-26T14:30:00Z"); // 15:30 à Paris
  assert.equal(alertDeadlineLabel("2026-10-26T12:30:00Z", now), "Prévue à 13:30 · 2 h de retard");
  assert.equal(alertDeadlineLabel("2026-10-26T14:10:00Z", now), "Prévue à 15:10 · 20 min de retard");
  assert.equal(alertDeadlineLabel("2026-10-23T09:00:00Z", now), "Prévue le 23 oct. · 3 j de retard");
  assert.equal(alertDeadlineLabel("2026-10-26T16:00:00Z", now), "Prévue à 17:00", "pas encore en retard");
  assert.equal(alertDeadlineLabel(null, now), null);
  assert.equal(alertDeadlineLabel("pas une date", now), null);
});

test("le compteur d'alertes est accordé", () => {
  assert.equal(alertCountLabel(1), "1 alerte à suivre");
  assert.equal(alertCountLabel(3), "3 alertes à suivre");
});
