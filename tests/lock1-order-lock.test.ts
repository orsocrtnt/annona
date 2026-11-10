import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  ensureDateLocked,
  lockDeliveryDate,
  lockDueDeliveryDates,
  recurringDecision,
  roundName,
  type LockDb,
} from "../src/domains/order/order-lock.service";
import { planSlotRounds, ROUND_MAX_STOPS } from "../src/domains/order/round-generation";
import {
  cancelAdminOrder,
  correctAdminOrder,
  correctedDelivered,
  getAdminOrder,
  listAdminOrders,
  type AdminOrderDb,
} from "../src/domains/order/admin-order.service";
import { describeOrderAudit } from "../src/domains/order/order-audit";
import { saveMerchantOrder, type OrderDb } from "../src/domains/order/merchant-order.service";
import { straightLineSeconds } from "../src/lib/dispatch/travel-time";
import { createMemoryDb } from "./helpers/memory-db";

type Row = Record<string, unknown>;
const PARIS = "Europe/Paris";
const at = (iso: string) => new Date(iso);
const day = (date: string) => new Date(`${date}T00:00:00.000Z`);
const J = "2026-11-10"; // mardi : heure limite lundi 9 novembre à 17:00 Paris = 16:00 UTC
const BEFORE = at("2026-11-09T15:59:00.000Z");
const CUTOFF = at("2026-11-09T16:00:00.000Z");
const travelMatrix = async () => ({ seconds: straightLineSeconds, approximate: true });

