import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { computeDispatchIncidents, type DispatchIncidentInput } from "../src/lib/dispatch/dispatch-incidents";

// Midi à Paris (heure d'hiver).
const NOW = new Date("2026-11-03T11:00:00.000Z");
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);
// 23:59 à Paris : commande « au jour ».
const TODAY_WHOLE_DAY = new Date("2026-11-03T22:59:00.000Z");
const YESTERDAY_WHOLE_DAY = new Date("2026-11-02T22:59:00.000Z");

const row = (over: Partial<DispatchIncidentInput>): DispatchIncidentInput => ({
  id: "d1", reference: "LIV-1", status: "ASSIGNED", driverId: "u1", driverName: "Marie D.",
  driverActive: true, driverOnDuty: true, missionStarted: false, deadline: minutes(600), ...over,
});
const one = (over: Partial<DispatchIncidentInput>) => computeDispatchIncidents([row(over)], NOW)[0];

test("sans imprévu : mission à l'heure, ou commande au jour pas encore terminée", () => {
  assert.equal(one({}), undefined);
  assert.equal(one({ status: "PENDING", driverId: null, deadline: TODAY_WHOLE_DAY }), undefined);
  assert.equal(one({ driverOnDuty: false, deadline: TODAY_WHOLE_DAY }), undefined, "aucune heure promise");
  assert.equal(one({ status: "DELIVERED", deadline: minutes(-30) }), undefined);
  assert.equal(one({ status: "PENDING", driverId: null, deadline: null }), undefined);
});

test("retard : la commande au jour ne l'est qu'une fois la journée passée", () => {
  assert.equal(one({ deadline: minutes(-1) })?.kind, "LATE");
  assert.equal(one({ deadline: YESTERDAY_WHOLE_DAY })?.kind, "LATE");
});

test("une mission démarrée en retard reste un retard", () => {
  const incident = one({ status: "IN_DELIVERY", missionStarted: true, deadline: minutes(-5) });
  assert.equal(incident?.kind, "LATE");
});

test("livreur indisponible : compte inactif, ou hors service à l'approche de l'échéance", () => {
  const inactive = one({ driverActive: false });
  assert.equal(inactive?.kind, "DRIVER_UNAVAILABLE");
  assert.equal(one({ driverOnDuty: false, deadline: minutes(90) })?.kind, "DRIVER_OFF_DUTY");
  assert.equal(one({ driverOnDuty: false, deadline: minutes(-5) })?.kind, "DRIVER_OFF_DUTY");
  assert.equal(one({ driverOnDuty: false, deadline: minutes(180) }), undefined, "trop tôt pour alerter");
});

test("commande urgente sans livreur", () => {
  const urgent = one({ status: "PENDING", driverId: null, driverName: null, driverActive: false, driverOnDuty: false, deadline: minutes(45) });
  assert.equal(urgent?.kind, "DUE_SOON_UNASSIGNED");
  assert.equal(one({ status: "PENDING", driverId: null, deadline: minutes(90) }), undefined);
});

test("tri par gravité puis échéance, sans aucune coordonnée en sortie", () => {
  const list = computeDispatchIncidents([
    row({ id: "urgent", status: "PENDING", driverId: null, deadline: minutes(30) }),
    row({ id: "tard", reference: "B", deadline: minutes(-5) }),
    row({ id: "plustard", reference: "A", deadline: minutes(-60) }),
    row({ id: "absent", driverActive: false }),
  ], NOW);
  assert.deepEqual(list.map((incident) => incident.deliveryId), ["absent", "plustard", "tard", "urgent"]);
  assert.ok(!/latitude|longitude|accuracy/i.test(JSON.stringify(list)));
});

test("la route exige un rôle de dispatch et ne lit pas les positions", () => {
  const route = readFileSync("src/app/api/dispatch/incidents/route.ts", "utf8");
  assert.match(route, /requireRole\(auth\.context, \["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"\]\)/);
  const service = readFileSync("src/domains/delivery/dispatch-incidents.service.ts", "utf8");
  assert.ok(!/driverLocation|latitude|longitude/.test(service));
  assert.match(service, /companyId,\s+status: \{ in:/);
});
