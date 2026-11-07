/**
 * TOUR-1 — tournées (ADM-06 à ADM-08) et application livreur (LIV-01 à LIV-06), critères 6, 7 et 8.
 * Base en mémoire (`helpers/memory-db.ts`) : réordonnancement, déplacement, attribution, validation,
 * journal, droits, isolation, « Livré » idempotent, rejeu hors ligne, incident, liens Plans / Waze.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { ROLE_PERMISSIONS } from "../prisma/reference-data";
import type { DayLockState } from "../src/domains/order/order-lock.service";
import {
  assignRoundDriver,
  createRound,
  deleteRound,
  describeRoundAudit,
  getRoundsDay,
  moveStop,
  optimizeRound,
  reorderRoundStops,
  validateRounds,
  type RoundDb,
} from "../src/domains/round/round-admin.service";
import { getDriverRounds, markStopDelivered, reportStopIncident, startRound, type DriverRoundDb, type PhotoStore } from "../src/domains/round/round-driver.service";
import { getLiveDashboard, type LiveDb } from "../src/domains/round/round-live.service";
import {
  deliveryInstant,
  loadingOrder,
  moveStopBetween,
  moveWithinRound,
  nextPendingStop,
  stopPackages,
  validateStopOrder,
} from "../src/domains/round/round-rules";
import { applyPendingActions } from "../src/features/driver/round/effective-rounds";
import {
  createQueuedDriverAction,
  enqueueDriverAction,
  processQueuedDriverActions,
  settleSentDriverActions,
  type DriverActionQueueStore,
  type QueuedDriverAction,
} from "../src/features/driver/offline-action-queue";
import { DriverApiError } from "../src/features/driver/driver-api-error";
import { straightLineSeconds } from "../src/lib/dispatch/travel-time";
import { appleMapsUrl, wazeUrl } from "../src/lib/maps/navigation-links";
import { getPageAccessRule } from "../src/lib/permissions/page-access";
import { createMemoryDb } from "./helpers/memory-db";

type Row = Record<string, unknown>;
const PARIS = "Europe/Paris";
const J = "2026-11-10";
const day = (date: string) => new Date(`${date}T00:00:00.000Z`);
/** 10 novembre 2026, 5 h 30 à Paris : le jour de la tournée, après l'heure limite de la veille. */
const NOW = new Date("2026-11-10T04:30:00.000Z");
/** Veille au soir, 19 h à Paris : après l'heure limite (17 h). */
const EVE = new Date("2026-11-09T18:00:00.000Z");
const ADMIN_A = { companyId: "A", userId: "adminA" };
const ADMIN_B = { companyId: "B", userId: "adminB" };
const DRIVER_1 = { companyId: "A", userId: "driver1" };
const DRIVER_2 = { companyId: "A", userId: "driver2" };
const DRIVER_B = { companyId: "B", userId: "driverB" };
const closedDay: DayLockState = { date: J, cutoffAt: new Date("2026-11-09T16:00:00.000Z"), closed: true, lockedAt: new Date("2026-11-09T16:00:00.000Z") };

function merchant(id: string, companyId: string, name: string, latitude: number | null, longitude: number | null) {
  return { id, companyId, name, tradeName: null, address: `${id} rue de Test`, postalCode: "75011", city: "Paris", latitude, longitude, accessInstructions: id === "M1" ? "Code 1234" : null, contactPhone: null, active: true };
}
function order(id: string, companyId: string, merchantId: string, status = "LOCKED") {
  return { id, companyId, merchantId, reference: `C-${id}`, deliveryDate: day(J), slotId: companyId === "A" ? "s6" : "sB", status, origin: "MANUAL", deliveredAt: null };
}
function line(id: string, orderId: string, productId: string, quantityOrdered: number, quantityDelivered: number | null = null, companyId = "A") {
  return { id, companyId, orderId, productId, quantityOrdered, quantityDelivered };
}
function stop(id: string, roundId: string, orderId: string, sequence: number, companyId = "A") {
  return { id, companyId, roundId, orderId, sequence, status: "PENDING", estimatedArrivalAt: null, deliveredAt: null, incidentCode: null, incidentComment: null, incidentPhotoPath: null, incidentAt: null, createdAt: new Date(0) };
}
function round(id: string, companyId: string, name: string, extra: Row = {}) {
  return { id, companyId, date: day(J), slotId: companyId === "A" ? "s6" : "sB", name, status: "DRAFT", driverId: null, startedAt: null, completedAt: null, createdAt: new Date(id.length), ...extra };
}