function fixture() {
  const tables: Record<string, Row[]> = {
    company: [
      { id: "A", status: "ACTIVE", cutoffTime: "17:00", timezone: PARIS, depotLatitude: 48.8547, depotLongitude: 2.3725 },
      { id: "B", status: "ACTIVE", cutoffTime: "17:00", timezone: PARIS, depotLatitude: 45.76, depotLongitude: 4.83 },
    ],
    merchant: [
      { id: "A1", companyId: "A", name: "Café A1", tradeName: null, address: "1 rue A", city: "Paris", active: true, latitude: 48.86, longitude: 2.35 },
      { id: "A2", companyId: "A", name: "Bistrot A2", tradeName: null, address: "2 rue A", city: "Paris", active: true, latitude: 48.87, longitude: 2.36 },
      { id: "A3", companyId: "A", name: "Épicerie A3", tradeName: null, address: "3 rue A", city: "Paris", active: true, latitude: 48.85, longitude: 2.38 },
      { id: "A4", companyId: "A", name: "Hôtel A4", tradeName: null, address: "4 rue A", city: "Paris", active: true, latitude: 48.84, longitude: 2.39 },
      { id: "A5", companyId: "A", name: "Kiosque A5", tradeName: null, address: "5 rue A", city: "Paris", active: true, latitude: null, longitude: null },
      { id: "B1", companyId: "B", name: "Hôtel B1", tradeName: null, address: "1 rue B", city: "Lyon", active: true, latitude: 45.75, longitude: 4.85 },
    ],
    slot: [
      { id: "s6", companyId: "A", label: null, startTime: "06:00", endTime: "07:00", active: true, sortOrder: 1 },
      { id: "s7", companyId: "A", label: null, startTime: "07:00", endTime: "08:00", active: true, sortOrder: 2 },
      { id: "sB", companyId: "B", label: null, startTime: "06:00", endTime: "07:00", active: true, sortOrder: 1 },
    ],
    category: [
      { id: "catA", companyId: "A", name: "Pains", sortOrder: 1, active: true },
      { id: "catB", companyId: "B", name: "Pains B", sortOrder: 1, active: true },
    ],
    product: [
      { id: "baguette", companyId: "A", categoryId: "catA", name: "Baguette", unit: "pièce", basePriceCents: 110, vatRateBasisPoints: 550, active: true, sortOrder: 1, photoUrl: null },
      { id: "croissant", companyId: "A", categoryId: "catA", name: "Croissant", unit: "pièce", basePriceCents: 85, vatRateBasisPoints: 550, active: true, sortOrder: 2, photoUrl: null },
      { id: "retired", companyId: "A", categoryId: "catA", name: "Ancien pain", unit: "pièce", basePriceCents: 300, vatRateBasisPoints: 550, active: false, sortOrder: 3, photoUrl: null },
      { id: "painB", companyId: "B", categoryId: "catB", name: "Pain B", unit: "pièce", basePriceCents: 200, vatRateBasisPoints: 550, active: true, sortOrder: 1, photoUrl: null },
    ],
    merchantPrice: [{ id: "pA1", companyId: "A", merchantId: "A1", productId: "baguette", priceCents: 95 }],
    recurringOrder: [
      // Critère 4 : A2 n'a rien commandé pour J → sa récurrente est générée.
      { id: "rA2", companyId: "A", merchantId: "A2", slotId: "s6", weekdays: [1, 2, 3, 4, 5, 6, 7], active: true, createdAt: new Date(1) },
      // Critère 4 : A1 a commandé à la main → pas de génération, la manuelle reste.
      { id: "rA1", companyId: "A", merchantId: "A1", slotId: "s6", weekdays: [2], active: true, createdAt: new Date(2) },
      // Règle prudente : A3 a annulé sa commande manuelle du jour (autre créneau) → rien.
      { id: "rA3", companyId: "A", merchantId: "A3", slotId: "s7", weekdays: [2], active: true, createdAt: new Date(3) },
      // Suspendue → rien ; jour non prévu → rien.
      { id: "rA4", companyId: "A", merchantId: "A4", slotId: "s6", weekdays: [2], active: false, createdAt: new Date(4) },
      { id: "rA5", companyId: "A", merchantId: "A5", slotId: "s6", weekdays: [1], active: true, createdAt: new Date(5) },
      // Autre entreprise : jamais touchée par le verrouillage de A.
      { id: "rB1", companyId: "B", merchantId: "B1", slotId: "sB", weekdays: [2], active: true, createdAt: new Date(6) },
    ],
    recurringOrderLine: [
      { id: "rl1", companyId: "A", recurringOrderId: "rA2", productId: "baguette", quantity: 20 },
      { id: "rl2", companyId: "A", recurringOrderId: "rA2", productId: "retired", quantity: 4 },
      { id: "rl3", companyId: "A", recurringOrderId: "rA1", productId: "croissant", quantity: 99 },
      { id: "rl4", companyId: "A", recurringOrderId: "rA3", productId: "croissant", quantity: 7 },
      { id: "rl5", companyId: "B", recurringOrderId: "rB1", productId: "painB", quantity: 5 },
    ],
    order: [
      { id: "oA1", companyId: "A", merchantId: "A1", reference: "C-A1", deliveryDate: day(J), slotId: "s6", status: "VALIDATED", origin: "MANUAL", notes: null, lockedAt: null, preparedAt: null },
      { id: "oA3", companyId: "A", merchantId: "A3", reference: "C-A3", deliveryDate: day(J), slotId: "s6", status: "CANCELLED", origin: "MANUAL", notes: null, lockedAt: null, preparedAt: null },
      { id: "oA4", companyId: "A", merchantId: "A4", reference: "C-A4", deliveryDate: day(J), slotId: "s7", status: "DRAFT", origin: "MANUAL", notes: null, lockedAt: null, preparedAt: null },
      { id: "oA5", companyId: "A", merchantId: "A5", reference: "C-A5", deliveryDate: day(J), slotId: "s7", status: "VALIDATED", origin: "MANUAL", notes: null, lockedAt: null, preparedAt: null },
      { id: "oB1", companyId: "B", merchantId: "B1", reference: "C-B1", deliveryDate: day(J), slotId: "sB", status: "VALIDATED", origin: "MANUAL", notes: null, lockedAt: null, preparedAt: null },
    ],
    orderLine: [
      { id: "l1", companyId: "A", orderId: "oA1", productId: "baguette", quantityOrdered: 30, quantityDelivered: null, unitPriceFrozenCents: null, createdAt: new Date(1) },
      { id: "l2", companyId: "A", orderId: "oA1", productId: "croissant", quantityOrdered: 10, quantityDelivered: null, unitPriceFrozenCents: null, createdAt: new Date(2) },
      { id: "l3", companyId: "A", orderId: "oA3", productId: "baguette", quantityOrdered: 5, quantityDelivered: null, unitPriceFrozenCents: null, createdAt: new Date(3) },
      { id: "l4", companyId: "A", orderId: "oA4", productId: "baguette", quantityOrdered: 8, quantityDelivered: null, unitPriceFrozenCents: null, createdAt: new Date(4) },
      { id: "l5", companyId: "A", orderId: "oA5", productId: "croissant", quantityOrdered: 12, quantityDelivered: null, unitPriceFrozenCents: null, createdAt: new Date(5) },
      { id: "l6", companyId: "B", orderId: "oB1", productId: "painB", quantityOrdered: 50, quantityDelivered: null, unitPriceFrozenCents: null, createdAt: new Date(6) },
    ],
    round: [],
    stop: [],
    auditLog: [],
    user: [
      { id: "admA", companyId: "A", firstName: "Alice", lastName: "Admin" },
      { id: "admB", companyId: "B", firstName: "Bruno", lastName: "Admin" },
    ],
  };
  const db = createMemoryDb(tables, {
    decorate: {
      product: (row, all) => ({ category: { active: Boolean((all.category ?? []).find((category) => category.id === row.categoryId)?.active) } }),
    },
  });
  return { db, tables };
}

const lockDb = (db: unknown) => db as LockDb;
const rows = (tables: Record<string, Row[]>, model: string, where: Row = {}) =>
  (tables[model] ?? []).filter((row) => Object.entries(where).every(([key, value]) => row[key] === value));
const orderOf = (tables: Record<string, Row[]>, id: string) => rows(tables, "order", { id })[0]!;
const lineOf = (tables: Record<string, Row[]>, orderId: string, productId: string) => rows(tables, "orderLine", { orderId, productId })[0]!;

/** État comparable de la base (sans les horodatages) pour l'idempotence. */
function signature(tables: Record<string, Row[]>) {
  const pick = (model: string, keys: string[]) =>
    rows(tables, model)
      .map((row) => keys.map((key) => String(row[key])).join("|"))
      .sort();
  return {
    orders: pick("order", ["id", "merchantId", "status", "origin"]),
    lines: pick("orderLine", ["orderId", "productId", "quantityOrdered", "unitPriceFrozenCents"]),
    rounds: pick("round", ["slotId", "name", "status", "driverId"]),
    stops: pick("stop", ["roundId", "orderId", "sequence"]),
  };
}

// ---------------------------------------------------------------------------
// Règles pures
// ---------------------------------------------------------------------------

