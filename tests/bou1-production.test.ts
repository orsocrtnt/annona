import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { ROLE_PERMISSIONS } from "../prisma/reference-data";
import { lockDeliveryDate, type DayLockState, type LockDb } from "../src/domains/order/order-lock.service";
import { getAdminOrder, type AdminOrderDb } from "../src/domains/order/admin-order.service";
import {
  computeProductionTotals,
  getProductionDay,
  reportShortage,
  setOrderPrepared,
  type ProductionDb,
} from "../src/domains/production/production.service";
import { straightLineSeconds } from "../src/lib/dispatch/travel-time";
import { getPageAccessRule } from "../src/lib/permissions/page-access";
import { createMemoryDb } from "./helpers/memory-db";

type Row = Record<string, unknown>;
const PARIS = "Europe/Paris";
const J = "2026-11-10";
const day = (date: string) => new Date(`${date}T00:00:00.000Z`);
const BEFORE = new Date("2026-11-09T15:59:00.000Z");
const CUTOFF = new Date("2026-11-09T16:00:00.000Z");
const LATER = new Date("2026-11-10T03:30:00.000Z");
const travelMatrix = async () => ({ seconds: straightLineSeconds, approximate: true });
const BAKER_A = { companyId: "A", userId: "bakerA" };
const BAKER_B = { companyId: "B", userId: "bakerB" };

function order(id: string, companyId: string, merchantId: string, slotId: string, status: string) {
  return { id, companyId, merchantId, reference: `C-${id}`, deliveryDate: day(J), slotId, status, origin: "MANUAL", notes: null, lockedAt: null, preparedAt: null };
}
function line(id: string, companyId: string, orderId: string, productId: string, quantityOrdered: number) {
  return { id, companyId, orderId, productId, quantityOrdered, quantityDelivered: null, unitPriceFrozenCents: null, createdAt: new Date(id.length) };
}

function fixture() {
  const tables: Record<string, Row[]> = {
    company: [
      { id: "A", status: "ACTIVE", cutoffTime: "17:00", timezone: PARIS, depotLatitude: 48.8547, depotLongitude: 2.3725 },
      { id: "B", status: "ACTIVE", cutoffTime: "17:00", timezone: PARIS, depotLatitude: null, depotLongitude: null },
    ],
    merchant: [
      { id: "M1", companyId: "A", name: "Café Un", tradeName: null, address: "1 rue", postalCode: "75011", city: "Paris", accessInstructions: "Code 1234", active: true, latitude: 48.86, longitude: 2.37 },
      { id: "M2", companyId: "A", name: "Bistrot Deux", tradeName: null, address: "2 rue", postalCode: "75011", city: "Paris", accessInstructions: null, active: true, latitude: 48.87, longitude: 2.38 },
      { id: "M3", companyId: "A", name: "Épicerie Trois", tradeName: null, address: "3 rue", postalCode: "75011", city: "Paris", accessInstructions: null, active: true, latitude: 48.85, longitude: 2.36 },
      { id: "MB", companyId: "B", name: "Hôtel B", tradeName: null, address: "1 rue B", postalCode: null, city: "Lyon", accessInstructions: null, active: true, latitude: null, longitude: null },
    ],
    slot: [
      { id: "s6", companyId: "A", label: null, startTime: "06:00", endTime: "07:00", active: true, sortOrder: 1 },
      { id: "sB", companyId: "B", label: null, startTime: "06:00", endTime: "07:00", active: true, sortOrder: 1 },
    ],
    category: [
      { id: "pains", companyId: "A", name: "Pains", sortOrder: 1, active: true },
      { id: "viennoiseries", companyId: "A", name: "Viennoiseries", sortOrder: 2, active: true },
      { id: "catB", companyId: "B", name: "Pains B", sortOrder: 1, active: true },
    ],
    product: [
      { id: "baguette", companyId: "A", categoryId: "pains", name: "Baguette", unit: "pièce", basePriceCents: 110, vatRateBasisPoints: 550, active: true, sortOrder: 1 },
      { id: "campagne", companyId: "A", categoryId: "pains", name: "Pain de campagne", unit: "pièce", basePriceCents: 350, vatRateBasisPoints: 550, active: true, sortOrder: 2 },
      { id: "croissant", companyId: "A", categoryId: "viennoiseries", name: "Croissant", unit: "pièce", basePriceCents: 85, vatRateBasisPoints: 550, active: true, sortOrder: 1 },
      { id: "painB", companyId: "B", categoryId: "catB", name: "Pain B", unit: "pièce", basePriceCents: 200, vatRateBasisPoints: 550, active: true, sortOrder: 1 },
    ],
    merchantPrice: [],
    recurringOrder: [],
    recurringOrderLine: [],
    order: [
      order("o1", "A", "M1", "s6", "VALIDATED"),
      order("o2", "A", "M2", "s6", "VALIDATED"),
      order("o3", "A", "M3", "s6", "CANCELLED"),
      order("o4", "A", "M3", "s6", "DRAFT"),
      order("oB", "B", "MB", "sB", "VALIDATED"),
    ],
    orderLine: [
      line("l1", "A", "o1", "baguette", 30),
      line("l2", "A", "o1", "croissant", 12),
      line("l3", "A", "o2", "baguette", 15),
      line("l4", "A", "o2", "campagne", 4),
      line("l5", "A", "o3", "baguette", 100),
      line("l6", "A", "o4", "croissant", 50),
      line("l7", "B", "oB", "painB", 40),
    ],
    round: [],
    stop: [],
    auditLog: [],
    user: [{ id: "admA", companyId: "A", firstName: "Alice", lastName: "Admin" }, { id: "bakerA", companyId: "A", firstName: "Bastien", lastName: "Fournier" }],
  };
  const db = createMemoryDb(tables, {
    decorate: { product: (row, all) => ({ category: { active: Boolean((all.category ?? []).find((category) => category.id === row.categoryId)?.active) } }) },
  });
  return { db, tables };
}

