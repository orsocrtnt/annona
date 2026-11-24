/**
 * Lot 2, demande 5 (18 novembre 2026) : envois quotidiens du laboratoire vers les boutiques. Rejoue aussi la
 * vérification 3 de la demande 1 : un jour d'envoi, la boutique est un arrêt de la tournée du livreur.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getShipmentDay, saveShipment, type ShipmentDb } from "../src/domains/shop/shipment.service";
import { lockDeliveryDate, type LockDb } from "../src/domains/order/order-lock.service";
import { getProductionDay, type ProductionDb } from "../src/domains/production/production.service";
import { straightLineSeconds } from "../src/lib/dispatch/travel-time";
import { ROLE_PERMISSIONS } from "../prisma/reference-data";
import { createMemoryDb } from "./helpers/memory-db";

type Row = Record<string, unknown>;
const J = "2026-11-20";
const BEFORE = new Date("2026-11-19T10:00:00.000Z");
const AFTER_CUTOFF = new Date("2026-11-19T16:30:00.000Z");
const travelMatrix = async () => ({ seconds: straightLineSeconds, approximate: true });

function fixture() {
  const tables: Record<string, Row[]> = {
    company: [{ id: "A", status: "ACTIVE", cutoffTime: "17:00", timezone: "Europe/Paris", depotLatitude: 48.8547, depotLongitude: 2.3725 }],
    deliveryZone: [{ id: "zCentre", companyId: "A", name: "Centre" }],
    slot: [
      { id: "sMatin", companyId: "A", zoneId: "zCentre", period: "MORNING", label: "Centre matin", startTime: "06:00", endTime: "08:00", active: true, sortOrder: 0 },
      { id: "sSoir", companyId: "A", zoneId: "zCentre", period: "EVENING", label: "Centre soir", startTime: "16:00", endTime: "18:00", active: true, sortOrder: 1 },
    ],
    merchant: [
      { id: "centre", companyId: "A", kind: "SHOP", name: "Centre-ville", address: "3 place", postalCode: "75001", city: "Paris", accessInstructions: "Porte de service", active: true, zoneId: "zCentre", latitude: 48.86, longitude: 2.34 },
      { id: "client1", companyId: "A", kind: "CLIENT", name: "Bistrot", address: "1 rue", active: true, zoneId: "zCentre", latitude: 48.87, longitude: 2.35 },
    ],
    category: [
      { id: "catPat", companyId: "A", name: "Pâtisseries individuelles", sortOrder: 0, active: true, family: "PASTRY" },
      { id: "catGat", companyId: "A", name: "Gâteaux à partager", sortOrder: 1, active: true, family: "PASTRY" },
      { id: "catPain", companyId: "A", name: "Pains", sortOrder: 2, active: true, family: "BREAD" },
    ],
    product: [
      { id: "eclair", companyId: "A", categoryId: "catPat", name: "Éclair", unit: "pièce", sortOrder: 0, active: true, pastryFormat: "SMALL", basePriceCents: null, vatRateBasisPoints: 550 },
      { id: "tarte", companyId: "A", categoryId: "catPat", name: "Tarte au citron", unit: "pièce", sortOrder: 1, active: true, pastryFormat: "SMALL", basePriceCents: null, vatRateBasisPoints: 550 },
      { id: "fraisier", companyId: "A", categoryId: "catGat", name: "Fraisier", unit: "pièce", sortOrder: 0, active: true, pastryFormat: "LARGE", basePriceCents: null, vatRateBasisPoints: 550 },
      { id: "baguette", companyId: "A", categoryId: "catPain", name: "Baguette", unit: "pièce", sortOrder: 0, active: true, pastryFormat: null, basePriceCents: 110, vatRateBasisPoints: 550 },
    ],
    order: [],
    orderLine: [],
    merchantPrice: [],
    recurringOrder: [],
    recurringOrderLine: [],
    round: [],
    stop: [],
    auditLog: [],
  };
  const db = createMemoryDb(tables, {
    decorate: { product: (row, all) => ({ category: { active: Boolean((all.category ?? []).find((category) => category.id === row.categoryId)?.active) } }) },
  });
  const lock = (now: Date) => (companyId: string, date: string) => lockDeliveryDate(companyId, date, { now, db: db as unknown as LockDb, travelMatrix });
  return { tables, db: db as unknown as ShipmentDb, lock };
}

const PASTRY = { companyId: "A", userId: "patissier", family: "PASTRY" as const };
const BAKER = { companyId: "A", userId: "boulanger", family: "BREAD" as const };
const linesOf = (tables: Record<string, Row[]>, orderId: string) =>
  Object.fromEntries(tables.orderLine!.filter((line) => line.orderId === orderId).map((line) => [line.productId, line.quantityOrdered]));

test("LOT2-D5 vérifications 1 et 3 : 12 éclairs et 8 tartes du pâtissier, puis 20 baguettes de la production, sur le même envoi de « Centre-ville »", async () => {
  const { tables, db, lock } = fixture();
  const pastry = await saveShipment(PASTRY, { date: J, shopId: "centre", lines: [{ productId: "eclair", quantity: 12 }, { productId: "tarte", quantity: 8 }] }, { db, now: BEFORE, addToRounds: lock(BEFORE) });
  assert.deepEqual(pastry.lines, [{ productId: "eclair", quantity: 12 }, { productId: "tarte", quantity: 8 }]);
  const order = tables.order!.find((row) => row.merchantId === "centre")!;
  assert.deepEqual([order.origin, order.status, order.slotId], ["SHIPMENT", "LOCKED", "sMatin"], "envoi décidé par le laboratoire, sur le matin de la tournée");
  await saveShipment(BAKER, { date: J, shopId: "centre", lines: [{ productId: "baguette", quantity: 20 }] }, { db, now: BEFORE, addToRounds: lock(BEFORE) });
  assert.equal(tables.order!.filter((row) => row.merchantId === "centre").length, 1, "un seul envoi par point de vente et par matin");
  assert.deepEqual(linesOf(tables, String(order.id)), { eclair: 12, tarte: 8, baguette: 20 });
  // Le pâtissier corrige ses quantités : le pain du boulanger n'est pas touché.
  const corrected = await saveShipment(PASTRY, { date: J, shopId: "centre", lines: [{ productId: "eclair", quantity: 12 }] }, { db, now: BEFORE, addToRounds: lock(BEFORE) });
  assert.equal(corrected.otherFamilyItemCount, 20);
  assert.deepEqual(linesOf(tables, String(order.id)), { eclair: 12, baguette: 20 });
});

test("LOT2-D5 vérification 2 et LOT2-D1 vérification 3 : à l'heure limite, le point de vente devient un arrêt de la tournée du matin, avec ses produits", async () => {
  const { tables, db, lock } = fixture();
  await saveShipment(PASTRY, { date: J, shopId: "centre", lines: [{ productId: "eclair", quantity: 12 }, { productId: "tarte", quantity: 8 }] }, { db, now: BEFORE, addToRounds: lock(BEFORE) });
  assert.equal(tables.stop!.length, 0, "avant l'heure limite, pas encore de tournée");
  await lock(AFTER_CUTOFF)("A", J);
  const order = tables.order!.find((row) => row.merchantId === "centre")!;
  const stop = tables.stop!.find((row) => row.orderId === order.id)!;
  assert.ok(stop, "arrêt du point de vente créé");
  const round = tables.round!.find((row) => row.id === stop.roundId)!;
  assert.equal(round.slotId, "sMatin");
  // Le livreur lit les lignes de la commande de l'arrêt (round-driver.service) : les produits de l'envoi.
  assert.deepEqual(linesOf(tables, String(order.id)), { eclair: 12, tarte: 8 });
  assert.match(readFileSync("src/domains/round/round-driver.service.ts", "utf8"), /lines: \(lines\.get\(stop\.orderId\) \?\? \[\]\)/);
  // Ajout après l'heure limite : le pain du boulanger rejoint le même arrêt, aucun arrêt en double.
  await saveShipment(BAKER, { date: J, shopId: "centre", lines: [{ productId: "baguette", quantity: 20 }] }, { db, now: AFTER_CUTOFF, addToRounds: lock(AFTER_CUTOFF) });
  assert.equal(tables.stop!.filter((row) => row.orderId === order.id).length, 1);
  assert.deepEqual(linesOf(tables, String(order.id)), { eclair: 12, tarte: 8, baguette: 20 });
});

test("LOT2-D5 : un envoi créé après l'heure limite est ajouté aux tournées déjà calculées", async () => {
  const { tables, db, lock } = fixture();
  await lock(AFTER_CUTOFF)("A", J);
  await saveShipment(PASTRY, { date: J, shopId: "centre", lines: [{ productId: "eclair", quantity: 5 }] }, { db, now: AFTER_CUTOFF, addToRounds: lock(AFTER_CUTOFF) });
  const order = tables.order!.find((row) => row.merchantId === "centre")!;
  const stop = tables.stop!.find((row) => row.orderId === order.id);
  assert.ok(stop, "arrêt ajouté");
  assert.equal(tables.round!.find((row) => row.id === stop!.roundId)!.slotId, "sMatin");
});

test("LOT2-D5 : modifiable jusqu'au départ de la tournée ; un envoi vidé disparaît avec son arrêt", async () => {
  const { tables, db, lock } = fixture();
  await saveShipment(PASTRY, { date: J, shopId: "centre", lines: [{ productId: "eclair", quantity: 12 }] }, { db, now: BEFORE, addToRounds: lock(BEFORE) });
  await lock(AFTER_CUTOFF)("A", J);
  const order = tables.order!.find((row) => row.merchantId === "centre")!;
  const round = tables.round!.find((row) => row.id === tables.stop!.find((stop) => stop.orderId === order.id)!.roundId)!;
  round.status = "IN_PROGRESS";
  await assert.rejects(saveShipment(PASTRY, { date: J, shopId: "centre", lines: [{ productId: "eclair", quantity: 13 }] }, { db, now: AFTER_CUTOFF, addToRounds: async () => undefined }), { status: 409, code: "SHIPMENT_DEPARTED" });
  const day = await getShipmentDay("A", "PASTRY", J, db);
  assert.equal(day.shops[0]!.editable, false);
  round.status = "DRAFT";
  await saveShipment(PASTRY, { date: J, shopId: "centre", lines: [] }, { db, now: AFTER_CUTOFF, addToRounds: async () => undefined });
  assert.equal(tables.order!.some((row) => row.id === order.id), false);
  assert.equal(tables.stop!.some((row) => row.orderId === order.id), false);
});

test("LOT2-D5 : chacun sa famille ; pas de produit à tailles ; pas de client, de date passée ni de point de vente d'une autre entreprise", async () => {
  const { db } = fixture();
  const run = (actor: typeof PASTRY | typeof BAKER, input: { date?: string; shopId?: string; productId: string }) =>
    saveShipment(actor, { date: input.date ?? J, shopId: input.shopId ?? "centre", lines: [{ productId: input.productId, quantity: 1 }] }, { db, now: BEFORE, addToRounds: async () => undefined });
  await assert.rejects(run(PASTRY, { productId: "baguette" }), { status: 400, code: "PRODUCT_NOT_IN_FAMILY" });
  await assert.rejects(run(BAKER, { productId: "eclair" }), { status: 400, code: "PRODUCT_NOT_IN_FAMILY" });
  await assert.rejects(run(PASTRY, { productId: "fraisier" }), { status: 400 }, "les produits à tailles partent avec les commandes des particuliers");
  await assert.rejects(run(PASTRY, { productId: "eclair", shopId: "client1" }), { status: 404 });
  await assert.rejects(run(PASTRY, { productId: "eclair", date: "2026-11-18" }), { status: 400, code: "DATE_IN_PAST" });
  await assert.rejects(saveShipment({ ...PASTRY, companyId: "B" }, { date: J, shopId: "centre", lines: [] }, { db, now: BEFORE }), { status: 404 });
  const day = await getShipmentDay("A", "PASTRY", J, db);
  assert.deepEqual(day.products.map((product) => product.name), ["Éclair", "Tarte au citron"]);
  assert.deepEqual(day.shops.map((shop) => shop.name), ["Centre-ville"]);
});

test("LOT2-D5 : l'envoi entre dans la production de chaque famille ; seuls le pâtissier et le boulanger envoient", async () => {
  const { db, lock } = fixture();
  await saveShipment(PASTRY, { date: J, shopId: "centre", lines: [{ productId: "eclair", quantity: 12 }] }, { db, now: BEFORE, addToRounds: lock(BEFORE) });
  await saveShipment(BAKER, { date: J, shopId: "centre", lines: [{ productId: "baguette", quantity: 20 }] }, { db, now: BEFORE, addToRounds: lock(BEFORE) });
  const closed = { date: J, cutoffAt: AFTER_CUTOFF, closed: true, lockedAt: AFTER_CUTOFF };
  const pastry = await getProductionDay("A", closed, db as unknown as ProductionDb, "PASTRY");
  assert.deepEqual(pastry.totals.flatMap((category) => category.products.map((product) => [product.name, product.quantity])), [["Éclair", 12]]);
  const bread = await getProductionDay("A", closed, db as unknown as ProductionDb, "BREAD");
  assert.deepEqual(bread.totals.flatMap((category) => category.products.map((product) => [product.name, product.quantity])), [["Baguette", 20]]);
  assert.equal(ROLE_PERMISSIONS.PASTRY_CHEF.includes("shipments:manage"), true);
  assert.equal(ROLE_PERMISSIONS.BAKER.includes("shipments:manage"), true);
  assert.equal(ROLE_PERMISSIONS.ADMIN.includes("shipments:manage"), false, "l'administrateur n'envoie pas (tableau des droits)");
  assert.match(readFileSync("src/app/api/shipments/route.ts", "utf8"), /requireCompanyRole\(\["PASTRY_CHEF", "BAKER"\], "shipments:manage"\)/);
});