test("LOCK-1 RG-04 : décision de génération de la récurrente", () => {
  const recurring = { merchantId: "M", slotId: "s6" };
  assert.equal(recurringDecision(recurring, []), "GENERATE");
  assert.equal(recurringDecision(recurring, [{ merchantId: "X", slotId: "s6", origin: "MANUAL", status: "VALIDATED" }]), "GENERATE", "autre client");
  assert.equal(recurringDecision(recurring, [{ merchantId: "M", slotId: "s6", origin: "MANUAL", status: "VALIDATED" }]), "MANUAL_ORDER_EXISTS");
  assert.equal(recurringDecision(recurring, [{ merchantId: "M", slotId: "s7", origin: "MANUAL", status: "VALIDATED" }]), "MANUAL_ORDER_EXISTS", "autre créneau du jour");
  assert.equal(recurringDecision(recurring, [{ merchantId: "M", slotId: "s6", origin: "MANUAL", status: "CANCELLED" }]), "MANUAL_ORDER_EXISTS", "annulée");
  assert.equal(recurringDecision(recurring, [{ merchantId: "M", slotId: "s6", origin: "MANUAL", status: "DRAFT" }]), "MANUAL_ORDER_EXISTS", "brouillon");
  assert.equal(recurringDecision(recurring, [{ merchantId: "M", slotId: "s6", origin: "RECURRING", status: "LOCKED" }]), "ORDER_EXISTS_ON_SLOT", "déjà générée");
  assert.equal(recurringDecision(recurring, [{ merchantId: "M", slotId: "s7", origin: "RECURRING", status: "LOCKED" }]), "GENERATE", "autre récurrente, autre créneau");
});

test("LOCK-1 RG-09 : tournées d'un créneau — une seule si possible, découpée au-delà de 30 arrêts, sans GPS en fin", () => {
  const start = Date.UTC(2026, 10, 10, 5, 0);
  const depot = { latitude: 48.8547, longitude: 2.3725 };
  const near = (index: number) => ({ id: `o${index}`, point: { latitude: 48.855 + index * 0.0004, longitude: 2.372 }, label: `M${index}` });
  const one = planSlotRounds({ orders: [near(1), near(2), near(3)], depot, windowStart: start, windowEnd: start + 3_600_000, travelSeconds: straightLineSeconds });
  assert.equal(one.length, 1);
  assert.deepEqual([...one[0]!.orderIds].sort(), ["o1", "o2", "o3"]);
  assert.ok(one[0]!.arrivals.every((arrival) => typeof arrival === "number"));

  const many = Array.from({ length: ROUND_MAX_STOPS + 5 }, (_, index) => near(index));
  const split = planSlotRounds({ orders: many, depot, windowStart: start, windowEnd: start + 4 * 3_600_000, travelSeconds: straightLineSeconds });
  assert.ok(split.length >= 2, "plus de 30 arrêts : plusieurs tournées");
  assert.ok(split.every((round) => round.orderIds.length <= ROUND_MAX_STOPS));
  assert.equal(new Set(split.flatMap((round) => round.orderIds)).size, many.length, "chaque commande une seule fois");

  const withUnknown = planSlotRounds({
    orders: [near(1), { id: "x", point: null, label: "Sans GPS" }],
    depot,
    windowStart: start,
    windowEnd: start + 3_600_000,
    travelSeconds: straightLineSeconds,
  });
  assert.deepEqual(withUnknown[0]!.orderIds.at(-1), "x");
  assert.equal(withUnknown[0]!.arrivals.at(-1), null);
  assert.equal(roundName({ label: null, startTime: "06:00", endTime: "07:00" }, 1, 2), "Tournée 6h – 7h · B");
});

// ---------------------------------------------------------------------------
// Verrouillage (critères 2 et 4, RG-05, idempotence, isolation)
// ---------------------------------------------------------------------------

test("LOCK-1 critère 2 : rien à 16:59, verrouillage à 17:00:00 (heure de Paris)", async () => {
  const { db, tables } = fixture();
  const early = await lockDeliveryDate("A", J, { now: BEFORE, db: lockDb(db), travelMatrix });
  assert.equal(early.skipped, "NOT_DUE");
  assert.equal(orderOf(tables, "oA1").status, "VALIDATED");
  assert.equal(rows(tables, "round").length, 0);
  assert.equal(rows(tables, "auditLog").length, 0);

  const summary = await lockDeliveryDate("A", J, { now: CUTOFF, db: lockDb(db), travelMatrix });
  assert.equal(summary.skipped, null);
  assert.equal(orderOf(tables, "oA1").status, "LOCKED");
  assert.equal((orderOf(tables, "oA1").lockedAt as Date).toISOString(), CUTOFF.toISOString());
});

test("LOCK-1 critère 2 : le client ne peut plus modifier à 17:00:00, il le pouvait à 16:59", async () => {
  const { db, tables } = fixture();
  // Lot 1, demande 1 : le client commande sur un moment de sa tournée.
  rows(tables, "merchant", { id: "A2" })[0]!.zoneId = "zA";
  rows(tables, "slot", { id: "s7" })[0]!.zoneId = "zA";
  const merchant = { companyId: "A", merchantId: "A2", userId: "uA2" };
  const input = { deliveryDate: J, slotId: "s7", lines: [{ productId: "baguette", quantity: 3 }] };
  const saved = await saveMerchantOrder(merchant, input, BEFORE, db as unknown as OrderDb);
  assert.equal(saved.order.status, "VALIDATED");
  await assert.rejects(saveMerchantOrder(merchant, input, CUTOFF, db as unknown as OrderDb), { status: 409, code: "DEADLINE_PASSED" });
  await lockDeliveryDate("A", J, { now: CUTOFF, db: lockDb(db), travelMatrix });
  // Commande verrouillée : refus même si l'horloge du client retardait.
  await assert.rejects(saveMerchantOrder(merchant, input, BEFORE, db as unknown as OrderDb), { status: 409, code: "ORDER_LOCKED" });
});

