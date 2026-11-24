/**
 * Lot 2 — corrections demandées par la relecture d'Orso (19 novembre 2026, commentaire de la PR #53) :
 * 1. double réception d'un envoi = stock compté deux fois ;
 * 2. correction admin d'une commande avec deux lignes du même produit, et ajout d'un produit non commandable ;
 * puis, parmi les points « à corriger après » : taille déjà commandée, prix de base sur un gros gâteau, compteur
 * d'essais du code responsable, réception après clôture.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { receiveShipment, closeDay, type ShopStockDb } from "../src/domains/shop/shop-stock.service";
import { saveMerchantOrder, type OrderDb } from "../src/domains/order/merchant-order.service";
import { correctAdminOrder, type AdminOrderDb } from "../src/domains/order/admin-order.service";
import { updatePastryProduct } from "../src/domains/catalog/lab-catalog.service";
import type { CatalogDb } from "../src/domains/catalog/catalog.service";
import { hashManagerCode, verifyManagerCode, MANAGER_CODE_MAX_FAILURES, type ShopPricesDb } from "../src/domains/shop/shop-prices.service";
import { createProductSchema } from "../src/lib/validations/catalog";
import { createMemoryDb } from "./helpers/memory-db";

type Row = Record<string, unknown>;
const day = (date: string) => new Date(`${date}T00:00:00.000Z`);

test("Relecture 1 : deux réceptions simultanées du même envoi ne créent qu'un seul lot", async () => {
  const tables: Record<string, Row[]> = {
    company: [{ id: "A", timezone: "Europe/Paris" }],
    merchant: [{ id: "centre", companyId: "A", kind: "SHOP", name: "Centre-ville" }],
    category: [{ id: "catPat", companyId: "A", name: "Pâtisseries", family: "PASTRY" }],
    product: [{ id: "eclair", companyId: "A", categoryId: "catPat", name: "Éclair", unit: "pièce", shelfLifeDays: 2 }],
    order: [{ id: "o1", companyId: "A", merchantId: "centre", deliveryDate: day("2026-11-23"), origin: "SHIPMENT", status: "LOCKED", receivedAt: null }],
    orderLine: [{ id: "l1", companyId: "A", orderId: "o1", productId: "eclair", quantityOrdered: 12, quantityReceived: null, quantityDamaged: null }],
    shopStockLot: [],
    shopDayClose: [],
    role: [],
    user: [],
    clientNotification: [],
    auditLog: [],
  };
  const db = createMemoryDb(tables) as unknown as ShopStockDb;
  const actor = { companyId: "A", userId: "vendeuse", shopId: "centre" };
  const input = { date: "2026-11-23", lines: [{ productId: "eclair", received: 12, damaged: 0 }] };
  const now = new Date("2026-11-23T06:00:00.000Z");
  const results = await Promise.allSettled([receiveShipment(actor, input, { db, now }), receiveShipment(actor, input, { db, now })]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(tables.shopStockLot!.length, 1, "un seul lot de 12 éclairs");
  assert.equal(tables.shopStockLot![0]!.quantity, 12);
  // Réception notée après la clôture du jour : refusée.
  tables.order!.push({ id: "o2", companyId: "A", merchantId: "centre", deliveryDate: day("2026-11-24"), origin: "SHIPMENT", status: "LOCKED", receivedAt: null });
  tables.orderLine!.push({ id: "l2", companyId: "A", orderId: "o2", productId: "eclair", quantityOrdered: 5, quantityReceived: null, quantityDamaged: null });
  await closeDay(actor, { date: "2026-11-24", entries: [{ productId: "eclair", remaining: 12, damaged: 0 }] }, { db, now: new Date("2026-11-24T19:00:00.000Z") });
  await assert.rejects(
    receiveShipment(actor, { date: "2026-11-24", lines: [{ productId: "eclair", received: 5, damaged: 0 }] }, { db, now: new Date("2026-11-24T20:00:00.000Z") }),
    { status: 409, code: "DAY_ALREADY_CLOSED" }
  );
});

function restaurantFixture() {
  const tables: Record<string, Row[]> = {
    company: [{ id: "A", cutoffTime: "17:00", timezone: "Europe/Paris" }],
    merchant: [{ id: "R1", companyId: "A", name: "Restaurant du Port", active: true, zoneId: "zSud" }],
    deliveryZone: [{ id: "zSud", companyId: "A", name: "Sud", active: true }],
    slot: [{ id: "sMatin", companyId: "A", zoneId: "zSud", period: "MORNING", label: "Sud matin", startTime: "06:00", endTime: "08:00", active: true }],
    category: [{ id: "catGat", companyId: "A", active: true, family: "PASTRY" }],
    product: [
      { id: "castel", companyId: "A", categoryId: "catGat", name: "Castel", unit: "pièce", basePriceCents: null, vatRateBasisPoints: 550, active: true, pastryFormat: "LARGE", photoUrl: null },
      { id: "eclair", companyId: "A", categoryId: "catGat", name: "Éclair", unit: "pièce", basePriceCents: 180, vatRateBasisPoints: 550, active: true, pastryFormat: "SMALL", photoUrl: null },
      { id: "nouveau", companyId: "A", categoryId: "catGat", name: "Nouveauté", unit: "pièce", basePriceCents: null, vatRateBasisPoints: 550, active: true, pastryFormat: "SMALL", photoUrl: null },
    ],
    productSize: [
      { id: "c6", companyId: "A", productId: "castel", servings: 6, restaurantPriceCents: 2400 },
      { id: "c10", companyId: "A", productId: "castel", servings: 10, restaurantPriceCents: 3500 },
    ],
    merchantPrice: [],
    order: [],
    orderLine: [],
    cakeOrder: [],
    recurringOrder: [],
    recurringOrderLine: [],
    round: [],
    stop: [],
    invoice: [],
    auditLog: [],
    user: [],
  };
  const db = createMemoryDb(tables, {
    decorate: { product: (row, all) => ({ category: { active: Boolean((all.category ?? []).find((category) => category.id === row.categoryId)?.active) } }) },
  });
  return { tables, db };
}

test("Relecture 2 : l'admin corrige une commande avec un castel 6 parts et un castel 10 parts ; pas d'ajout non commandable", async () => {
  const { tables, db } = restaurantFixture();
  const now = new Date("2026-11-19T10:00:00.000Z");
  const { order } = await saveMerchantOrder(
    { companyId: "A", merchantId: "R1", userId: "uR1" },
    { deliveryDate: "2026-11-20", slotId: "sMatin", lines: [{ productId: "castel", sizeId: "c6", quantity: 1 }, { productId: "castel", sizeId: "c10", inscription: "Julie", quantity: 1 }] },
    now,
    db as unknown as OrderDb
  );
  const lines = tables.orderLine!.filter((line) => line.orderId === order.id);
  const six = lines.find((line) => line.sizeId === "c6")!;
  const ten = lines.find((line) => line.sizeId === "c10")!;
  const admin = { companyId: "A", userId: "admin" };
  const adminDb = db as unknown as AdminOrderDb;
  // Le castel 10 parts passe à 2 ; le 6 parts ne bouge pas.
  const detail = await correctAdminOrder(admin, order.id, { lines: [{ lineId: String(six.id), productId: "castel", quantity: 1 }, { lineId: String(ten.id), productId: "castel", quantity: 2 }] }, now, adminDb);
  assert.deepEqual([six.quantityOrdered, ten.quantityOrdered], [1, 2]);
  assert.ok(detail.lines.some((line) => line.name === "Castel · 10 personnes « Julie »"));
  // Retirer une ligne par son identifiant.
  await correctAdminOrder(admin, order.id, { lines: [{ lineId: String(ten.id), productId: "castel", quantity: 2 }] }, now, adminDb);
  assert.equal(tables.orderLine!.filter((line) => line.orderId === order.id).length, 1);
  // Ajouts refusés : gros gâteau sans taille, produit sans prix restaurant.
  for (const productId of ["castel", "nouveau"]) {
    await assert.rejects(
      correctAdminOrder(admin, order.id, { lines: [{ lineId: String(ten.id), productId: "castel", quantity: 2 }, { productId, quantity: 1 }] }, now, adminDb),
      { status: 400, code: "PRODUCT_UNAVAILABLE" },
      productId
    );
  }
  // Ajout d'un gros gâteau par taille : prix de la taille figé.
  await correctAdminOrder(admin, order.id, { lines: [{ lineId: String(ten.id), productId: "castel", quantity: 2 }, { productId: "castel", sizeId: "c6", quantity: 1 }] }, now, adminDb);
  const added = tables.orderLine!.find((line) => line.orderId === order.id && line.sizeId === "c6")!;
  assert.equal(added.unitPriceFrozenCents, 2400);
});

test("Relecture 3 et 4 : une taille déjà commandée ne se retire pas ; un produit à tailles n'a pas de prix de base", async () => {
  const { tables } = restaurantFixture();
  tables.category![0]!.name = "Gâteaux à partager";
  const db = createMemoryDb(tables, {
    decorate: { product: (row, all) => ({ category: all.category!.find((category) => category.id === row.categoryId), _count: { merchantPrices: 0 } }) },
  });
  tables.orderLine!.push({ id: "x", companyId: "A", orderId: "o", productId: "castel", sizeId: "c6", quantityOrdered: 1, variantKey: "size:c6|" });
  await assert.rejects(updatePastryProduct("A", "castel", { servings: [10] }, db as unknown as CatalogDb), { status: 409, code: "SIZE_ALREADY_ORDERED" });
  assert.equal(tables.productSize!.length, 2, "rien d'écrit");
  await updatePastryProduct("A", "castel", { servings: [6, 10, 12] }, db as unknown as CatalogDb);
  assert.equal(tables.productSize!.length, 3, "ajouter une taille reste possible");
  const large = { name: "Castel", categoryId: "catGat", unit: "pièce", vatRateBasisPoints: 550, active: true, pastryFormat: "LARGE", sizes: [{ servings: 6 }] };
  assert.equal(createProductSchema.safeParse({ ...large, basePriceCents: 3000 }).success, false);
  assert.equal(createProductSchema.safeParse({ ...large, basePriceCents: null }).success, true);
});

test("Relecture 6 : essais manqués du code responsable comptés sans perte, même en parallèle", async () => {
  const tables: Record<string, Row[]> = {
    merchant: [{ id: "centre", companyId: "A", kind: "SHOP", name: "Centre-ville", managerCodeHash: hashManagerCode("4821"), managerCodeFailures: 0, managerCodeLockedUntil: null }],
  };
  const db = createMemoryDb(tables) as unknown as ShopPricesDb;
  const now = new Date("2026-11-19T08:00:00.000Z");
  await Promise.allSettled(Array.from({ length: MANAGER_CODE_MAX_FAILURES }, () => verifyManagerCode(db, "A", "centre", "0000", now)));
  const shop = tables.merchant![0]!;
  assert.ok(shop.managerCodeLockedUntil instanceof Date, "bloqué après 5 essais, même lancés ensemble");
  await assert.rejects(verifyManagerCode(db, "A", "centre", "4821", now), { status: 429 });
});
