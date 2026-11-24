/**
 * Lot 2, demandes 6, 7 et 8 (18 novembre 2026) : réception du matin, clôture du soir avec ventes calculées et
 * produits à jeter, écran « Stock boutiques ». Rejoue l'exemple lundi-mardi des éclairs du document.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { closeDay, getCloseSheet, getReception, getShopStock, receiveShipment, type ShopStockDb } from "../src/domains/shop/shop-stock.service";
import { addDays, lastSaleDayOf, planClose } from "../src/domains/shop/stock-rules";
import { ROLE_PERMISSIONS } from "../prisma/reference-data";
import { createMemoryDb } from "./helpers/memory-db";

type Row = Record<string, unknown>;
const LUNDI = "2026-11-23";
const MARDI = "2026-11-24";
const MERCREDI = "2026-11-25";
const at = (date: string, hour: number) => new Date(`${date}T${String(hour - 1).padStart(2, "0")}:00:00.000Z`); // heure de Paris en hiver
const day = (date: string) => new Date(`${date}T00:00:00.000Z`);

function shipment(id: string, date: string, lines: Array<[string, number]>, tables: Record<string, Row[]>) {
  tables.order!.push({ id, companyId: "A", merchantId: "centre", deliveryDate: day(date), origin: "SHIPMENT", status: "LOCKED", receivedAt: null, slotId: "sMatin" });
  for (const [productId, quantity] of lines) {
    tables.orderLine!.push({ id: `${id}-${productId}`, companyId: "A", orderId: id, productId, quantityOrdered: quantity, quantityReceived: null, quantityDamaged: null });
  }
}

function fixture() {
  const tables: Record<string, Row[]> = {
    company: [{ id: "A", timezone: "Europe/Paris" }],
    merchant: [
      { id: "centre", companyId: "A", kind: "SHOP", name: "Centre-ville" },
      { id: "gare", companyId: "A", kind: "SHOP", name: "Gare" },
    ],
    category: [
      { id: "catPat", companyId: "A", name: "Pâtisseries", family: "PASTRY" },
      { id: "catPain", companyId: "A", name: "Pains", family: "BREAD" },
    ],
    product: [
      { id: "eclair", companyId: "A", categoryId: "catPat", name: "Éclair", unit: "pièce", shelfLifeDays: 2 },
      { id: "tarte", companyId: "A", categoryId: "catPat", name: "Tarte au citron", unit: "pièce", shelfLifeDays: 2 },
      { id: "baguette", companyId: "A", categoryId: "catPain", name: "Baguette", unit: "pièce", shelfLifeDays: 1 },
    ],
    order: [],
    orderLine: [],
    shopStockLot: [],
    shopDayClose: [],
    role: [
      { id: "rAdmin", systemRole: "ADMIN" },
      { id: "rPastry", systemRole: "PASTRY_CHEF" },
      { id: "rBaker", systemRole: "BAKER" },
      { id: "rSeller", systemRole: "SELLER" },
    ],
    user: [
      { id: "admin", companyId: "A", roleId: "rAdmin", status: "ACTIVE" },
      { id: "patissier", companyId: "A", roleId: "rPastry", status: "ACTIVE" },
      { id: "boulanger", companyId: "A", roleId: "rBaker", status: "ACTIVE" },
      { id: "vendeuse", companyId: "A", roleId: "rSeller", status: "ACTIVE" },
    ],
    clientNotification: [],
    auditLog: [],
  };
  return { tables, db: createMemoryDb(tables) as unknown as ShopStockDb };
}

const SELLER = { companyId: "A", userId: "vendeuse", shopId: "centre" };

test("LOT2-D7 règles : l'exemple du document (éclair vendu 2 jours, lundi puis mardi)", () => {
  assert.equal(lastSaleDayOf(LUNDI, 2), MARDI, "reçu lundi : vendu lundi et mardi");
  assert.equal(addDays(MARDI, 1), MERCREDI);
  const lundi = planClose(LUNDI, [{ id: "L", receivedOn: LUNDI, lastSaleDay: MARDI, quantity: 10 }], { remaining: 3 });
  assert.deepEqual([lundi.available, lundi.sold, lundi.expiring, lundi.kept], [10, 7, 0, 3]);
  const mardi = planClose(MARDI, [{ id: "L", receivedOn: LUNDI, lastSaleDay: MARDI, quantity: 3 }, { id: "M", receivedOn: MARDI, lastSaleDay: MERCREDI, quantity: 10 }], { remaining: 11 });
  assert.deepEqual([mardi.morningStock, mardi.receivedGood, mardi.available, mardi.sold], [3, 10, 13, 2]);
  assert.deepEqual([mardi.expiring, mardi.discardedExpired, mardi.kept], [1, 1, 10]);
  assert.deepEqual([...mardi.lotsAfter], [["L", 0], ["M", 10]], "les éclairs du lundi partent en premier ; ceux du mardi restent");
  assert.throws(() => planClose(MARDI, [{ id: "M", receivedOn: MARDI, lastSaleDay: MERCREDI, quantity: 10 }], { remaining: 11 }), /dépasse/);
  assert.throws(() => planClose(MARDI, [{ id: "M", receivedOn: MARDI, lastSaleDay: MERCREDI, quantity: 10 }], { remaining: 2, damaged: 3 }), /abîmés/);
});

test("LOT2-D6 vérifications 1 et 2 : 11 éclairs reçus sur 12, dont 1 abîmé → 10 en stock ; alerte au pâtissier et à l'administrateur", async () => {
  const { tables, db } = fixture();
  shipment("o1", LUNDI, [["eclair", 12], ["baguette", 20]], tables);
  const before = await getReception(SELLER, LUNDI, db);
  assert.deepEqual(before.lines.map((line) => [line.name, line.sent, line.received]), [["Éclair", 12, null], ["Baguette", 20, null]]); // RETOURS-2 : pâtisserie avant boulangerie.
  const result = await receiveShipment(SELLER, { date: LUNDI, lines: [{ productId: "eclair", received: 11, damaged: 1 }, { productId: "baguette", received: 20, damaged: 0 }] }, { db, now: at(LUNDI, 7) });
  assert.deepEqual(result.gaps, [{ name: "Éclair", sent: 12, received: 11 }]);
  const lot = tables.shopStockLot!.find((row) => row.productId === "eclair")!;
  assert.deepEqual([lot.quantity, lot.initialQuantity], [10, 10], "les abîmés n'entrent pas en stock");
  assert.equal((lot.lastSaleDay as Date).toISOString().slice(0, 10), MARDI);
  const alerted = tables.clientNotification!.map((row) => row.userId).sort();
  assert.deepEqual(alerted, ["admin", "patissier"], "pain sans écart : le boulanger n'est pas alerté");
  assert.match(String(tables.clientNotification![0]!.body), /Éclair : 11 reçu\(s\) sur 12/);
  // Une réception se note une fois ; l'abîmé fait partie du reçu ; on note chaque produit.
  await assert.rejects(receiveShipment(SELLER, { date: LUNDI, lines: [] }, { db, now: at(LUNDI, 8) }), { status: 409 });
  shipment("o2", MARDI, [["eclair", 10]], tables);
  await assert.rejects(receiveShipment(SELLER, { date: MARDI, lines: [{ productId: "eclair", received: 2, damaged: 3 }] }, { db, now: at(MARDI, 7) }), { status: 400 });
  await assert.rejects(receiveShipment(SELLER, { date: MARDI, lines: [] }, { db, now: at(MARDI, 7) }), { status: 400, code: "RECEPTION_INCOMPLETE" });
  await assert.rejects(receiveShipment(SELLER, { date: MARDI, lines: [{ productId: "eclair", received: 10, damaged: 0 }] }, { db, now: at(LUNDI, 20) }), { status: 400, code: "DATE_IN_FUTURE" });
  // Une autre boutique de l'entreprise n'a rien à recevoir ; une boutique d'une autre entreprise est introuvable.
  assert.deepEqual((await getReception({ companyId: "A", shopId: "gare" }, LUNDI, db)).lines, []);
  await assert.rejects(getReception({ companyId: "B", shopId: "centre" }, LUNDI, db), { status: 404 });
});

test("LOT2-D7 vérifications 1 à 4 : lundi 7 vendus ; mardi 13 en stock, 2 vendus, 1 éclair du lundi à jeter ; 1 tarte abîmée jetée", async () => {
  const { tables, db } = fixture();
  shipment("o1", LUNDI, [["eclair", 10]], tables);
  await receiveShipment(SELLER, { date: LUNDI, lines: [{ productId: "eclair", received: 10, damaged: 0 }] }, { db, now: at(LUNDI, 7) });
  const lundi = await closeDay(SELLER, { date: LUNDI, entries: [{ productId: "eclair", remaining: 3, damaged: 0 }] }, { db, now: at(LUNDI, 20) });
  assert.deepEqual(lundi.map((row) => [row.name, row.sold, row.discardedExpired, row.kept]), [["Éclair", 7, 0, 3]]);
  await assert.rejects(closeDay(SELLER, { date: LUNDI, entries: [{ productId: "eclair", remaining: 3, damaged: 0 }] }, { db, now: at(LUNDI, 21) }), { status: 409 });

  shipment("o2", MARDI, [["eclair", 10], ["tarte", 8]], tables);
  await receiveShipment(SELLER, { date: MARDI, lines: [{ productId: "eclair", received: 10, damaged: 0 }, { productId: "tarte", received: 8, damaged: 0 }] }, { db, now: at(MARDI, 7) });
  const sheet = await getCloseSheet(SELLER, MARDI, db);
  const eclairs = sheet.lines.find((line) => line.name === "Éclair")!;
  assert.equal(eclairs.lots.reduce((sum, lot) => sum + lot.quantity, 0), 13, "mardi matin : 13 éclairs en stock");
  const mardi = await closeDay(
    SELLER,
    { date: MARDI, entries: [{ productId: "eclair", remaining: 11, damaged: 0 }, { productId: "tarte", remaining: 5, damaged: 1 }] },
    { db, now: at(MARDI, 20) }
  );
  const eclair = mardi.find((row) => row.name === "Éclair")!;
  assert.deepEqual([eclair.sold, eclair.discardedExpired, eclair.kept], [2, 1, 10]);
  const tarte = mardi.find((row) => row.name === "Tarte au citron")!;
  assert.deepEqual([tarte.sold, tarte.discardedDamaged, tarte.kept], [3, 1, 4], "la tarte abîmée en vitrine est comptée dans les jetés");
  const lots = tables.shopStockLot!.filter((row) => row.productId === "eclair").map((row) => [(row.receivedOn as Date).toISOString().slice(0, 10), row.quantity]);
  assert.deepEqual(lots, [[LUNDI, 0], [MARDI, 10]]);
  const closeRow = tables.shopDayClose!.find((row) => row.productId === "eclair" && (row.date as Date).toISOString().slice(0, 10) === MARDI)!;
  assert.deepEqual([closeRow.morningStock, closeRow.receivedGood, closeRow.remaining, closeRow.sold, closeRow.discardedExpired], [3, 10, 11, 2, 1]);
  // Chaque produit en stock est compté ; on ne clôture pas un jour à venir.
  await assert.rejects(closeDay(SELLER, { date: MERCREDI, entries: [] }, { db, now: at(MERCREDI, 20) }), { status: 400, code: "CLOSE_INCOMPLETE" });
  await assert.rejects(closeDay(SELLER, { date: MERCREDI, entries: [] }, { db, now: at(MARDI, 20) }), { status: 400, code: "DATE_IN_FUTURE" });
});

test("LOT2-D8 vérifications 1 et 2 : le pâtissier voit le stock d'éclairs de chaque point de vente et, pour la veille, reçus, abîmés, vendus et jetés", async () => {
  const { tables, db } = fixture();
  shipment("o1", MARDI, [["eclair", 12], ["baguette", 20]], tables);
  await receiveShipment(SELLER, { date: MARDI, lines: [{ productId: "eclair", received: 11, damaged: 1 }, { productId: "baguette", received: 20, damaged: 0 }] }, { db, now: at(MARDI, 7) });
  await closeDay(SELLER, { date: MARDI, entries: [{ productId: "eclair", remaining: 4, damaged: 0 }, { productId: "baguette", remaining: 2, damaged: 0 }] }, { db, now: at(MARDI, 20) });
  const view = await getShopStock("A", { family: "PASTRY" }, { db, now: at(MERCREDI, 9) });
  assert.equal(view.date, MARDI, "la veille par défaut");
  assert.deepEqual(view.rows.map((row) => row.productName), ["Éclair"], "le pâtissier ne voit que la pâtisserie");
  const eclair = view.rows[0]!;
  assert.deepEqual([eclair.shopName, eclair.inStock, eclair.toDiscardTonight], ["Centre-ville", 4, 4], "reçus mardi, dernier jour de vente mercredi");
  assert.deepEqual(eclair.day, { received: 11, damagedOnDelivery: 1, sold: 6, discarded: 0 });
  // Boulanger : le pain seulement ; une boutique choisie ; jours passés consultables.
  const bread = await getShopStock("A", { family: "BREAD", shopId: "centre", date: MARDI }, { db, now: at(MERCREDI, 9) });
  assert.deepEqual(bread.rows.map((row) => [row.productName, row.day.sold, row.day.discarded]), [["Baguette", 18, 2]], "baguette vendue 1 jour : jetée le soir même");
  await assert.rejects(getShopStock("A", { shopId: "inconnue" }, { db, now: at(MERCREDI, 9) }), { status: 404 });
  // Droits : administrateur, pâtissier et boulanger lisent le stock ; la vendeuse, sa boutique seulement.
  for (const role of ["ADMIN", "PASTRY_CHEF", "BAKER"] as const) assert.equal(ROLE_PERMISSIONS[role].includes("shops:read"), true, role);
  const route = readFileSync("src/app/api/stock/route.ts", "utf8");
  assert.match(route, /role === "PASTRY_CHEF" \? "PASTRY" : role === "BAKER" \? "BREAD" : null/);
  assert.match(readFileSync("src/app/api/shop/stock/route.ts", "utf8"), /shopId: allowed\.actor\.shopId/);
});
