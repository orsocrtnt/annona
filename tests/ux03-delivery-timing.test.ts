import assert from "node:assert/strict";
import test from "node:test";
import { deliveryTiming } from "../src/domains/delivery/delivery-timing";

const now = new Date("2026-10-27T15:00:00.000Z");
const due = new Date("2026-10-27T14:00:00.000Z");
const base = { requestedDeliveryDate: due, completedAt: null, driverId: "driver-a", missionAcceptedAt: null, hasProof: false, now };

test("UX-03 : prochaine action selon le statut, l'affectation et l'acceptation", () => {
  const action = (patch: Partial<Parameters<typeof deliveryTiming>[0]>) => deliveryTiming({ ...base, status: "PENDING", ...patch }).nextAction?.code ?? null;
  assert.equal(action({ status: "PENDING", driverId: null }), "ASSIGN_DRIVER");
  assert.equal(action({ status: "ASSIGNED", driverId: null }), "ASSIGN_DRIVER");
  assert.equal(action({ status: "ASSIGNED" }), "AWAIT_DRIVER_ACCEPTANCE");
  assert.equal(action({ status: "ASSIGNED", missionAcceptedAt: new Date("2026-10-27T13:00:00.000Z") }), "AWAIT_MISSION_START");
  assert.equal(action({ status: "IN_DELIVERY", requestedDeliveryDate: new Date("2026-10-27T16:00:00.000Z") }), "FOLLOW_DELIVERY");
  assert.equal(action({ status: "IN_DELIVERY" }), "FOLLOW_LATE_DELIVERY");
  assert.equal(action({ status: "PURCHASING" }), "FOLLOW_LATE_DELIVERY");
  assert.equal(action({ status: "DELIVERED", completedAt: due, hasProof: true }), null);
  assert.equal(action({ status: "DELIVERED", completedAt: due }), "CHECK_MISSING_PROOF");
  assert.equal(action({ status: "FAILED", completedAt: due }), "HANDLE_FAILURE");
  for (const status of ["CANCELLED", "INVOICED", "PAID"] as const) assert.equal(action({ status }), null, status);
});

test("UX-03 : retard calculé par la règle du tableau de bord, en cours ou à la fin", () => {
  const active = deliveryTiming({ ...base, status: "IN_DELIVERY" });
  assert.deepEqual([active.late, active.lateByMinutes, active.dueAt], [true, 60, due.toISOString()]);
  const deliveredLate = deliveryTiming({ ...base, status: "DELIVERED", completedAt: new Date("2026-10-27T14:20:00.000Z"), hasProof: true });
  assert.deepEqual([deliveredLate.late, deliveredLate.lateByMinutes], [true, 20], "le retard d'une livraison terminée est figé à sa fin");
  const onTime = deliveryTiming({ ...base, status: "DELIVERED", completedAt: new Date("2026-10-27T13:59:00.000Z"), hasProof: true });
  assert.deepEqual([onTime.late, onTime.lateByMinutes], [false, null]);
  const undated = deliveryTiming({ ...base, status: "IN_DELIVERY", requestedDeliveryDate: null });
  assert.deepEqual([undated.late, undated.lateByMinutes, undated.dueAt], [false, null, null], "données anciennes sans échéance");
  const pending = deliveryTiming({ ...base, status: "PENDING", driverId: null });
  assert.equal(pending.late, true, "une livraison en attente après son échéance est en retard");
  assert.equal(deliveryTiming({ ...base, status: "CANCELLED" }).late, false);
});
