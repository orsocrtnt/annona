import assert from "node:assert/strict";
import test from "node:test";
import { computeTotals, lineAmountCents } from "../src/domains/catalog/pricing";
import { promoQuantityFor, promotionPriceCents, promotionState } from "../src/domains/catalog/promotion";
import {
  createPromotion,
  listPromotions,
  loadPromotionOffers,
  stopPromotion,
  type PromotionDb,
} from "../src/domains/catalog/promotion.service";
import { loadAppliedPrices } from "../src/domains/catalog/pricing";
import { buildInvoice } from "../src/domains/invoice/invoice-builder";
import { cancelMerchantOrder, saveMerchantOrder, type OrderDb } from "../src/domains/order/merchant-order.service";
import { lockDeliveryDate, type LockDb } from "../src/domains/order/order-lock.service";
import type { PortalCategory, PortalProduct } from "../src/domains/order/merchant-order.types";
import { catalogSections, PROMO_SECTION_ID } from "../src/features/ordering/catalog-sections";
import { straightLineSeconds } from "../src/lib/dispatch/travel-time";
import { createPromotionSchema } from "../src/lib/validations/catalog";
import { createMemoryDb } from "./helpers/memory-db";

/**
 * Lot 1, demande 2 — promotions. Vérifications du document :
 * 1. −30 % jusqu'à dimanche, réservée à 2 clients : n'apparaît que chez ces 2 clients ;
 * 2. le produit en promotion s'affiche en premier (étiquette, ancien prix barré, nouveau prix) ;
 * 3. le lundi suivant, la promotion a disparu et le prix normal s'applique ;
 * 4. limite de 50 unités : la 51ᵉ unité commandée est facturée au prix normal ;
 * 5. un client dont le prix négocié est plus bas que le prix promo garde son prix négocié.
 */

type Row = Record<string, unknown>;
const PARIS = "Europe/Paris";
const MONDAY = new Date("2026-11-09T08:00:00.000Z"); // lundi 9 novembre, 9h Paris
const SATURDAY = new Date("2026-11-14T08:00:00.000Z");
const NEXT_MONDAY = new Date("2026-11-16T08:00:00.000Z");
const SUNDAY = "2026-11-15";
const ADMIN = { companyId: "A", userId: "admA" };
const client = (merchantId: string) => ({ companyId: "A", merchantId, userId: `u${merchantId}` });

function fixture() {
  const tables: Record<string, Row[]> = {
    company: [
      { id: "A", cutoffTime: "17:00", timezone: PARIS, depotLatitude: 48.85, depotLongitude: 2.37 },
      { id: "B", cutoffTime: "17:00", timezone: PARIS, depotLatitude: 45.76, depotLongitude: 4.83 },
    ],
    merchant: [
      { id: "A1", companyId: "A", name: "Café A1", tradeName: null, active: true, zoneId: "zSud", latitude: 48.86, longitude: 2.35 },
      { id: "A2", companyId: "A", name: "Bistrot A2", tradeName: null, active: true, zoneId: "zSud", latitude: 48.87, longitude: 2.36 },
      { id: "A3", companyId: "A", name: "Épicerie A3", tradeName: null, active: true, zoneId: "zSud", latitude: 48.85, longitude: 2.38 },
      { id: "A4", companyId: "A", name: "Hôtel A4", tradeName: null, active: true, zoneId: "zSud", latitude: 48.84, longitude: 2.39 },
      { id: "B1", companyId: "B", name: "Hôtel B1", tradeName: null, active: true, zoneId: "zB", latitude: 45.75, longitude: 4.85 },
    ],
    deliveryZone: [{ id: "zSud", companyId: "A", name: "Sud", active: true }],
    slot: [
      { id: "s6", companyId: "A", zoneId: "zSud", period: "MORNING", label: "Sud matin", startTime: "05:30", endTime: "11:00", active: true, sortOrder: 1 },
    ],
    category: [{ id: "catA", companyId: "A", name: "Pains", active: true }],
    product: [
      { id: "baguette", companyId: "A", categoryId: "catA", name: "Baguette", unit: "pièce", basePriceCents: 110, vatRateBasisPoints: 550, active: true, photoUrl: null },
      { id: "croissant", companyId: "A", categoryId: "catA", name: "Croissant", unit: "pièce", basePriceCents: 85, vatRateBasisPoints: 550, active: true, photoUrl: null },
      { id: "painB", companyId: "B", categoryId: "catB", name: "Pain B", unit: "pièce", basePriceCents: 200, vatRateBasisPoints: 550, active: true, photoUrl: null },
    ],
    // Vérification 5 : A1 a un prix négocié de 95 c sur la baguette (prix de base 110 c).
    merchantPrice: [{ id: "pA1", companyId: "A", merchantId: "A1", productId: "baguette", priceCents: 95 }],
    promotion: [],
    promotionMerchant: [],
    order: [],
    orderLine: [],
    recurringOrder: [],
    recurringOrderLine: [],
    round: [],
    stop: [],
    auditLog: [],
    user: [{ id: "admA", companyId: "A", firstName: "Alice", lastName: "Admin" }],
  };
  const db = createMemoryDb(tables, {
    decorate: {
      product: (row, all) => ({ category: { active: Boolean((all.category ?? []).find((category) => category.id === row.categoryId)?.active) } }),
    },
  });
  return { db, tables, promo: db as unknown as PromotionDb, orders: db as unknown as OrderDb };
}