function fixture() {
  const tables: Record<string, Row[]> = {
    company: [
      { id: "A", status: "ACTIVE", cutoffTime: "17:00", timezone: PARIS, depotLatitude: 48.8547, depotLongitude: 2.3725 },
      { id: "B", status: "ACTIVE", cutoffTime: "17:00", timezone: PARIS, depotLatitude: null, depotLongitude: null },
    ],
    role: [
      { id: "role-driver", systemRole: "DRIVER" },
      { id: "role-admin", systemRole: "ADMIN" },
    ],
    user: [
      { id: "adminA", companyId: "A", roleId: "role-admin", status: "ACTIVE", firstName: "Alice", lastName: "Admin" },
      { id: "adminB", companyId: "B", roleId: "role-admin", status: "ACTIVE", firstName: "Bob", lastName: "Admin" },
      { id: "driver1", companyId: "A", roleId: "role-driver", status: "ACTIVE", firstName: "Mathis", lastName: "Livreur" },
      { id: "driver2", companyId: "A", roleId: "role-driver", status: "ACTIVE", firstName: "Lina", lastName: "Livreur" },
      { id: "driverOff", companyId: "A", roleId: "role-driver", status: "DISABLED", firstName: "Ancien", lastName: "Livreur" },
      { id: "driverB", companyId: "B", roleId: "role-driver", status: "ACTIVE", firstName: "Bea", lastName: "Livreur" },
    ],
    merchant: [
      merchant("M1", "A", "Café Un", 48.86, 2.37),
      merchant("M2", "A", "Bistrot Deux", 48.87, 2.38),
      merchant("M3", "A", "Épicerie Trois", 48.85, 2.36),
      merchant("M4", "A", "Hôtel Quatre", null, null),
      merchant("MB", "B", "Hôtel B", 45.76, 4.83),
    ],
    slot: [
      { id: "s6", companyId: "A", label: null, startTime: "06:00", endTime: "07:00", active: true, sortOrder: 1 },
      { id: "s7", companyId: "A", label: null, startTime: "07:00", endTime: "08:00", active: true, sortOrder: 2 },
      { id: "sB", companyId: "B", label: null, startTime: "06:00", endTime: "07:00", active: true, sortOrder: 1 },
    ],
    product: [
      { id: "baguette", companyId: "A", name: "Baguette", unit: "pièce", sortOrder: 1 },
      { id: "croissant", companyId: "A", name: "Croissant", unit: "pièce", sortOrder: 2 },
    ],
    order: [order("o1", "A", "M1"), order("o2", "A", "M2", "PREPARED"), order("o3", "A", "M3"), order("o4", "A", "M4"), order("oB", "B", "MB")],
    orderLine: [
      line("l1", "o1", "baguette", 30),
      line("l2", "o1", "croissant", 12),
      line("l3", "o2", "baguette", 15, 15),
      line("l4", "o3", "croissant", 6),
      line("l5", "o4", "baguette", 4, 0),
      line("l6", "o4", "croissant", 8),
      line("lB", "oB", "baguette", 3, null, "B"),
    ],
    round: [
      round("rA", "A", "Tournée 6h – 7h · A"),
      round("rB", "A", "Tournée 6h – 7h · B"),
      round("r7", "A", "Tournée 7h – 8h", { slotId: "s7" }),
      round("rX", "B", "Tournée B"),
    ],
    stop: [stop("st1", "rA", "o1", 1), stop("st2", "rA", "o2", 2), stop("st3", "rA", "o3", 3), stop("st4", "rB", "o4", 1), stop("stB", "rX", "oB", 1, "B")],
    auditLog: [],
    driverLocation: [],
  };
  return { tables, db: createMemoryDb(tables) as unknown as RoundDb & DriverRoundDb & LiveDb };
}

const sequencesOf = (tables: Record<string, Row[]>, roundId: string) =>
  tables.stop!.filter((row) => row.roundId === roundId).sort((a, b) => (a.sequence as number) - (b.sequence as number)).map((row) => `${row.id}:${row.sequence}`);

function notifier() {
  const calls: Array<{ roundId: string; driverId: string }> = [];
  return { calls, notify: async (input: { companyId: string; roundId: string; driverId: string }) => void calls.push({ roundId: input.roundId, driverId: input.driverId }) };
}