test("LOCK-1 changement d'heure : heure limite du 25 octobre 2026 (retour à l'heure d'hiver)", async () => {
  const { db, tables } = fixture();
  tables.order!.push({ id: "oOct", companyId: "A", merchantId: "A2", reference: "C-OCT", deliveryDate: day("2026-10-26"), slotId: "s6", status: "VALIDATED", origin: "MANUAL", notes: null });
  assert.equal((await lockDeliveryDate("A", "2026-10-26", { now: at("2026-10-25T15:59:59.000Z"), db: lockDb(db), travelMatrix })).skipped, "NOT_DUE");
  assert.equal((await lockDeliveryDate("A", "2026-10-26", { now: at("2026-10-25T16:00:00.000Z"), db: lockDb(db), travelMatrix })).skipped, null);
  assert.equal(orderOf(tables, "oOct").status, "LOCKED");
});

test("LOCK-1 critère 4 : récurrente générée sans commande ; la manuelle reste et bloque la récurrente", async () => {
  const { db, tables } = fixture();
  const summary = await lockDeliveryDate("A", J, { now: CUTOFF, db: lockDb(db), travelMatrix });
  assert.equal(summary.recurringGenerated, 1);
  const generated = rows(tables, "order", { merchantId: "A2" });
  assert.equal(generated.length, 1, "une seule commande pour A2");
  assert.equal(generated[0]!.origin, "RECURRING");
  assert.equal(generated[0]!.recurringOrderId, "rA2");
  assert.equal(generated[0]!.status, "LOCKED", "générée puis verrouillée dans le même passage");
  assert.deepEqual(rows(tables, "orderLine", { orderId: generated[0]!.id }).map((line) => [line.productId, line.quantityOrdered]), [["baguette", 20]], "produit retiré écarté");

  // A1 : manuelle conservée telle quelle, pas de récurrente (99 croissants).
  assert.equal(rows(tables, "order", { merchantId: "A1" }).length, 1);
  assert.equal(orderOf(tables, "oA1").origin, "MANUAL");
  assert.equal(lineOf(tables, "oA1", "croissant").quantityOrdered, 10);
  // A3 : commande manuelle annulée → la récurrente n'est pas générée (règle prudente).
  assert.deepEqual(rows(tables, "order", { merchantId: "A3" }).map((order) => order.status), ["CANCELLED"]);
  // A4 : récurrente suspendue, brouillon ignoré (ni verrouillé ni en tournée).
  assert.equal(orderOf(tables, "oA4").status, "DRAFT");
  assert.equal(rows(tables, "stop", { orderId: "oA4" }).length, 0);
  // A5 : récurrente prévue le lundi seulement.
  assert.equal(rows(tables, "order", { merchantId: "A5" }).length, 1);
  const reasons = Object.fromEntries(summary.recurringSkipped.map((skip) => [skip.recurringOrderId, skip.reason]));
  assert.deepEqual(reasons, { rA1: "MANUAL_ORDER_EXISTS", rA3: "MANUAL_ORDER_EXISTS" });
});

test("lot 1, demande 1 : une commande manuelle du matin ne bloque pas la récurrente du soir ; tournées par zone et par moment", async () => {
  const { db, tables } = fixture();
  // Tournée Sud : matin (sM) et soir (sS). A2 est rattaché à Sud, avec une récurrente matin et une soir.
  tables.slot!.push(
    { id: "sM", companyId: "A", zoneId: "zSud", period: "MORNING", label: "Sud matin", startTime: "05:30", endTime: "11:00", active: true, sortOrder: 10 },
    { id: "sS", companyId: "A", zoneId: "zSud", period: "EVENING", label: "Sud soir", startTime: "16:00", endTime: "19:00", active: true, sortOrder: 11 },
  );
  rows(tables, "merchant", { id: "A2" })[0]!.zoneId = "zSud";
  tables.recurringOrder = tables.recurringOrder!.filter((row) => row.merchantId !== "A2");
  tables.recurringOrder.push(
    { id: "rM", companyId: "A", merchantId: "A2", slotId: "sM", weekdays: [2], active: true, createdAt: new Date(7) },
    { id: "rS", companyId: "A", merchantId: "A2", slotId: "sS", weekdays: [2], active: true, createdAt: new Date(8) },
  );
  tables.recurringOrderLine!.push(
    { id: "rlM", companyId: "A", recurringOrderId: "rM", productId: "baguette", quantity: 10 },
    { id: "rlS", companyId: "A", recurringOrderId: "rS", productId: "croissant", quantity: 6 },
  );
  // A2 a commandé à la main pour le matin.
  tables.order!.push({ id: "oM", companyId: "A", merchantId: "A2", reference: "C-M", deliveryDate: day(J), slotId: "sM", status: "VALIDATED", origin: "MANUAL", notes: null, lockedAt: null, preparedAt: null });
  tables.orderLine!.push({ id: "lM", companyId: "A", orderId: "oM", productId: "baguette", quantityOrdered: 3, quantityDelivered: null, unitPriceFrozenCents: null, createdAt: new Date(9) });

  const summary = await lockDeliveryDate("A", J, { now: CUTOFF, db: lockDb(db), travelMatrix });
  const reasons = Object.fromEntries(summary.recurringSkipped.map((skip) => [skip.recurringOrderId, skip.reason]));
  assert.equal(reasons.rM, "MANUAL_ORDER_EXISTS", "matin : la commande manuelle remplace la récurrente");
  assert.equal(reasons.rS, undefined, "soir : la récurrente est générée");
  const a2 = rows(tables, "order", { merchantId: "A2" });
  assert.deepEqual(a2.map((order) => [order.slotId, order.origin]).sort(), [["sM", "MANUAL"], ["sS", "RECURRING"]]);
  // Tournées calculées par zone et par moment : « Tournée Sud matin » et « Tournée Sud soir ».
  const names = rows(tables, "round").filter((round) => ["sM", "sS"].includes(String(round.slotId))).map((round) => round.name).sort();
  assert.deepEqual(names, ["Tournée Sud matin", "Tournée Sud soir"]);
});