async function offersOf(db: unknown, merchantId: string, today: string) {
  const products = [
    { id: "baguette", basePriceCents: 110 },
    { id: "croissant", basePriceCents: 85 },
  ];
  const prices = await loadAppliedPrices(db as PromotionDb, "A", merchantId, products.map((product) => product.id));
  return loadPromotionOffers(db as PromotionDb, "A", merchantId, today, products, prices);
}

const order = (lines: Array<[string, number]>, deliveryDate = "2026-11-10") => ({
  deliveryDate,
  slotId: "s6",
  lines: lines.map(([productId, quantity]) => ({ productId, quantity })),
});

// ---------------------------------------------------------------------------
// Règles pures
// ---------------------------------------------------------------------------

test("LOT1-D2 règles : prix promo, état, quantité au prix promo, montant d'une ligne", () => {
  assert.equal(promotionPriceCents({ promoPriceCents: null, discountPercent: 30 }, 85), 60, "85 c − 30 % = 59,5 c arrondi à 60 c");
  assert.equal(promotionPriceCents({ promoPriceCents: 80, discountPercent: null }, 110), 80);
  const promo = { endsOn: SUNDAY, stoppedAt: null, quantityLimit: 50 };
  assert.equal(promotionState(promo, "2026-11-15", 0), "ACTIVE", "dimanche inclus");
  assert.equal(promotionState(promo, "2026-11-16", 0), "ENDED", "lundi suivant");
  assert.equal(promotionState(promo, "2026-11-10", 50), "SOLD_OUT");
  assert.equal(promotionState({ ...promo, stoppedAt: new Date() }, "2026-11-10", 0), "STOPPED");
  assert.equal(promoQuantityFor(21, 20), 20);
  assert.equal(promoQuantityFor(10, null), 10);
  assert.equal(promoQuantityFor(3, 0), 0);
  assert.equal(lineAmountCents({ quantity: 21, unitPriceCents: 110, vatRateBasisPoints: 550, promoQuantity: 20, promoUnitPriceCents: 80 }), 20 * 80 + 110);
  // Prix promo plus cher que le prix de la ligne (prix négocié baissé depuis) : le moins cher des deux.
  assert.equal(lineAmountCents({ quantity: 5, unitPriceCents: 70, vatRateBasisPoints: 550, promoQuantity: 5, promoUnitPriceCents: 80 }), 5 * 70);
  assert.equal(computeTotals([{ quantity: 2, unitPriceCents: 110, vatRateBasisPoints: 550, promoQuantity: 1, promoUnitPriceCents: 80 }]).subtotalCents, 190);
});