// ---------------------------------------------------------------------------
// Règles pures
// ---------------------------------------------------------------------------

test("ADM-06 : ordre complet exigé, déplacements sans trou dans la numérotation", () => {
  assert.deepEqual(validateStopOrder(["a", "b", "c"], ["c", "a", "b"]), ["c", "a", "b"]);
  assert.equal(validateStopOrder(["a", "b", "c"], ["a", "b"]), null);
  assert.equal(validateStopOrder(["a", "b", "c"], ["a", "b", "b"]), null);
  assert.equal(validateStopOrder(["a", "b"], ["a", "x"]), null);
  assert.deepEqual(moveWithinRound(["a", "b", "c", "d"], "a", 3), ["b", "c", "a", "d"]);
  assert.deepEqual(moveWithinRound(["a", "b", "c", "d"], "d", 1), ["d", "a", "b", "c"]);
  assert.deepEqual(moveStopBetween(["a", "b", "c"], ["x"], "b", 1), { source: ["a", "c"], target: ["b", "x"] });
  assert.deepEqual(moveStopBetween(["a", "b"], ["x", "y"], "a", null), { source: ["b"], target: ["x", "y", "a"] });
  assert.deepEqual(moveStopBetween(["a"], [], "a", 9), { source: [], target: ["a"] });
});

test("LIV-01, LIV-02 : un colis par ligne (lignes à zéro exclues), chargement en ordre inverse", () => {
  assert.deepEqual(stopPackages([{ quantityOrdered: 30, quantityDelivered: null }, { quantityOrdered: 12, quantityDelivered: 10 }, { quantityOrdered: 4, quantityDelivered: 0 }]), { packages: 2, items: 40 });
  assert.deepEqual(loadingOrder([{ sequence: 1 }, { sequence: 3 }, { sequence: 2 }]).map((row) => row.sequence), [3, 2, 1]);
});

test("LIV-04 : l'arrêt proposé après « Livré » est le suivant encore à livrer", () => {
  const stops = [
    { id: "a", sequence: 1, status: "DELIVERED" as const },
    { id: "b", sequence: 2, status: "PENDING" as const },
    { id: "c", sequence: 3, status: "INCIDENT" as const },
    { id: "d", sequence: 4, status: "PENDING" as const },
  ];
  assert.equal(nextPendingStop(stops)?.id, "b");
  assert.equal(nextPendingStop(stops, "b")?.id, "d");
  assert.equal(nextPendingStop(stops, "d")?.id, "b");
  assert.equal(nextPendingStop(stops.map((row) => ({ ...row, status: "DELIVERED" as const })), "d"), null);
});

test("LIV-03 : horodatage du geste, heure du serveur si l'heure du téléphone est absurde", () => {
  const now = new Date("2026-11-10T06:00:00.000Z");
  assert.equal(deliveryInstant("2026-11-10T05:12:00.000Z", now).toISOString(), "2026-11-10T05:12:00.000Z");
  assert.equal(deliveryInstant(null, now), now);
  assert.equal(deliveryInstant("2026-11-10T07:00:00.000Z", now), now);
  assert.equal(deliveryInstant("2026-10-01T05:00:00.000Z", now), now);
  assert.equal(deliveryInstant("pas une date", now), now);
});

test("LIV-04, critère 7 : liens Plans et Waze vers l'arrêt", () => {
  const target = { latitude: 48.8566, longitude: 2.3522, address: "1 rue de Rivoli, 75001 Paris" };
  assert.equal(appleMapsUrl(target), "https://maps.apple.com/?daddr=48.856600,2.352200&dirflg=d");
  assert.equal(wazeUrl(target), "https://waze.com/ul?ll=48.856600,2.352200&navigate=yes");
  const noPoint = { latitude: null, longitude: null, address: "3 rue d'Été, 75011 Paris" };
  assert.equal(appleMapsUrl(noPoint), "https://maps.apple.com/?daddr=3%20rue%20d'%C3%89t%C3%A9%2C%2075011%20Paris&dirflg=d");
  assert.equal(wazeUrl(noPoint), "https://waze.com/ul?q=3%20rue%20d'%C3%89t%C3%A9%2C%2075011%20Paris&navigate=yes");
  assert.equal(wazeUrl({ latitude: 200, longitude: 2, address: "x" }), "https://waze.com/ul?q=x&navigate=yes");
});

// ---------------------------------------------------------------------------
// Administrateur
// ---------------------------------------------------------------------------

