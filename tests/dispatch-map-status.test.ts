import assert from "node:assert/strict";
import test from "node:test";
import { countDispatchMapStatuses, getDispatchMapStatus } from "../src/features/back-office/dispatch-map-status";
import type { DispatchMapDelivery } from "../src/domains/delivery/dispatch-map.service";

const now = new Date("2026-10-26T12:00:00");
const base = { id: "d", status: "ASSIGNED", driverId: "drv", missionStartedAt: null, requestedDeliveryDate: null, completedAt: null } as const;

test("la carte classe chaque livraison comme le pilotage du dashboard", () => {
  assert.equal(getDispatchMapStatus({ ...base, requestedDeliveryDate: "2026-10-26T10:00:00" }, now), "late", "échéance dépassée");
  assert.equal(getDispatchMapStatus({ ...base, status: "PENDING", driverId: null }, now), "unassigned");
  assert.equal(getDispatchMapStatus(base, now), "pending", "assignée, mission non démarrée");
  assert.equal(getDispatchMapStatus({ ...base, missionStartedAt: "2026-10-26T11:00:00" }, now), "route");
  assert.equal(getDispatchMapStatus({ ...base, status: "IN_DELIVERY" }, now), "route");
});

test("AUDIT-0411 : les filtres comptent comme le tableau de bord (un retard reste dans son état)", () => {
  const rows = [
    { ...base, id: "a", requestedDeliveryDate: "2026-10-26T10:00:00" },
    { ...base, id: "b", status: "PENDING", driverId: null },
    { ...base, id: "c" },
  ] as unknown as DispatchMapDelivery[];
  assert.deepEqual(countDispatchMapStatuses(rows, now), { late: 1, unassigned: 1, pending: 2, route: 0 });
});