test("lot 1, demande 1 : client passé dans une autre tournée, sa récurrente part au même moment de sa nouvelle tournée", async () => {
  const { db, tables } = fixture();
  tables.slot!.push(
    { id: "sudM", companyId: "A", zoneId: "zSud", period: "MORNING", label: "Sud matin", startTime: "05:30", endTime: "11:00", active: true, sortOrder: 10 },
    { id: "nordM", companyId: "A", zoneId: "zNord", period: "MORNING", label: "Nord matin", startTime: "06:00", endTime: "10:00", active: true, sortOrder: 12 },
  );
  rows(tables, "merchant", { id: "A2" })[0]!.zoneId = "zNord";
  rows(tables, "recurringOrder", { id: "rA2" })[0]!.slotId = "sudM";
  await lockDeliveryDate("A", J, { now: CUTOFF, db: lockDb(db), travelMatrix });
  const generated = rows(tables, "order", { merchantId: "A2", origin: "RECURRING" });
  assert.deepEqual(generated.map((order) => order.slotId), ["nordM"]);
});

test("LOCK-1 RG-05 : prix figés au verrouillage (prix spécifique, sinon prix de base), insensibles aux changements suivants", async () => {
  const { db, tables } = fixture();
  await lockDeliveryDate("A", J, { now: CUTOFF, db: lockDb(db), travelMatrix });
  assert.equal(lineOf(tables, "oA1", "baguette").unitPriceFrozenCents, 95, "prix spécifique de A1");
  assert.equal(lineOf(tables, "oA1", "croissant").unitPriceFrozenCents, 85, "prix de base");
  assert.equal(lineOf(tables, "oA5", "croissant").unitPriceFrozenCents, 85);
  const generated = rows(tables, "order", { merchantId: "A2" })[0]!;
  assert.equal(lineOf(tables, generated.id as string, "baguette").unitPriceFrozenCents, 110);
  assert.equal(lineOf(tables, "oA4", "baguette").unitPriceFrozenCents, null, "brouillon non figé");
  assert.equal(lineOf(tables, "oA3", "baguette").unitPriceFrozenCents, null, "annulée non figée");

  // Le prix change après coup : la commande verrouillée garde son prix figé.
  rows(tables, "merchantPrice", { id: "pA1" })[0]!.priceCents = 50;
  rows(tables, "product", { id: "croissant" })[0]!.basePriceCents = 999;
  await lockDeliveryDate("A", J, { now: at("2026-11-09T18:00:00.000Z"), db: lockDb(db), travelMatrix });
  assert.equal(lineOf(tables, "oA1", "baguette").unitPriceFrozenCents, 95);
  assert.equal(lineOf(tables, "oA1", "croissant").unitPriceFrozenCents, 85);
});

test("LOCK-1 RG-09 : tournées brouillon par créneau, sans livreur, ordonnées depuis le laboratoire", async () => {
  const { db, tables } = fixture();
  const summary = await lockDeliveryDate("A", J, { now: CUTOFF, db: lockDb(db), travelMatrix });
  const rounds = rows(tables, "round", { companyId: "A" });
  assert.equal(summary.roundsCreated, 2);
  assert.deepEqual(rounds.map((round) => round.slotId).sort(), ["s6", "s7"], "une tournée par créneau");
  assert.ok(rounds.every((round) => round.status === "DRAFT" && round.driverId === null));
  assert.deepEqual(rounds.map((round) => round.name).sort(), ["Tournée 6h – 7h", "Tournée 7h – 8h"]);
  const s6 = rounds.find((round) => round.slotId === "s6")!;
  const s6Stops = rows(tables, "stop", { roundId: s6.id }).sort((a, b) => (a.sequence as number) - (b.sequence as number));
  const generated = rows(tables, "order", { merchantId: "A2" })[0]!;
  assert.deepEqual(new Set(s6Stops.map((stop) => stop.orderId)), new Set(["oA1", generated.id]));
  assert.deepEqual(s6Stops.map((stop) => stop.sequence), [1, 2]);
  assert.ok(s6Stops.every((stop) => stop.estimatedArrivalAt instanceof Date));
  // A5 sans coordonnées : dans la tournée de son créneau, sans heure estimée.
  const s7Stops = rows(tables, "stop", { roundId: rounds.find((round) => round.slotId === "s7")!.id });
  assert.deepEqual(s7Stops.map((stop) => [stop.orderId, stop.estimatedArrivalAt]), [["oA5", null]]);
  // Témoin de date traitée.
  assert.deepEqual(rows(tables, "auditLog", { entityType: "DeliveryDay", entityId: J }).map((row) => row.action), ["LOCK"]);
});