test("LOT1-D2 saisie : prix promo ou pourcentage (un seul), au moins un client si réservée", () => {
  const base = { productId: "croissant", endsOn: SUNDAY, allMerchants: true };
  assert.equal(createPromotionSchema.safeParse({ ...base, discountPercent: 30 }).success, true);
  assert.equal(createPromotionSchema.safeParse({ ...base, promoPriceCents: 60 }).success, true);
  assert.equal(createPromotionSchema.safeParse({ ...base }).success, false, "ni prix ni pourcentage");
  assert.equal(createPromotionSchema.safeParse({ ...base, discountPercent: 30, promoPriceCents: 60 }).success, false, "les deux");
  assert.equal(createPromotionSchema.safeParse({ ...base, discountPercent: 100 }).success, false, "100 %");
  assert.equal(createPromotionSchema.safeParse({ ...base, discountPercent: 30, allMerchants: false, merchantIds: [] }).success, false);
});

// ---------------------------------------------------------------------------
// Vérifications 1 et 2
// ---------------------------------------------------------------------------

test("LOT1-D2 vérification 1 : −30 % jusqu'à dimanche réservée à 2 clients, visible chez eux seuls", async () => {
  const { db, promo } = fixture();
  const created = await createPromotion(ADMIN, { productId: "croissant", discountPercent: 30, endsOn: SUNDAY, allMerchants: false, merchantIds: ["A2", "A3"] }, MONDAY, promo);
  assert.equal(created.state, "ACTIVE");
  assert.equal(created.promoUnitPriceCents, 60);
  assert.deepEqual(created.merchants.map((merchant) => merchant.id).sort(), ["A2", "A3"]);

  for (const merchantId of ["A2", "A3"]) {
    const offer = (await offersOf(db, merchantId, "2026-11-09")).get("croissant");
    assert.equal(offer?.promoUnitPriceCents, 60, `${merchantId} voit la promotion`);
    assert.equal(offer?.regularUnitPriceCents, 85, "ancien prix barré");
  }
  for (const merchantId of ["A1", "A4"]) {
    assert.equal((await offersOf(db, merchantId, "2026-11-09")).size, 0, `${merchantId} ne la voit pas`);
  }
  // Commande d'un client non visé : prix normal.
  const other = await saveMerchantOrder(client("A4"), order([["croissant", 10]]), MONDAY, db as unknown as OrderDb);
  assert.equal(other.order.subtotalCents, 10 * 85);
  const chosen = await saveMerchantOrder(client("A2"), order([["croissant", 10]]), MONDAY, db as unknown as OrderDb);
  assert.equal(chosen.order.subtotalCents, 10 * 60);
  assert.equal(chosen.order.lines[0]?.promoQuantity, 10);
});

test("LOT1-D2 vérification 2 : le produit en promotion passe en tête du catalogue", () => {
  const product = (id: string, promo: PortalProduct["promo"]): PortalProduct => ({
    id, name: id, description: null, unit: "pièce", photoVersion: null, unitPriceCents: 85, vatRateBasisPoints: 550, isSpecific: false, allergens: null, promo,
  });
  const categories: PortalCategory[] = [
    { id: "pains", name: "Pains", products: [product("Baguette", null)] },
    { id: "vienno", name: "Viennoiseries", products: [product("Brioche", null), product("Croissant", { unitPriceCents: 60, remaining: null, endsOn: SUNDAY })] },
  ];
  const sections = catalogSections(categories, "");
  assert.equal(sections[0]?.id, PROMO_SECTION_ID, "section « Promotions » en premier");
  assert.deepEqual(sections[0]?.products.map((row) => row.name), ["Croissant"]);
  assert.deepEqual(sections[2]?.products.map((row) => row.name), ["Brioche"], "plus de doublon dans sa catégorie");
  assert.equal(catalogSections(categories, "bague")[0]?.id, "pains", "la recherche filtre aussi la section promo");
  assert.equal(catalogSections([categories[0]!], "")[0]?.id, "pains", "sans promotion : catalogue inchangé");
});