const state = (closed: boolean): DayLockState => ({ date: J, cutoffAt: CUTOFF, closed, lockedAt: closed ? CUTOFF : null });
const rows = (tables: Record<string, Row[]>, model: string, where: Row = {}) =>
  (tables[model] ?? []).filter((row) => Object.entries(where).every(([key, value]) => row[key] === value));

async function lockedFixture() {
  const { db, tables } = fixture();
  await lockDeliveryDate("A", J, { now: CUTOFF, db: db as unknown as LockDb, travelMatrix });
  return { db: db as unknown as ProductionDb, tables };
}

test("BOU-1 critère 5 : total par produit = somme des quantités des commandes (fonction pure, ordre du catalogue)", () => {
  const totals = computeProductionTotals(
    [
      { productId: "croissant", quantityOrdered: 12 },
      { productId: "baguette", quantityOrdered: 30 },
      { productId: "baguette", quantityOrdered: 15 },
      { productId: "campagne", quantityOrdered: 4 },
      { productId: "inconnu", quantityOrdered: 2 },
      { productId: "campagne", quantityOrdered: 0 },
    ],
    [
      { id: "baguette", name: "Baguette", unit: "pièce", categoryId: "pains", sortOrder: 1 },
      { id: "campagne", name: "Pain de campagne", unit: "pièce", categoryId: "pains", sortOrder: 2 },
      { id: "croissant", name: "Croissant", unit: "pièce", categoryId: "viennoiseries", sortOrder: 1 },
    ],
    [
      { id: "viennoiseries", name: "Viennoiseries", sortOrder: 2 },
      { id: "pains", name: "Pains", sortOrder: 1 },
    ]
  );
  assert.deepEqual(
    totals.map((category) => [category.name, category.quantity, category.products.map((product) => [product.name, product.quantity])]),
    [
      ["Pains", 49, [["Baguette", 45], ["Pain de campagne", 4]]],
      ["Viennoiseries", 12, [["Croissant", 12]]],
      ["Autres", 2, [["inconnu", 2]]],
    ]
  );
});

