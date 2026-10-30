import assert from "node:assert/strict";
import test from "node:test";
import { requestedDeliveryInstant } from "../src/domains/order/delivery-slot";
import { dateTimeLabel, relativeDayLabel } from "../src/lib/format/relative-day";
import { isOrderOverdue } from "../src/lib/orders/overdue";
import { isWholeDayDue } from "../src/lib/orders/whole-day-due";

test("une date seule vaut la fin de la journée à Paris, heure d'hiver comme d'été", () => {
  assert.equal(requestedDeliveryInstant("2026-10-30").toISOString(), "2026-10-30T22:59:00.000Z");
  assert.equal(requestedDeliveryInstant("2027-07-01").toISOString(), "2027-07-01T21:59:00.000Z");
});

test("une date avec heure n'est pas modifiée", () => {
  assert.equal(requestedDeliveryInstant("2026-10-30T11:00:00.000Z").toISOString(), "2026-10-30T11:00:00.000Z");
});

test("commande au jour pour aujourd'hui : pas de retard avant minuit à Paris, retard ensuite", () => {
  const due = requestedDeliveryInstant("2026-10-30");
  assert.equal(isOrderOverdue("PENDING", due, new Date("2026-10-30T15:00:00Z")), false, "16:00 à Paris");
  assert.equal(isOrderOverdue("PENDING", due, new Date("2026-10-30T22:30:00Z")), false, "23:30 à Paris");
  assert.equal(isOrderOverdue("PENDING", due, new Date("2026-10-30T23:30:00Z")), true, "lendemain à Paris");
});

test("affichage : la journée sans heure inventée ; une vraie heure reste affichée", () => {
  const now = new Date("2026-10-30T15:00:00Z");
  const due = requestedDeliveryInstant("2026-10-30");
  assert.equal(isWholeDayDue(due), true);
  assert.equal(relativeDayLabel(due, now, { withTime: true }), "Aujourd'hui");
  assert.equal(relativeDayLabel(requestedDeliveryInstant("2026-10-31"), now, { withTime: true }), "Demain");
  assert.equal(dateTimeLabel(due), "30 oct. 2026");
  assert.equal(relativeDayLabel("2026-10-30T13:30:00Z", now, { withTime: true }), "Aujourd'hui 14:30");
  assert.equal(dateTimeLabel("2026-10-30T13:30:00Z"), "30 oct. 2026 à 14:30");
  assert.equal(isWholeDayDue(null), false);
});

test("à l'affectation, une commande au jour n'annonce aucune arrivée : son échéance n'est pas une heure promise", async () => {
  const { readFileSync } = await import("node:fs");
  assert.match(readFileSync("src/domains/delivery/delivery.service.ts", "utf8"), /estimatedArrival: isWholeDayDue\(current\.scheduledAt\) \? null : current\.scheduledAt/);
});