test("ADM-06, critère 6 : réordonner puis déplacer un arrêt ; le livreur voit le nouvel ordre", async () => {
  const { tables, db } = fixture();
  const { notify } = notifier();
  await assignRoundDriver(ADMIN_A, "rA", "driver1", { db, now: EVE, notifyDriver: notify });
  await validateRounds(ADMIN_A, J, { db, now: EVE, notifyDriver: notify });

  await reorderRoundStops(ADMIN_A, "rA", ["st3", "st1", "st2"], { db, now: EVE });
  assert.deepEqual(sequencesOf(tables, "rA"), ["st3:1", "st1:2", "st2:3"]);
  await assert.rejects(reorderRoundStops(ADMIN_A, "rA", ["st3", "st1"], { db, now: EVE }), /changé entre-temps/);

  await moveStop(ADMIN_A, "st1", { roundId: "rB", position: 1 }, { db, now: EVE });
  assert.deepEqual(sequencesOf(tables, "rA"), ["st3:1", "st2:2"]);
  assert.deepEqual(sequencesOf(tables, "rB"), ["st1:1", "st4:2"]);
  // RG-08 : jamais vers un autre créneau.
  await assert.rejects(moveStop(ADMIN_A, "st2", { roundId: "r7" }, { db, now: EVE }), /même créneau/);

  const driverView = await getDriverRounds(DRIVER_1, { db, now: NOW });
  assert.equal(driverView.date, J);
  assert.deepEqual(driverView.rounds[0]!.stops.map((row) => `${row.sequence}. ${row.merchantName}`), ["1. Épicerie Trois", "2. Bistrot Deux"]);
});

test("ADM-06 : recalcul de l'ordre (arrêts faits en tête), création et suppression d'une tournée vide", async () => {
  const { tables, db } = fixture();
  tables.stop!.find((row) => row.id === "st2")!.status = "DELIVERED";
  const result = await optimizeRound(ADMIN_A, "rA", { db, now: EVE, travelMatrix: async () => ({ seconds: straightLineSeconds, approximate: true }) });
  assert.equal(result.stopIds[0], "st2");
  assert.deepEqual(new Set(result.stopIds), new Set(["st1", "st2", "st3"]));
  assert.deepEqual(sequencesOf(tables, "rA").map((row) => row.split(":")[1]), ["1", "2", "3"]);

  // Avant l'heure limite : pas de tournée créée à la main (le calcul automatique n'a pas eu lieu).
  await assert.rejects(createRound(ADMIN_A, { date: J, slotId: "s6" }, { db, now: new Date("2026-11-09T10:00:00.000Z") }), /pas encore calculées/);
  const created = await createRound(ADMIN_A, { date: J, slotId: "s6" }, { db, now: EVE });
  assert.equal(created.name, "Tournée 6h – 7h · C");
  await assert.rejects(deleteRound(ADMIN_A, "rA", { db, now: EVE }), /sans arrêt/);
  await deleteRound(ADMIN_A, created.id, { db, now: EVE });
  assert.equal(tables.round!.some((row) => row.id === created.id), false);
});

test("ADM-07 : attribution, validation, notification et retrait du livreur", async () => {
  const { tables, db } = fixture();
  const { calls, notify } = notifier();
  // Brouillon : attribué mais pas encore visible ni notifié.
  await assignRoundDriver(ADMIN_A, "rA", "driver1", { db, now: EVE, notifyDriver: notify });
  assert.equal(calls.length, 0);
  assert.deepEqual((await getDriverRounds(DRIVER_1, { db, now: NOW })).rounds, []);
  await assert.rejects(assignRoundDriver(ADMIN_A, "rA", "driverOff", { db, now: EVE, notifyDriver: notify }), /Livreur introuvable/);
  await assert.rejects(assignRoundDriver(ADMIN_A, "rA", "driverB", { db, now: EVE, notifyDriver: notify }), /Livreur introuvable/);

  const validation = await validateRounds(ADMIN_A, J, { db, now: EVE, notifyDriver: notify });
  assert.equal(validation.validated, 1);
  assert.deepEqual(validation.withoutDriver, ["Tournée 6h – 7h · B"]);
  assert.deepEqual(validation.empty, ["Tournée 7h – 8h"]);
  assert.equal(tables.round!.find((row) => row.id === "rA")!.status, "ASSIGNED");
  assert.deepEqual(calls, [{ roundId: "rA", driverId: "driver1" }]);

  // Changement de livreur d'une tournée validée : le nouveau est notifié, l'ancien ne la voit plus.
  await assignRoundDriver(ADMIN_A, "rA", "driver2", { db, now: EVE, notifyDriver: notify });
  assert.deepEqual(calls.at(-1), { roundId: "rA", driverId: "driver2" });
  assert.deepEqual((await getDriverRounds(DRIVER_1, { db, now: NOW })).rounds, []);
  assert.equal((await getDriverRounds(DRIVER_2, { db, now: NOW })).rounds.length, 1);

  await assignRoundDriver(ADMIN_A, "rA", null, { db, now: EVE, notifyDriver: notify });
  assert.equal(tables.round!.find((row) => row.id === "rA")!.status, "DRAFT");
});