// ---------------------------------------------------------------------------
// Vérification 3
// ---------------------------------------------------------------------------

test("LOT1-D2 vérification 3 : le lundi suivant, plus de promotion ; une commande déjà validée garde son prix", async () => {
  const { db, promo, orders, tables } = fixture();
  await createPromotion(ADMIN, { productId: "croissant", discountPercent: 30, endsOn: SUNDAY, allMerchants: true }, MONDAY, promo);
  assert.equal((await offersOf(db, "A2", "2026-11-15")).size, 1, "encore là dimanche");
  assert.equal((await offersOf(db, "A2", "2026-11-16")).size, 0, "disparue le lundi");

  // Commande validée samedi pour le mardi 17 : prix promo retenu.
  const saturday = await saveMerchantOrder(client("A2"), order([["croissant", 10]], "2026-11-17"), SATURDAY, orders);
  assert.equal(saturday.order.subtotalCents, 600);
  // Lundi, le client la modifie (12 croissants) : ses 10 unités promo restent, les 2 nouvelles au prix normal.
  const monday = await saveMerchantOrder(client("A2"), order([["croissant", 12]], "2026-11-17"), NEXT_MONDAY, orders);
  assert.equal(monday.order.subtotalCents, 10 * 60 + 2 * 85);
  // Nouvelle commande le lundi : prix normal.
  const fresh = await saveMerchantOrder(client("A3"), order([["croissant", 10]], "2026-11-17"), NEXT_MONDAY, orders);
  assert.equal(fresh.order.subtotalCents, 10 * 85);
  assert.equal((tables.orderLine ?? []).find((line) => line.orderId === fresh.order.id)?.promoQuantity, 0);

  const rows = await listPromotions("A", NEXT_MONDAY, promo);
  assert.equal(rows[0]?.state, "ENDED", "dans les promotions terminées");
});

test("LOT1-D2 : l'administrateur arrête une promotion ; les commandes validées gardent leur prix", async () => {
  const { db, promo, orders } = fixture();
  const created = await createPromotion(ADMIN, { productId: "croissant", promoPriceCents: 50, endsOn: SUNDAY, allMerchants: true }, MONDAY, promo);
  const before = await saveMerchantOrder(client("A2"), order([["croissant", 4]]), MONDAY, orders);
  assert.equal(before.order.subtotalCents, 200);
  const stopped = await stopPromotion(ADMIN, created.id, MONDAY, promo);
  assert.equal(stopped.state, "STOPPED");
  assert.equal((await offersOf(db, "A2", "2026-11-09")).size, 0);
  const after = await saveMerchantOrder(client("A3"), order([["croissant", 4]]), MONDAY, orders);
  assert.equal(after.order.subtotalCents, 4 * 85, "nouvelle commande au prix normal");
  const reread = await saveMerchantOrder(client("A2"), order([["croissant", 4]]), MONDAY, orders);
  assert.equal(reread.order.subtotalCents, 200, "commande validée inchangée");
  await assert.rejects(stopPromotion(ADMIN, created.id, MONDAY, promo), /déjà arrêtée/);
  // Une seule promotion en cours par produit.
  await createPromotion(ADMIN, { productId: "croissant", discountPercent: 10, endsOn: SUNDAY, allMerchants: true }, MONDAY, promo);
  await assert.rejects(
    createPromotion(ADMIN, { productId: "croissant", discountPercent: 20, endsOn: SUNDAY, allMerchants: true }, MONDAY, promo),
    /déjà une promotion en cours/
  );
  await assert.rejects(
    createPromotion(ADMIN, { productId: "baguette", promoPriceCents: 110, endsOn: SUNDAY, allMerchants: true }, MONDAY, promo),
    /plus bas que le prix de base/
  );
  await assert.rejects(
    createPromotion(ADMIN, { productId: "baguette", discountPercent: 10, endsOn: "2026-11-08", allMerchants: true }, MONDAY, promo),
    /déjà passée/
  );
});