test("BOU-1 critère 5 : après l'heure limite, totaux = somme des commandes verrouillées du jour (ni annulée, ni brouillon, ni autre entreprise)", async () => {
  const { db } = await lockedFixture();
  const production = await getProductionDay("A", state(true), db);
  assert.equal(production.provisional, false);
  assert.equal(production.orderCount, 2);
  const totals = Object.fromEntries(production.totals.flatMap((category) => category.products.map((product) => [product.name, product.quantity])));
  assert.deepEqual(totals, { Baguette: 45, "Pain de campagne": 4, Croissant: 12 });
  assert.equal(production.itemCount, 61);
  assert.equal(production.sheets.length, 2, "un bon par commande verrouillée");
  assert.ok(production.sheets.every((sheet) => sheet.round && sheet.stopCount === 2));
  const m1 = production.sheets.find((sheet) => sheet.merchant.name === "Café Un")!;
  assert.equal(m1.merchant.accessInstructions, "Code 1234");
  assert.deepEqual(m1.lines.map((entry) => [entry.categoryName, entry.name, entry.quantityOrdered]), [["Pains", "Baguette", 30], ["Viennoiseries", "Croissant", 12]]);
});

test("BOU-01 : avant l'heure limite, total provisoire seulement (ni bons ni tournées)", async () => {
  const { db } = fixture();
  const production = await getProductionDay("A", state(false), db as unknown as ProductionDb);
  assert.equal(production.provisional, true);
  assert.equal(production.sheets.length, 0);
  assert.equal(production.rounds.length, 0);
  const totals = Object.fromEntries(production.totals.flatMap((category) => category.products.map((product) => [product.name, product.quantity])));
  assert.deepEqual(totals, { Baguette: 45, "Pain de campagne": 4, Croissant: 12 }, "commandes validées, brouillon et annulée exclus");
});

test("BOU-03 : vue par tournée dans l'ordre de chargement (dernier arrêt chargé en premier)", async () => {
  const { db, tables } = await lockedFixture();
  const production = await getProductionDay("A", state(true), db);
  assert.equal(production.rounds.length, 1);
  const stops = rows(tables, "stop").sort((a, b) => (a.sequence as number) - (b.sequence as number)).map((stop) => stop.orderId);
  assert.deepEqual(production.rounds[0]!.orderIds, [...stops].reverse());
  assert.equal(production.rounds[0]!.name, "Tournée 6h – 7h");
});

test("BOU-05 : « préparée » passe la commande en PREPARED et remplit la quantité livrée ; décocher revient en arrière", async () => {
  const { db, tables } = await lockedFixture();
  await setOrderPrepared(BAKER_A, "o1", true, LATER, db);
  const o1 = rows(tables, "order", { id: "o1" })[0]!;
  assert.equal(o1.status, "PREPARED");
  assert.equal((o1.preparedAt as Date).toISOString(), LATER.toISOString());
  assert.deepEqual(rows(tables, "orderLine", { orderId: "o1" }).map((entry) => entry.quantityDelivered), [30, 12]);
  await setOrderPrepared(BAKER_A, "o1", true, LATER, db);
  assert.equal(rows(tables, "auditLog", { entityType: "Order", entityId: "o1" }).length, 1, "deuxième appel sans effet");
  await setOrderPrepared(BAKER_A, "o1", false, LATER, db);
  assert.equal(rows(tables, "order", { id: "o1" })[0]!.status, "LOCKED");
  assert.deepEqual(rows(tables, "orderLine", { orderId: "o1" }).map((entry) => entry.quantityDelivered), [null, null]);
  // Commande non verrouillée (brouillon) : refus.
  await assert.rejects(setOrderPrepared(BAKER_A, "o4", true, LATER, db), { status: 409, code: "ORDER_NOT_LOCKED" });
});