test("RG-10 : chaque modification est journalisée (qui, quand, avant, après, après l'heure limite)", async () => {
  const { tables, db } = fixture();
  const { notify } = notifier();
  await assignRoundDriver(ADMIN_A, "rA", "driver1", { db, now: EVE, notifyDriver: notify });
  await moveStop(ADMIN_A, "st1", { roundId: "rB" }, { db, now: EVE });
  await reorderRoundStops(ADMIN_A, "rA", ["st3", "st2"], { db, now: EVE });
  const rows = tables.auditLog!.filter((row) => row.entityType === "RoundDay");
  assert.deepEqual(rows.map((row) => row.action), ["ROUND_ASSIGN", "STOP_MOVE", "ROUND_REORDER"]);
  assert.ok(rows.every((row) => row.actorId === "adminA" && row.entityId === J && (row.after as Row).afterCutoff === true));
  const day_ = await getRoundsDay("A", closedDay, db);
  assert.deepEqual(day_.journal.map((entry) => entry.action).sort(), ["ROUND_ASSIGN", "ROUND_REORDER", "STOP_MOVE"]);
  assert.ok(day_.journal.every((entry) => entry.afterCutoff));
  assert.equal(day_.journal.find((entry) => entry.action === "STOP_MOVE")!.actorName, "Alice Admin");
  assert.deepEqual(describeRoundAudit("STOP_MOVE", { merchantName: "Café Un", roundName: "A" }, { roundName: "B" }), ["Café Un : A → B"]);
  assert.deepEqual(describeRoundAudit("ROUND_ASSIGN", { driverName: null }, { driverName: "Mathis Livreur" }), ["sans livreur → Mathis Livreur"]);
});

test("PLA-01 : un administrateur ne lit ni ne modifie les tournées d'une autre entreprise", async () => {
  const { db } = fixture();
  const { notify } = notifier();
  await assert.rejects(assignRoundDriver(ADMIN_B, "rA", "driverB", { db, now: EVE, notifyDriver: notify }), /Tournée introuvable/);
  await assert.rejects(moveStop(ADMIN_B, "st1", { roundId: "rX" }, { db, now: EVE }), /Arrêt introuvable/);
  await assert.rejects(moveStop(ADMIN_A, "st1", { roundId: "rX" }, { db, now: EVE }), /Tournée introuvable/);
  await assert.rejects(reorderRoundStops(ADMIN_B, "rA", ["st1", "st2", "st3"], { db, now: EVE }), /Tournée introuvable/);
  await assert.rejects(deleteRound(ADMIN_B, "rA", { db, now: EVE }), /Tournée introuvable/);
  const dayB = await getRoundsDay("B", closedDay, db);
  assert.deepEqual(dayB.rounds.map((row) => row.id), ["rX"]);
  assert.deepEqual(dayB.drivers.map((row) => row.id), ["driverB"]);
  const liveB = await getLiveDashboard("B", { db, now: NOW });
  assert.deepEqual(liveB.rounds.map((row) => row.id), ["rX"]);
});

// ---------------------------------------------------------------------------
// Livreur
// ---------------------------------------------------------------------------

async function assignedFixture() {
  const fx = fixture();
  const { notify } = notifier();
  await assignRoundDriver(ADMIN_A, "rA", "driver1", { db: fx.db, now: EVE, notifyDriver: notify });
  await assignRoundDriver(ADMIN_A, "rB", "driver2", { db: fx.db, now: EVE, notifyDriver: notify });
  await validateRounds(ADMIN_A, J, { db: fx.db, now: EVE, notifyDriver: notify });
  return fx;
}