test("LOCK-1 idempotence : deux exécutions donnent le même résultat, sans doublon", async () => {
  const { db, tables } = fixture();
  await lockDeliveryDate("A", J, { now: CUTOFF, db: lockDb(db), travelMatrix });
  const first = signature(tables);
  const again = await lockDeliveryDate("A", J, { now: at("2026-11-09T16:10:00.000Z"), db: lockDb(db), travelMatrix });
  assert.deepEqual(signature(tables), first);
  assert.equal(again.recurringGenerated + again.ordersLocked + again.roundsCreated + again.stopsCreated, 0);
  assert.equal(rows(tables, "auditLog", { entityType: "DeliveryDay" }).length, 1, "pas de nouvelle ligne de journal sans changement");
  // Le cron ne relance pas une date déjà traitée.
  const due = await lockDueDeliveryDates({ now: at("2026-11-09T16:20:00.000Z"), db: lockDb(db), travelMatrix });
  assert.equal(due.filter((result) => result.companyId === "A" && result.date === J).length, 0);
  const onJ = (model: "order") => rows(tables, model, { companyId: "A" }).filter((row) => (row.deliveryDate as Date).getTime() === day(J).getTime()).length;
  assert.equal(onJ("order"), first.orders.filter((entry) => !entry.startsWith("oB")).length, "aucune commande de plus pour J");
});

test("LOCK-1 : une tournée déjà attribuée n'est pas recalculée ; une commande verrouillée sans arrêt va en complément", async () => {
  const { db, tables } = fixture();
  await lockDeliveryDate("A", J, { now: CUTOFF, db: lockDb(db), travelMatrix });
  const s6 = rows(tables, "round", { slotId: "s6" })[0]!;
  s6.driverId = "driver-1";
  s6.status = "ASSIGNED";
  const before = rows(tables, "stop", { roundId: s6.id }).map((stop) => `${stop.orderId}:${stop.sequence}`).sort();
  // Correction tardive : une commande verrouillée sans arrêt apparaît (ex. ajout manuel en base).
  tables.order!.push({ id: "late", companyId: "A", merchantId: "A4", reference: "C-LATE", deliveryDate: day(J), slotId: "s6", status: "LOCKED", origin: "MANUAL", notes: null });
  const summary = await lockDeliveryDate("A", J, { now: at("2026-11-09T19:00:00.000Z"), db: lockDb(db), travelMatrix });
  assert.equal(summary.stopsCreated, 1);
  assert.deepEqual(rows(tables, "stop", { roundId: s6.id }).map((stop) => `${stop.orderId}:${stop.sequence}`).sort(), before, "tournée attribuée intacte");
  const extra = rows(tables, "round", { slotId: "s6" }).find((round) => round.id !== s6.id)!;
  assert.equal(extra.name, "Tournée 6h – 7h · complément");
  assert.deepEqual(rows(tables, "stop", { roundId: extra.id }).map((stop) => [stop.orderId, stop.sequence]), [["late", 1]]);
  assert.deepEqual(rows(tables, "auditLog", { entityType: "DeliveryDay" }).map((row) => row.action), ["LOCK", "LOCK_UPDATE"]);
});

test("LOCK-1 isolation : verrouiller l'entreprise A ne touche pas l'entreprise B", async () => {
  const { db, tables } = fixture();
  await lockDeliveryDate("A", J, { now: CUTOFF, db: lockDb(db), travelMatrix });
  assert.equal(orderOf(tables, "oB1").status, "VALIDATED");
  assert.equal(lineOf(tables, "oB1", "painB").unitPriceFrozenCents, null);
  assert.equal(rows(tables, "order", { companyId: "B" }).length, 1, "récurrente de B non générée");
  assert.equal(rows(tables, "round", { companyId: "B" }).length, 0);
  // Le cron traite chaque entreprise, aujourd'hui (rattrapage) et demain.
  const due = await lockDueDeliveryDates({ now: CUTOFF, db: lockDb(db), travelMatrix });
  assert.deepEqual(due.map((result) => `${result.companyId}:${result.date}:${result.ok}`).sort(), ["A:2026-11-09:true", "B:2026-11-09:true", "B:2026-11-10:true"]);
  assert.equal(orderOf(tables, "oB1").status, "LOCKED");
  assert.equal(rows(tables, "order", { companyId: "B", origin: "RECURRING" }).length, 0, "B1 a déjà une commande manuelle");
  assert.ok(rows(tables, "stop", { companyId: "B" }).every((stop) => rows(tables, "round", { id: stop.roundId as string })[0]!.companyId === "B"));
});

test("LOCK-1 appel paresseux : écran ouvert avant l'heure limite → rien ; après → date verrouillée sans cron", async () => {
  const { db, tables } = fixture();
  const open = await ensureDateLocked("A", J, { now: BEFORE, db: lockDb(db), travelMatrix });
  assert.equal(open.closed, false);
  assert.equal(open.lockedAt, null);
  assert.equal(orderOf(tables, "oA1").status, "VALIDATED");
  const closed = await ensureDateLocked("A", J, { now: CUTOFF, db: lockDb(db), travelMatrix });
  assert.equal(closed.closed, true);
  assert.ok(closed.lockedAt instanceof Date);
  assert.equal(orderOf(tables, "oA1").status, "LOCKED");
  assert.equal(closed.cutoffAt.toISOString(), CUTOFF.toISOString());
});

