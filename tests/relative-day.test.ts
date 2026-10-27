import assert from "node:assert/strict";
import test from "node:test";
import { fullDateLabel, relativeDayLabel } from "../src/lib/format/relative-day";

const now = new Date("2026-10-27T10:00:00Z"); // 11:00 à Paris

test("les jours proches se lisent en mots, à l'heure de Paris", () => {
  assert.equal(relativeDayLabel("2026-10-27T13:30:00Z", now, { withTime: true }), "Aujourd'hui 14:30");
  assert.equal(relativeDayLabel("2026-10-27T13:30:00Z", now), "Aujourd'hui");
  assert.equal(relativeDayLabel("2026-10-26T08:00:00Z", now), "Hier");
  assert.equal(relativeDayLabel("2026-10-28T08:00:00Z", now, { withTime: true }), "Demain 09:00");
  assert.equal(relativeDayLabel("2026-10-26T23:30:00Z", now), "Aujourd'hui", "00:30 à Paris, déjà le 27");
});

test("au-delà, une date courte, avec l'année si elle diffère", () => {
  assert.equal(relativeDayLabel("2026-10-23T08:00:00Z", now), "23 oct.");
  assert.equal(relativeDayLabel("2025-12-02T08:00:00Z", now), "2 déc. 2025");
  assert.equal(relativeDayLabel("pas une date", now), "—");
});

test("la date complète reste disponible pour l'infobulle", () => {
  assert.match(fullDateLabel("2026-10-27T13:30:00Z"), /mardi 27 octobre 2026.*14:30/);
  assert.equal(fullDateLabel("x"), "");
});

test("une commande en cours dont l'échéance est passée est en retard, jamais une commande close", async () => {
  const { isOrderOverdue } = await import("../src/lib/orders/overdue");
  assert.equal(isOrderOverdue("ASSIGNED", "2026-10-27T09:00:00Z", now), true);
  assert.equal(isOrderOverdue("IN_DELIVERY", "2026-10-27T11:00:00Z", now), false, "échéance à venir");
  assert.equal(isOrderOverdue("DELIVERED", "2026-10-20T09:00:00Z", now), false);
  assert.equal(isOrderOverdue("CANCELLED", "2026-10-20T09:00:00Z", now), false);
  assert.equal(isOrderOverdue("PENDING", null, now), false);
});

test("le lieu n'ajoute la ville que si l'adresse ne la contient pas", async () => {
  const { formatPlace } = await import("../src/lib/format/place");
  assert.equal(formatPlace("12 rue Lepic", "Paris"), "12 rue Lepic, Paris");
  assert.equal(formatPlace("8 rue Oberkampf, 75011 Paris", "Paris"), "8 rue Oberkampf, 75011 Paris");
  assert.equal(formatPlace(null, " "), null);
});