test("LIV-01 : le livreur voit seulement ses tournées validées ; un autre livreur ou une autre entreprise n'y accède pas", async () => {
  const { db } = await assignedFixture();
  const mine = await getDriverRounds(DRIVER_1, { db, now: NOW });
  assert.equal(mine.today, J);
  assert.deepEqual(mine.rounds.map((row) => row.id), ["rA"]);
  const first = mine.rounds[0]!.stops[0]!;
  assert.equal(first.merchantName, "Café Un");
  assert.equal(first.accessInstructions, "Code 1234");
  assert.equal(first.packages, 2);
  assert.equal(first.items, 42);
  assert.equal(mine.rounds[0]!.slotLabel, "6h – 7h");
  assert.equal(mine.rounds[0]!.canStart, true);

  await assert.rejects(startRound(DRIVER_2, "rA", { db, now: NOW }), /Tournée introuvable/);
  await assert.rejects(markStopDelivered(DRIVER_2, "st1", { db, now: NOW }), /Arrêt introuvable/);
  await assert.rejects(markStopDelivered(DRIVER_B, "st1", { db, now: NOW }), /Arrêt introuvable/);
  await assert.rejects(reportStopIncident(DRIVER_2, "st1", { code: "ABSENT" }, { db, now: NOW }), /Arrêt introuvable/);
  // La veille au soir : consultable, pas démarrable.
  const eve = await getDriverRounds(DRIVER_1, { db, now: EVE });
  assert.equal(eve.date, J);
  assert.equal(eve.rounds[0]!.canStart, false);
  await assert.rejects(startRound(DRIVER_1, "rA", { db, now: EVE }), /jour de la livraison/);
});

test("LIV-03, LIV-06 : « Livré » idempotent, commande livrée, quantités figées, tournée terminée et position effacée", async () => {
  const { tables, db } = await assignedFixture();
  tables.driverLocation!.push({ driverId: "driver1", companyId: "A", latitude: 48.86, longitude: 2.37, updatedAt: NOW });
  await startRound(DRIVER_1, "rA", { db, now: NOW });
  const first = await markStopDelivered(DRIVER_1, "st1", { db, now: NOW, at: "2026-11-10T04:20:00.000Z" });
  assert.equal(first.replayed, false);
  const again = await markStopDelivered(DRIVER_1, "st1", { db, now: new Date("2026-11-10T05:00:00.000Z"), at: "2026-11-10T04:59:00.000Z" });
  assert.equal(again.replayed, true);
  assert.equal(again.deliveredAt, "2026-11-10T04:20:00.000Z");
  const o1 = tables.order!.find((row) => row.id === "o1")!;
  assert.equal(o1.status, "DELIVERED");
  assert.deepEqual(tables.orderLine!.filter((row) => row.orderId === "o1").map((row) => row.quantityDelivered), [30, 12]);
  assert.equal(tables.round!.find((row) => row.id === "rA")!.status, "IN_PROGRESS");

  await markStopDelivered(DRIVER_1, "st2", { db, now: NOW });
  await reportStopIncident(DRIVER_1, "st3", { code: "ABSENT", at: NOW.toISOString() }, { db, now: NOW });
  const rA = tables.round!.find((row) => row.id === "rA")!;
  assert.equal(rA.status, "COMPLETED");
  assert.equal(tables.driverLocation!.length, 0);
  // Un client absent repassé plus tard peut encore être livré.
  await markStopDelivered(DRIVER_1, "st3", { db, now: NOW });
  assert.equal(tables.stop!.find((row) => row.id === "st3")!.status, "DELIVERED");
});