// ---------------------------------------------------------------------------
// Back-office : liste du jour et corrections journalisées (ADM-04, ADM-05, RG-10)
// ---------------------------------------------------------------------------

async function lockedFixture() {
  const { db, tables } = fixture();
  await lockDeliveryDate("A", J, { now: CUTOFF, db: lockDb(db), travelMatrix });
  return { db: db as unknown as AdminOrderDb, tables };
}
const ADMIN_A = { companyId: "A", userId: "admA" };
const LATER = at("2026-11-09T18:30:00.000Z");

test("LOCK-1 ADM-04 : commandes du jour filtrables par client et par tournée", async () => {
  const { db, tables } = await lockedFixture();
  const dayState = { date: J, cutoffAt: CUTOFF, closed: true, lockedAt: CUTOFF };
  const all = await listAdminOrders("A", dayState, {}, db);
  assert.equal(all.total, 5, "toutes les commandes du jour de A, brouillon et annulée comprises");
  assert.ok(all.orders.every((row) => !row.id.startsWith("oB")), "jamais celles de B");
  const a1 = all.orders.find((row) => row.id === "oA1")!;
  assert.equal(a1.subtotalCents, 30 * 95 + 10 * 85, "total au prix figé");
  assert.ok(a1.round && a1.stopSequence);
  assert.deepEqual((await listAdminOrders("A", dayState, { merchantId: "A1" }, db)).orders.map((row) => row.id), ["oA1"]);
  const s7Round = rows(tables, "round", { slotId: "s7" })[0]!;
  assert.deepEqual((await listAdminOrders("A", dayState, { roundId: s7Round.id as string }, db)).orders.map((row) => row.id), ["oA5"]);
  assert.deepEqual(
    (await listAdminOrders("A", dayState, { roundId: "none" }, db)).orders.map((row) => row.id).sort(),
    ["oA3", "oA4"],
    "sans tournée : annulée et brouillon"
  );
});

test("LOCK-1 ADM-05 / RG-10 : correction après l'heure limite journalisée (auteur, date, avant, après)", async () => {
  const { db, tables } = await lockedFixture();
  const detail = await correctAdminOrder(
    ADMIN_A,
    "oA1",
    { lines: [{ productId: "baguette", quantity: 25 }], note: "Appel du client" },
    LATER,
    db
  );
  assert.deepEqual(detail.lines.map((line) => [line.productId, line.quantityOrdered]), [["baguette", 25]], "croissant retiré, baguette réduite");
  assert.equal(detail.status, "LOCKED");
  const log = rows(tables, "auditLog", { entityType: "Order", entityId: "oA1" });
  assert.equal(log.length, 1);
  assert.equal(log[0]!.actorId, "admA");
  assert.equal(log[0]!.action, "ADMIN_CORRECTION");
  assert.equal((log[0]!.createdAt as Date).toISOString(), LATER.toISOString());
  assert.deepEqual((log[0]!.before as { lines: Array<{ productId: string; quantityOrdered: number }> }).lines.map((line) => [line.productId, line.quantityOrdered]), [["baguette", 30], ["croissant", 10]]);
  assert.equal((log[0]!.after as { afterCutoff: boolean }).afterCutoff, true);
  assert.deepEqual(detail.history[0]!.changes, ["Baguette : 30 → 25", "Croissant retiré (10)", "Motif : Appel du client"]);
  assert.equal(detail.history[0]!.actorName, "Alice Admin");
  assert.equal(detail.history[0]!.afterCutoff, true);

  // Ajout d'une ligne sur une commande verrouillée : prix figé aussitôt (RG-05).
  const added = await correctAdminOrder(ADMIN_A, "oA1", { lines: [{ productId: "baguette", quantity: 25 }, { productId: "croissant", quantity: 4 }] }, LATER, db);
  const croissant = added.lines.find((line) => line.productId === "croissant")!;
  assert.equal(croissant.frozen, true);
  assert.equal(croissant.unitPriceCents, 85);
  assert.equal(added.history.length, 2);
  // Produit retiré du catalogue, autre entreprise, aucune modification : refusés.
  await assert.rejects(correctAdminOrder(ADMIN_A, "oA1", { lines: [{ productId: "retired", quantity: 1 }] }, LATER, db), { status: 400, code: "PRODUCT_UNAVAILABLE" });
  await assert.rejects(correctAdminOrder(ADMIN_A, "oA1", { lines: [{ productId: "painB", quantity: 1 }] }, LATER, db), { status: 400, code: "PRODUCT_UNAVAILABLE" });
  await assert.rejects(correctAdminOrder(ADMIN_A, "oA1", { lines: [{ productId: "baguette", quantity: 25 }, { productId: "croissant", quantity: 4 }] }, LATER, db), { status: 400, code: "NO_CHANGE" });
});