test("BOU-06 / RG-06 : un manquant réduit la quantité livrée, jamais au-dessus de la commande, journalisé et visible par l'admin", async () => {
  const { db, tables } = await lockedFixture();
  await reportShortage(BAKER_A, "l1", 28, LATER, db);
  assert.equal(rows(tables, "orderLine", { id: "l1" })[0]!.quantityDelivered, 28);
  await assert.rejects(reportShortage(BAKER_A, "l1", 31, LATER, db), { status: 400, code: "QUANTITY_ABOVE_ORDERED" });
  await assert.rejects(reportShortage(BAKER_A, "l1", -1, LATER, db), { status: 400 });
  assert.equal(rows(tables, "orderLine", { id: "l1" })[0]!.quantityDelivered, 28, "refus sans écriture");
  // La préparation garde le manquant.
  await setOrderPrepared(BAKER_A, "o1", true, LATER, db);
  assert.deepEqual(rows(tables, "orderLine", { orderId: "o1" }).map((entry) => entry.quantityDelivered), [28, 12]);
  const production = await getProductionDay("A", state(true), db);
  assert.equal(production.sheets.find((sheet) => sheet.orderId === "o1")!.shortage, true);
  // Visible par l'administrateur : historique et total livré.
  const detail = await getAdminOrder("A", "o1", LATER, db as unknown as AdminOrderDb);
  assert.ok(detail.history.some((entry) => entry.action === "SHORTAGE" && entry.actorName === "Bastien Fournier" && entry.changes[0] === "Baguette : 28 livrés sur 30"));
  assert.equal(detail.deliveredSubtotalCents, 28 * 110 + 12 * 85, "facture sur la quantité livrée (RG-06)");
  assert.equal(detail.subtotalCents, 30 * 110 + 12 * 85);
  // Ligne d'une commande non verrouillée : refus.
  await assert.rejects(reportShortage(BAKER_A, "l6", 1, LATER, db), { status: 409, code: "ORDER_NOT_LOCKED" });
});

test("BOU-1 isolation : le boulanger de B ne voit ni ne modifie rien de A (404)", async () => {
  const { db, tables } = await lockedFixture();
  const production = await getProductionDay("B", { ...state(true) }, db);
  assert.ok(production.sheets.every((sheet) => sheet.orderId === "oB"));
  assert.ok(production.totals.every((category) => category.products.every((product) => product.name === "Pain B")));
  await assert.rejects(setOrderPrepared(BAKER_B, "o1", true, LATER, db), { status: 404 });
  await assert.rejects(reportShortage(BAKER_B, "l1", 1, LATER, db), { status: 404 });
  assert.equal(rows(tables, "orderLine", { id: "l1" })[0]!.quantityDelivered, null);
});

test("BOU-1 droits : routes réservées au boulanger ; il ne modifie ni prix ni commandes ; client et livreur refusés", () => {
  const root = "src/app/api/production";
  const files = readdirSync(root, { recursive: true }).map(String).filter((entry) => entry.endsWith("route.ts"));
  assert.equal(files.length, 3);
  for (const file of files) {
    const source = readFileSync(join(root, file), "utf8");
    const parts = source.split(/export async function (GET|POST|PATCH|PUT|DELETE)/);
    for (let index = 1; index < parts.length; index += 2) {
      const permission = parts[index] === "GET" ? "production:read" : "production:update";
      assert.match(parts[index + 1]!, new RegExp(`requireCompanyRole\\(\\["BAKER"\\], "${permission}"\\)`), `${file} ${parts[index]}`);
    }
    assert.equal(/getCompanyId|companyId\s*:\s*(body|input)|searchParams\.get\("companyId"\)/.test(source), false, `${file} : entreprise lue hors session`);
  }
  // Le boulanger n'a pas les permissions d'écriture des prix ni des commandes, et les écrans admin le refusent.
  assert.equal(ROLE_PERMISSIONS.BAKER.includes("catalog:manage"), false);
  assert.equal(ROLE_PERMISSIONS.BAKER.includes("orders:update"), false);
  for (const file of ["src/app/api/orders/[id]/route.ts", "src/app/api/catalog/prices/route.ts"]) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /BAKER/, `${file} n'admet pas le boulanger`);
  }
  // Client et livreur : ni permission de production, ni accès à /bakery.
  for (const role of ["MERCHANT", "DRIVER"] as const) {
    assert.equal(ROLE_PERMISSIONS[role].some((permission) => permission.startsWith("production:")), false, role);
  }
  assert.deepEqual([...(getPageAccessRule("/bakery")?.roles ?? [])], ["BAKER"]);
});