test("LIV-06, critère 8 : « Livré » hors réseau rejoué au retour du réseau, sans doublon, visible par l'administrateur", async () => {
  const { tables, db } = await assignedFixture();
  const rows = new Map<string, QueuedDriverAction>();
  const store: DriverActionQueueStore = {
    async add(action) {
      if ([...rows.values()].some((row) => row.ownerId === action.ownerId && row.actionKey === action.actionKey)) throw new Error("duplicate");
      rows.set(action.id, action);
    },
    async put(action) { rows.set(action.id, action); },
    async delete(id) { rows.delete(id); },
    async list(ownerId) { return [...rows.values()].filter((row) => row.ownerId === ownerId).sort((a, b) => a.createdAt - b.createdAt); },
    async listAll() { return [...rows.values()]; },
  };
  const at = "2026-11-10T04:25:00.000Z";
  await enqueueDriverAction(store, createQueuedDriverAction({ ownerId: "driver1", actionKey: "round:rA:start", payload: { kind: "START", roundId: "rA", at }, now: 1 }));
  await enqueueDriverAction(store, createQueuedDriverAction({ ownerId: "driver1", actionKey: "stop:st1:delivered", payload: { kind: "DELIVERED", stopId: "st1", at }, now: 2 }));
  // Affichage immédiat sur le téléphone, avant tout envoi.
  const view = await getDriverRounds(DRIVER_1, { db, now: NOW });
  const effective = applyPendingActions(view.rounds, await store.list("driver1"));
  assert.equal(effective[0]!.status, "IN_PROGRESS");
  assert.equal(effective[0]!.stops[0]!.status, "DELIVERED");
  assert.equal(effective[0]!.stops[0]!.pendingSync, true);
  // Premier envoi en ligne : geste affiché, sans badge « en attente ».
  const sending = applyPendingActions(view.rounds, await store.list("driver1"), () => false);
  assert.equal(sending[0]!.stops[0]!.status, "DELIVERED");
  assert.equal(sending[0]!.stops[0]!.pendingSync, false);

  const send = async (action: QueuedDriverAction) => {
    const payload = action.payload;
    if (payload.kind === "START") return startRound(DRIVER_1, payload.roundId, { db, now: NOW, at: payload.at });
    if (payload.kind === "DELIVERED") return markStopDelivered(DRIVER_1, payload.stopId, { db, now: NOW, at: payload.at });
    throw new Error("inattendu");
  };
  const offline = await processQueuedDriverActions({ store, ownerId: "driver1", now: () => 10, send: async () => { throw new DriverApiError("Réseau indisponible.", { retryable: true }); } });
  assert.equal(offline.waiting.length, 2);
  assert.equal(tables.stop!.find((row) => row.id === "st1")!.status, "PENDING");

  // Retour du réseau : la première réponse se perd (envoi arrivé, réponse non reçue) puis rejeu.
  let lost = true;
  const flaky = async (action: QueuedDriverAction) => {
    const result = await send(action);
    if (lost && action.payload.kind === "DELIVERED") {
      lost = false;
      throw new DriverApiError("Réseau indisponible.", { retryable: true });
    }
    return result;
  };
  await processQueuedDriverActions({ store, ownerId: "driver1", force: true, now: () => 20, send: flaky });
  await processQueuedDriverActions({ store, ownerId: "driver1", force: true, now: () => 30, send: flaky });
  // RECETTE-V1 N1 : reçues par le serveur, gardées à l'écran jusqu'à une lecture fraîche de la tournée.
  assert.deepEqual([...rows.values()].map((row) => row.state), ["sent", "sent"]);
  await settleSentDriverActions(store, "driver1", 30);
  assert.equal(rows.size, 0);
  const st1 = tables.stop!.find((row) => row.id === "st1")!;
  assert.equal(st1.status, "DELIVERED");
  assert.equal((st1.deliveredAt as Date).toISOString(), at);
  assert.equal(tables.stop!.filter((row) => row.orderId === "o1").length, 1);

  const live = await getLiveDashboard("A", { db, now: NOW });
  const liveRound = live.rounds.find((row) => row.id === "rA")!;
  assert.deepEqual(liveRound.progress, { total: 3, delivered: 1, incidents: 0, remaining: 2 });
  assert.equal(liveRound.nextStopName, "Bistrot Deux");
  const adminDay = await getRoundsDay("A", closedDay, db);
  assert.equal(adminDay.rounds.find((row) => row.id === "rA")!.stops.find((row) => row.id === "st1")!.status, "DELIVERED");
});

