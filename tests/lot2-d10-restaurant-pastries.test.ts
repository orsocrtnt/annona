/**
 * Lot 2, demande 10 (18 novembre 2026) : pâtisseries pour les restaurants. Petites pièces au catalogue (prix
 * restaurant), gros gâteaux au choix de la taille, avec inscription ; prix restaurant de la taille ; pas d'acompte,
 * facturé avec le reste ; heure limite et créneaux comme le pain ; dans la production du pâtissier.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getMerchantOrder, lineVariantKey, saveMerchantOrder, assertLines, type OrderDb } from "../src/domains/order/merchant-order.service";
import { getProductionDay, type ProductionDb } from "../src/domains/production/production.service";
import { buildInvoice } from "../src/domains/invoice/invoice-builder";
import { cakeArticleId, parseCakeArticleId, saveOrderSchema } from "../src/lib/validations/order";
import { createMemoryDb } from "./helpers/memory-db";

type Row = Record<string, unknown>;
const BEFORE = new Date("2026-11-19T10:00:00.000Z");
const DAY = "2026-11-20";
const RESTAURANT = { companyId: "A", merchantId: "R1", userId: "uR1" };

function fixture() {
  const tables: Record<string, Row[]> = {
    company: [{ id: "A", cutoffTime: "17:00", timezone: "Europe/Paris" }],
    merchant: [{ id: "R1", companyId: "A", name: "Restaurant du Port", active: true, zoneId: "zSud" }],
    deliveryZone: [{ id: "zSud", companyId: "A", name: "Sud", active: true }],
    slot: [{ id: "sMatin", companyId: "A", zoneId: "zSud", period: "MORNING", label: "Sud matin", startTime: "06:00", endTime: "08:00", active: true }],
    category: [
      { id: "catPat", companyId: "A", active: true, family: "PASTRY" },
      { id: "catGat", companyId: "A", active: true, family: "PASTRY" },
    ],
    product: [
      { id: "eclair", companyId: "A", categoryId: "catPat", name: "Éclair", unit: "pièce", basePriceCents: 180, vatRateBasisPoints: 550, active: true, pastryFormat: "SMALL", photoUrl: null },
      { id: "castel", companyId: "A", categoryId: "catGat", name: "Castel", unit: "pièce", basePriceCents: null, vatRateBasisPoints: 550, active: true, pastryFormat: "LARGE", photoUrl: null },
    ],
    productSize: [
      { id: "c8", companyId: "A", productId: "castel", servings: 8, restaurantPriceCents: null },
      { id: "c10", companyId: "A", productId: "castel", servings: 10, restaurantPriceCents: 3500 },
    ],
    merchantPrice: [],
    order: [],
    orderLine: [],
    recurringOrder: [],
    recurringOrderLine: [],
    round: [],
    stop: [],
    auditLog: [],
  };
  const db = createMemoryDb(tables, {
    decorate: { product: (row, all) => ({ category: { active: Boolean((all.category ?? []).find((category) => category.id === row.categoryId)?.active) } }) },
  });
  return { tables, db: db as unknown as OrderDb };
}

const ORDER = {
  deliveryDate: DAY,
  slotId: "sMatin",
  lines: [
    { productId: "eclair", quantity: 20 },
    { productId: "castel", sizeId: "c10", inscription: "Bon anniversaire Julie", quantity: 1 },
  ],
};

test("LOT2-D10 vérification 1 : un restaurant commande 20 éclairs et un castel 10 personnes « Bon anniversaire Julie »", async () => {
  const { tables, db } = fixture();
  assert.equal(saveOrderSchema.safeParse(ORDER).success, true);
  const { order } = await saveMerchantOrder(RESTAURANT, ORDER, BEFORE, db);
  assert.equal(order.status, "VALIDATED", "pas d'acompte : commande validée comme le pain");
  const lines = tables.orderLine!.filter((line) => line.orderId === order.id);
  const castel = lines.find((line) => line.productId === "castel")!;
  assert.deepEqual([castel.sizeId, castel.inscription, castel.unitPriceFrozenCents, castel.quantityOrdered], ["c10", "Bon anniversaire Julie", 3500, 1], "prix restaurant de la taille");
  assert.equal(castel.variantKey, lineVariantKey({ sizeId: "c10", inscription: "Bon anniversaire Julie" }));
  const eclair = lines.find((line) => line.productId === "eclair")!;
  assert.equal(eclair.variantKey ?? "", "");
  // Le restaurant relit sa commande : article « castel::c10 », taille et inscription.
  const detail = await getMerchantOrder(RESTAURANT, order.id, BEFORE, db);
  const read = detail.lines.find((line) => line.productId === cakeArticleId("castel", "c10"))!;
  assert.deepEqual([read.name, read.inscription, read.unitPriceCents, read.available], ["Castel · 10 personnes", "Bon anniversaire Julie", 3500, true]);
  assert.equal(detail.subtotalCents, 20 * 180 + 3500);
  assert.deepEqual(parseCakeArticleId(read.productId), { productId: "castel", sizeId: "c10" });
});

test("LOT2-D10 : un gros gâteau se commande seulement par une taille qui a un prix restaurant ; deux inscriptions = deux lignes", async () => {
  const { tables, db } = fixture();
  await assert.rejects(saveMerchantOrder(RESTAURANT, { ...ORDER, lines: [{ productId: "castel", quantity: 1 }] }, BEFORE, db), { status: 400, code: "PRODUCT_UNAVAILABLE" });
  await assert.rejects(saveMerchantOrder(RESTAURANT, { ...ORDER, lines: [{ productId: "castel", sizeId: "c8", quantity: 1 }] }, BEFORE, db), { status: 400 }, "taille sans prix restaurant");
  await assert.rejects(saveMerchantOrder(RESTAURANT, { ...ORDER, lines: [{ productId: "eclair", sizeId: "c10", quantity: 1 }] }, BEFORE, db), { status: 400 }, "une petite pièce n'a pas de taille");
  const { order } = await saveMerchantOrder(
    RESTAURANT,
    { ...ORDER, lines: [{ productId: "castel", sizeId: "c10", inscription: "Julie", quantity: 1 }, { productId: "castel", sizeId: "c10", inscription: "Léo", quantity: 2 }] },
    BEFORE,
    db
  );
  assert.equal(tables.orderLine!.filter((line) => line.orderId === order.id).length, 2);
  assert.throws(() => assertLines([{ productId: "castel", sizeId: "c10", inscription: "Julie", quantity: 1 }, { productId: "castel", sizeId: "c10", inscription: "Julie", quantity: 1 }]), { code: "DUPLICATE_PRODUCT" });
  // Heure limite comme le pain : après 17 h la veille, plus de commande pour le lendemain.
  await assert.rejects(saveMerchantOrder(RESTAURANT, ORDER, new Date("2026-11-19T16:30:00.000Z"), db), { status: 409 });
});

test("LOT2-D10 vérification 2 : le pâtissier voit les éclairs et le castel avec son inscription dans sa production", async () => {
  const { tables, db } = fixture();
  const { order } = await saveMerchantOrder(RESTAURANT, ORDER, BEFORE, db);
  tables.order!.find((row) => row.id === order.id)!.status = "LOCKED";
  const production = await getProductionDay("A", { date: DAY, cutoffAt: BEFORE, closed: true, lockedAt: BEFORE }, db as unknown as ProductionDb, "PASTRY");
  assert.deepEqual(production.totals.flatMap((category) => category.products.map((product) => [product.name, product.quantity])).sort(), [["Castel", 1], ["Éclair", 20]]);
  const lines = production.sheets[0]!.lines.map((line) => [line.name, line.detail ?? null]);
  assert.deepEqual(lines.sort(), [["Castel", "10 personnes · « Bon anniversaire Julie »"], ["Éclair", null]]);
});

test("LOT2-D10 vérification 3 : le castel figure sur la facture du restaurant, au prix restaurant de la taille", () => {
  const built = buildInvoice([
    {
      id: "o1",
      reference: "C1",
      deliveryDate: DAY,
      lines: [
        { productId: "eclair", name: "Éclair", unit: "pièce", quantityOrdered: 20, quantityDelivered: 20, unitPriceFrozenCents: 180, promoQuantity: 0, promoUnitPriceCents: null, vatRateBasisPoints: 550 },
        { productId: "castel", name: "Castel · 10 personnes", unit: "pièce", quantityOrdered: 1, quantityDelivered: 1, unitPriceFrozenCents: 3500, promoQuantity: 0, promoUnitPriceCents: null, vatRateBasisPoints: 550 },
        { productId: "castel", name: "Castel · 8 personnes", unit: "pièce", quantityOrdered: 1, quantityDelivered: 1, unitPriceFrozenCents: 3500, promoQuantity: 0, promoUnitPriceCents: null, vatRateBasisPoints: 550 },
      ],
    },
  ] as never);
  const labels = built.lines.map((line) => [line.label, line.quantity, line.unitPriceCents]);
  assert.deepEqual(labels.sort(), [["Castel · 10 personnes", 1, 3500], ["Castel · 8 personnes", 1, 3500], ["Éclair", 20, 180]], "deux tailles restent deux lignes");
  const generation = readFileSync("src/domains/invoice/invoice-generation.service.ts", "utf8");
  assert.match(generation, /personnes` : product\?\.name/);
  // Le prix d'une ligne de gâteau est figé dès la commande ; le verrouillage ne le recalcule pas (produit sans prix de base).
  assert.match(readFileSync("src/domains/order/merchant-order.service.ts", "utf8"), /unitPriceFrozenCents: sizes\.get\(line\.sizeId\)!\.restaurantPriceCents/);
});

test("LOT2-D10 : catalogue des restaurants (un article par taille avec prix) ; pas de gros gâteau en commande récurrente", () => {
  const catalog = readFileSync("src/domains/order/merchant-catalog.service.ts", "utf8");
  assert.match(catalog, /pastryFormat: "LARGE"/);
  assert.match(catalog, /restaurantPriceCents: \{ not: null \}/);
  assert.match(catalog, /cake: \{ productId: cake\.id, sizeId: size\.id, servings: size\.servings \}/);
  const recurring = readFileSync("src/domains/order/recurring-order.service.ts", "utf8");
  assert.match(recurring, /product\.pastryFormat !== "LARGE"/);
  assert.match(recurring, /\|\| line\.sizeId/);
  const cart = readFileSync("src/features/ordering/cart-sheet.tsx", "utf8");
  assert.match(cart, /sizeId: line\.product\.cake\.sizeId, inscription:/);
});

test("RETOURS-2 : allergies / instructions facultatives par produit et pour la commande, enregistrées et relues par le restaurant", async () => {
  const { tables, db } = fixture();
  const input = {
    ...ORDER,
    notes: "Livrer par la porte de service",
    lines: [
      { productId: "eclair", quantity: 20, note: "Sans noisette" },
      { productId: "castel", sizeId: "c10", inscription: "Bon anniversaire Julie", note: "Bougie 30 ans", quantity: 1 },
    ],
  };
  assert.equal(saveOrderSchema.safeParse(input).success, true);
  const { order } = await saveMerchantOrder(RESTAURANT, input, BEFORE, db);
  const lines = tables.orderLine!.filter((line) => line.orderId === order.id);
  assert.deepEqual(lines.map((line) => [line.productId, line.note]).sort(), [["castel", "Bougie 30 ans"], ["eclair", "Sans noisette"]]);
  const detail = await getMerchantOrder(RESTAURANT, order.id, BEFORE, db);
  assert.equal(detail.notes, "Livrer par la porte de service");
  assert.deepEqual(detail.lines.map((line) => line.note).sort(), ["Bougie 30 ans", "Sans noisette"]);
  // Sans note : rien d'enregistré (facultatif).
  const { order: plain } = await saveMerchantOrder(RESTAURANT, ORDER, BEFORE, db);
  assert.ok(tables.orderLine!.filter((line) => line.orderId === plain.id).every((line) => (line.note ?? null) === null));
});