// ---------------------------------------------------------------------------
// Vérification 4
// ---------------------------------------------------------------------------

test("LOT1-D2 vérification 4 : limite de 50 unités, la 51ᵉ est au prix normal", async () => {
  const { db, promo, orders } = fixture();
  await createPromotion(ADMIN, { productId: "croissant", promoPriceCents: 50, endsOn: SUNDAY, quantityLimit: 50, allMerchants: true }, MONDAY, promo);
  const a2 = await saveMerchantOrder(client("A2"), order([["croissant", 50]]), MONDAY, orders);
  assert.equal(a2.order.subtotalCents, 50 * 50);
  const a3 = await saveMerchantOrder(client("A3"), order([["croissant", 1]]), MONDAY, orders);
  assert.equal(a3.order.subtotalCents, 85, "51ᵉ unité au prix normal");
  assert.equal((await offersOf(db, "A4", "2026-11-09")).size, 0, "épuisée : plus affichée");
  assert.equal((await listPromotions("A", MONDAY, promo))[0]?.state, "SOLD_OUT");

  // A2 réduit à 40 : 10 unités reviennent ; A4 en commande 15 → 10 au prix promo, 5 au prix normal.
  await saveMerchantOrder(client("A2"), order([["croissant", 40]]), MONDAY, orders);
  const offer = (await offersOf(db, "A4", "2026-11-09")).get("croissant");
  assert.equal(offer?.remaining, 10);
  const a4 = await saveMerchantOrder(client("A4"), order([["croissant", 15]]), MONDAY, orders);
  assert.equal(a4.order.subtotalCents, 10 * 50 + 5 * 85);
  assert.equal(a4.order.lines[0]?.promoQuantity, 10);
  assert.equal(a4.order.lines[0]?.lineTotalCents, 10 * 50 + 5 * 85);

  // Une commande annulée rend ses unités.
  await cancelMerchantOrder(client("A4"), a4.order.id, MONDAY, orders);
  assert.equal((await offersOf(db, "A1", "2026-11-09")).get("croissant")?.remaining, 10);
  assert.equal((await listPromotions("A", MONDAY, promo))[0]?.usedQuantity, 40);
});

test("LOT1-D2 vérification 4 : facture — part promo et part au prix normal sur deux lignes", () => {
  const invoice = buildInvoice([
    {
      id: "o1", reference: "C1", deliveryDate: "2026-11-10",
      lines: [{ productId: "croissant", name: "Croissant", unit: "pièce", quantityOrdered: 21, quantityDelivered: 21, unitPriceFrozenCents: 85, vatRateBasisPoints: 550, promoQuantity: 20, promoUnitPriceCents: 50 }],
    },
    {
      // Manquant : 18 livrés sur 20 commandés au prix promo → 18 au prix promo.
      id: "o2", reference: "C2", deliveryDate: "2026-11-11",
      lines: [{ productId: "croissant", name: "Croissant", unit: "pièce", quantityOrdered: 20, quantityDelivered: 18, unitPriceFrozenCents: 85, vatRateBasisPoints: 550, promoQuantity: 20, promoUnitPriceCents: 50 }],
    },
  ]);
  assert.deepEqual(invoice.lines.map((line) => [line.label, line.quantity, line.unitPriceCents]), [["Croissant", 1, 85], ["Croissant (promo)", 38, 50]]);
  assert.equal(invoice.subtotalCents, 85 + 38 * 50);
  assert.deepEqual(invoice.orders.map((row) => row.subtotalCents), [20 * 50 + 85, 18 * 50]);
});

// ---------------------------------------------------------------------------
// Vérification 5
// ---------------------------------------------------------------------------