test("LOCK-1 ADM-05 : annulation journalisée, arrêt retiré et tournée renumérotée ; commande livrée non corrigeable", async () => {
  const { db, tables } = await lockedFixture();
  const s6 = rows(tables, "round", { slotId: "s6" })[0]!;
  const stopA1 = rows(tables, "stop", { orderId: "oA1" })[0]!;
  const cancelled = await cancelAdminOrder(ADMIN_A, "oA1", { note: null }, LATER, db);
  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(cancelled.round, null);
  assert.equal(rows(tables, "stop", { orderId: "oA1" }).length, 0);
  assert.deepEqual(rows(tables, "stop", { roundId: s6.id }).map((stop) => stop.sequence), [1], "renumérotée");
  assert.ok(stopA1);
  assert.deepEqual(cancelled.history.map((entry) => entry.action), ["ADMIN_CANCEL"]);
  await assert.rejects(cancelAdminOrder(ADMIN_A, "oA1", {}, LATER, db), { status: 409, code: "ORDER_NOT_EDITABLE" });
  orderOf(tables, "oA5").status = "DELIVERED";
  await assert.rejects(correctAdminOrder(ADMIN_A, "oA5", { lines: [{ productId: "croissant", quantity: 1 }] }, LATER, db), { status: 409, code: "ORDER_NOT_EDITABLE" });
});

test("LOCK-1 isolation : l'administrateur de B ne lit ni ne corrige une commande de A (404)", async () => {
  const { db, tables } = await lockedFixture();
  const ADMIN_B = { companyId: "B", userId: "admB" };
  await assert.rejects(getAdminOrder("B", "oA1", LATER, db), { status: 404 });
  await assert.rejects(correctAdminOrder(ADMIN_B, "oA1", { lines: [{ productId: "baguette", quantity: 1 }] }, LATER, db), { status: 404 });
  await assert.rejects(cancelAdminOrder(ADMIN_B, "oA1", {}, LATER, db), { status: 404 });
  assert.equal(orderOf(tables, "oA1").status, "LOCKED");
  assert.equal(rows(tables, "auditLog", { entityType: "Order" }).length, 0);
});

test("LOCK-1 journal : phrases lisibles et quantité livrée après correction", () => {
  assert.deepEqual(
    describeOrderAudit(
      "ADMIN_CORRECTION",
      { lines: [{ productId: "a", name: "Baguette", quantityOrdered: 30, quantityDelivered: null }, { productId: "b", name: "Pain", quantityOrdered: 5, quantityDelivered: null }] },
      { lines: [{ productId: "a", name: "Baguette", quantityOrdered: 30, quantityDelivered: null }, { productId: "c", name: "Croissant", quantityOrdered: 12, quantityDelivered: null }] }
    ),
    ["Croissant ajouté (12)", "Pain retiré (5)"]
  );
  assert.deepEqual(describeOrderAudit("SHORTAGE", {}, { lines: [{ productId: "a", name: "Baguette", quantityOrdered: 30, quantityDelivered: 28 }] }), ["Baguette : 28 livrés sur 30"]);
  assert.deepEqual(describeOrderAudit("ADMIN_CANCEL", {}, {}), ["Commande annulée"]);
  assert.equal(correctedDelivered({ quantityOrdered: 30, quantityDelivered: null }, 25), null, "non préparée");
  assert.equal(correctedDelivered({ quantityOrdered: 30, quantityDelivered: 30 }, 40), 40, "préparée sans manquant");
  assert.equal(correctedDelivered({ quantityOrdered: 30, quantityDelivered: 28 }, 40), 28, "manquant conservé");
  assert.equal(correctedDelivered({ quantityOrdered: 30, quantityDelivered: 28 }, 20), 20, "jamais au-dessus de la commande");
});

test("LOCK-1 routes : back-office réservé à l'administrateur, cron protégé par secret, entreprise prise dans la session", () => {
  const files = readdirSync("src/app/api/orders", { recursive: true }).map(String).filter((entry) => entry.endsWith("route.ts"));
  assert.ok(files.length >= 3);
  for (const file of files) {
    const source = readFileSync(join("src/app/api/orders", file), "utf8");
    const parts = source.split(/export async function (GET|POST|PATCH|PUT|DELETE)/);
    for (let index = 1; index < parts.length; index += 2) {
      const permission = parts[index] === "GET" ? "orders:read" : "orders:update";
      assert.match(parts[index + 1]!, new RegExp(`requireCompanyAdmin\\("${permission}"\\)`), `${file} ${parts[index]}`);
    }
    assert.equal(/getCompanyId|companyId\s*:\s*(body|input)|searchParams\.get\("companyId"\)/.test(source), false, `${file} : entreprise lue hors session`);
  }
  const cron = readFileSync("src/app/api/cron/lock-orders/route.ts", "utf8");
  assert.match(cron, /authorization"\) !== `Bearer \$\{secret\}`/);
  assert.match(cron, /NODE_ENV === "production"/, "heure simulée refusée en production");
  const workflow = readFileSync(".github/workflows/cron-lock-orders.yml", "utf8");
  assert.match(workflow, /cron: "\*\/10 \* \* \* \*"/);
  assert.match(workflow, /\/api\/cron\/lock-orders/);
  assert.match(workflow, /Authorization: Bearer \$\{PREPROD_CRON_SECRET\}/);
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons: Array<{ path: string }> };
  assert.ok(vercel.crons.some((cronEntry) => cronEntry.path === "/api/cron/lock-orders"));
});

test("LOCK-1 route cron : secret absent ou faux → 401", async () => {
  const { GET } = await import("../src/app/api/cron/lock-orders/route");
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "secret-de-test";
  try {
    assert.equal((await GET(new Request("http://x/api/cron/lock-orders"))).status, 401);
    assert.equal((await GET(new Request("http://x/api/cron/lock-orders", { headers: { authorization: "Bearer faux" } }))).status, 401);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});