test("LIV-05 : problème avec photo, rejeu sans seconde photo, incident vu par l'administrateur", async () => {
  const { tables, db } = await assignedFixture();
  const uploads: string[] = [];
  const removed: string[] = [];
  const photos: PhotoStore = {
    async upload({ companyId, stopId }) {
      const path = `${companyId}/${stopId}-${uploads.length + 1}.jpg`;
      uploads.push(path);
      return path;
    },
    async remove({ path }) { removed.push(path); },
  };
  const at = "2026-11-10T04:45:00.000Z";
  const photo = { bytes: Buffer.from([1, 2, 3]), contentType: "image/jpeg" };
  await reportStopIncident(DRIVER_1, "st2", { code: "DAMAGED", comment: "carton écrasé", at, photo }, { db, now: NOW, photos });
  const replay = await reportStopIncident(DRIVER_1, "st2", { code: "DAMAGED", comment: "carton écrasé", at, photo }, { db, now: NOW, photos });
  assert.equal(replay.replayed, true);
  assert.equal(uploads.length, 1);
  const st2 = tables.stop!.find((row) => row.id === "st2")!;
  assert.equal(st2.status, "INCIDENT");
  assert.equal(st2.incidentCode, "DAMAGED");
  assert.equal(st2.incidentPhotoPath, "A/st2-1.jpg");
  assert.equal(tables.order!.find((row) => row.id === "o2")!.status, "PREPARED");

  // Nouveau signalement (autre heure) : la nouvelle photo remplace l'ancienne.
  await reportStopIncident(DRIVER_1, "st2", { code: "REFUSED", comment: "", at: "2026-11-10T04:50:00.000Z", photo }, { db, now: NOW, photos });
  assert.deepEqual(removed, ["A/st2-1.jpg"]);

  const live = await getLiveDashboard("A", { db, now: NOW });
  assert.equal(live.incidents.length, 1);
  assert.equal(live.incidents[0]!.merchantName, "Bistrot Deux");
  assert.equal(live.incidents[0]!.code, "REFUSED");
  assert.equal(live.incidents[0]!.hasPhoto, true);
  assert.equal(live.totals.incidents, 1);
});

test("ENF-04 : position du livreur montrée seulement pendant sa tournée démarrée", async () => {
  const { tables, db } = await assignedFixture();
  tables.driverLocation!.push({ driverId: "driver1", companyId: "A", latitude: 48.86, longitude: 2.37, updatedAt: new Date("2026-11-10T04:00:00.000Z") });
  let live = await getLiveDashboard("A", { db, now: NOW });
  assert.equal(live.rounds.find((row) => row.id === "rA")!.driverPosition, null);
  await startRound(DRIVER_1, "rA", { db, now: NOW });
  // Position antérieure au démarrage : non montrée.
  live = await getLiveDashboard("A", { db, now: NOW });
  assert.equal(live.rounds.find((row) => row.id === "rA")!.driverPosition, null);
  tables.driverLocation![0]!.updatedAt = new Date("2026-11-10T04:35:00.000Z");
  live = await getLiveDashboard("A", { db, now: NOW });
  assert.deepEqual(live.rounds.find((row) => row.id === "rA")!.driverPosition, { latitude: 48.86, longitude: 2.37, updatedAt: "2026-11-10T04:35:00.000Z" });
  assert.equal(live.orders.total, 4);
});

// ---------------------------------------------------------------------------
// Droits des routes
// ---------------------------------------------------------------------------

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true }).map((entry) => join(dir, entry.toString())).filter((file) => file.endsWith("route.ts"));
}

test("Droits : routes administrateur réservées à ADMIN, routes livreur à DRIVER ; MERCHANT et BAKER refusés", () => {
  const admin = [...routeFiles("src/app/api/rounds"), ...routeFiles("src/app/api/stops"), "src/app/api/dashboard/live/route.ts"];
  assert.ok(admin.length >= 7);
  for (const file of admin) {
    const source = readFileSync(file, "utf8");
    const handlers = source.split(/export async function (?:GET|POST|PUT|PATCH|DELETE)/).slice(1);
    assert.ok(handlers.length > 0, file);
    for (const body of handlers) assert.match(body, /requireCompanyAdmin\("rounds:(read|manage)"\)/, file);
  }
  const driver = routeFiles("src/app/api/driver").filter((file) => /rounds|stops/.test(file));
  assert.equal(driver.length, 4);
  for (const file of driver) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /requireCompanyRole\(\["DRIVER"\], "(rounds:read|stops:update)"\)/, file);
    assert.doesNotMatch(source, /companyId: (?:body|input|form)/, file);
  }
  for (const permission of ["rounds:read", "rounds:manage", "stops:update"]) assert.equal(ROLE_PERMISSIONS.MERCHANT.includes(permission), false);
  assert.equal(ROLE_PERMISSIONS.BAKER.includes("rounds:manage"), false);
  assert.equal(ROLE_PERMISSIONS.BAKER.includes("stops:update"), false);
  assert.deepEqual([...(getPageAccessRule("/dashboard/rounds")?.roles ?? [])].sort(), ["ADMIN"]);
  assert.deepEqual([...(getPageAccessRule("/driver")?.roles ?? [])], ["DRIVER"]);
});