test("LOT1-D2 vérification 5 : prix négocié plus bas que le prix promo → le client garde son prix négocié", async () => {
  const { db, promo, orders, tables } = fixture();
  // −10 % sur la baguette : 99 c ; A1 paie 95 c (prix négocié), A2 paie 110 c sans promotion.
  await createPromotion(ADMIN, { productId: "baguette", discountPercent: 10, endsOn: SUNDAY, quantityLimit: 50, allMerchants: true }, MONDAY, promo);
  assert.equal((await offersOf(db, "A1", "2026-11-09")).size, 0, "pas d'étiquette Promo pour A1");
  assert.equal((await offersOf(db, "A2", "2026-11-09")).get("baguette")?.promoUnitPriceCents, 99);
  const a1 = await saveMerchantOrder(client("A1"), order([["baguette", 20]]), MONDAY, orders);
  assert.equal(a1.order.subtotalCents, 20 * 95);
  assert.equal((tables.orderLine ?? []).find((line) => line.orderId === a1.order.id)?.promoQuantity, 0, "aucune unité promo consommée");
  // Prix promo plus bas que le prix négocié : le client paie le prix promo (le moins cher des deux).
  const { promo: promo2, orders: orders2 } = fixture();
  await createPromotion(ADMIN, { productId: "baguette", promoPriceCents: 80, endsOn: SUNDAY, allMerchants: true }, MONDAY, promo2);
  assert.equal((await saveMerchantOrder(client("A1"), order([["baguette", 20]]), MONDAY, orders2)).order.subtotalCents, 20 * 80);
});

// ---------------------------------------------------------------------------
// Commande récurrente, isolation
// ---------------------------------------------------------------------------

test("LOT1-D2 : une commande récurrente générée à l'heure limite reçoit la promotion en cours (et la limite)", async () => {
  const { db, promo, orders, tables } = fixture();
  await createPromotion(ADMIN, { productId: "croissant", promoPriceCents: 50, endsOn: SUNDAY, quantityLimit: 30, allMerchants: true }, MONDAY, promo);
  await saveMerchantOrder(client("A2"), order([["croissant", 20]]), MONDAY, orders);
  tables.recurringOrder!.push({ id: "rA3", companyId: "A", merchantId: "A3", slotId: "s6", weekdays: [2], active: true, createdAt: new Date(1) });
  tables.recurringOrderLine!.push({ id: "rl1", companyId: "A", recurringOrderId: "rA3", productId: "croissant", quantity: 15 });
  const cutoff = new Date("2026-11-09T16:00:00.000Z");
  const summary = await lockDeliveryDate("A", "2026-11-10", { now: cutoff, db: db as unknown as LockDb, travelMatrix: async () => ({ seconds: straightLineSeconds, approximate: true }) });
  assert.equal(summary.recurringGenerated, 1);
  const generated = (tables.order ?? []).find((row) => row.merchantId === "A3")!;
  const line = (tables.orderLine ?? []).find((row) => row.orderId === generated.id)!;
  assert.equal(line.promoQuantity, 10, "il restait 10 unités sur 30");
  assert.equal(line.promoUnitPriceCents, 50);
  assert.equal(line.unitPriceFrozenCents, 85, "prix normal figé pour les 5 autres");
});

test("LOT1-D2 isolation : produit, client ou promotion d'une autre entreprise introuvables", async () => {
  const { promo } = fixture();
  await assert.rejects(createPromotion(ADMIN, { productId: "painB", discountPercent: 10, endsOn: SUNDAY, allMerchants: true }, MONDAY, promo), /Produit introuvable/);
  await assert.rejects(
    createPromotion(ADMIN, { productId: "croissant", discountPercent: 10, endsOn: SUNDAY, allMerchants: false, merchantIds: ["B1"] }, MONDAY, promo),
    /Client introuvable/
  );
  const created = await createPromotion(ADMIN, { productId: "croissant", discountPercent: 10, endsOn: SUNDAY, allMerchants: true }, MONDAY, promo);
  await assert.rejects(stopPromotion({ companyId: "B", userId: "admB" }, created.id, MONDAY, promo), /Promotion introuvable/);
  assert.equal((await listPromotions("B", MONDAY, promo)).length, 0);
});
