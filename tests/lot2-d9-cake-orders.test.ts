/**
 * Lot 2, demande 9 (18 novembre 2026) : commandes de gâteaux des particuliers prises en boutique. Rejoue aussi la
 * vérification 4 de la demande 4 (le prix s'affiche mais ne peut pas être changé pendant la prise de commande).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createCakeOrder, listCakeChoices, minimumDepositCents, readCakeLeadHours, settleCakeOrder, type CakeOrderDb } from "../src/domains/shop/cake-order.service";
import { getProductionDay, type ProductionDb } from "../src/domains/production/production.service";
import { getReception, type ShopStockDb } from "../src/domains/shop/shop-stock.service";
import { createMemoryDb } from "./helpers/memory-db";

type Row = Record<string, unknown>;
const NOW = new Date("2026-11-19T09:00:00.000Z");
const PICKUP = "2026-11-22T10:00:00.000+01:00";
const PICKUP_DAY = "2026-11-22";

function fixture(settings: Row = {}) {
  const tables: Record<string, Row[]> = {
    company: [{ id: "A", timezone: "Europe/Paris", settings, cutoffTime: "17:00" }],
    deliveryZone: [{ id: "zCentre", companyId: "A", name: "Centre" }],
    slot: [{ id: "sMatin", companyId: "A", zoneId: "zCentre", period: "MORNING", label: "Centre matin", startTime: "06:00", endTime: "08:00", active: true }],
    merchant: [
      { id: "centre", companyId: "A", kind: "SHOP", name: "Centre-ville", active: true, zoneId: "zCentre" },
      { id: "gare", companyId: "A", kind: "SHOP", name: "Gare", active: true, zoneId: "zCentre" },
    ],
    category: [{ id: "catGat", companyId: "A", name: "Gâteaux à partager", family: "PASTRY", sortOrder: 0, active: true }],
    product: [{ id: "fraisier", companyId: "A", categoryId: "catGat", name: "Fraisier", unit: "pièce", active: true, pastryFormat: "LARGE", sortOrder: 0 }],
    productSize: [
      { id: "s8", companyId: "A", productId: "fraisier", servings: 8, restaurantPriceCents: null },
      { id: "s10", companyId: "A", productId: "fraisier", servings: 10, restaurantPriceCents: null },
    ],
    shopPrice: [{ id: "p1", companyId: "A", shopId: "centre", productId: "fraisier", sizeId: "s10", sizeKey: "s10", sold: true, priceCents: 4000 }],
    order: [],
    orderLine: [],
    cakeOrder: [],
    stop: [],
    round: [],
    auditLog: [],
  };
  return { tables, db: createMemoryDb(tables) as unknown as CakeOrderDb };
}

const SELLER = { companyId: "A", userId: "vendeuse", shopId: "centre" };
const ORDER = {
  productId: "fraisier",
  sizeId: "s10",
  inscription: "Joyeux anniversaire Maman",
  servings: 10,
  payment: "DEPOSIT" as const,
  depositCents: 2000,
  customerName: "Mme Martin",
  customerPhone: "0601020304",
  pickupAt: PICKUP,
};
const noRounds = async () => undefined;

test("LOT2-D9 vérifications 1 et 2 : fraisier 10 personnes à 40 € ; acompte de 15 € refusé, de 20 € accepté", async () => {
  const { tables, db } = fixture();
  assert.equal(minimumDepositCents(4000), 2000);
  await assert.rejects(createCakeOrder(SELLER, { ...ORDER, depositCents: 1500 }, { db, now: NOW, addToRounds: noRounds }), { status: 400, code: "DEPOSIT_TOO_LOW" });
  assert.equal(tables.cakeOrder!.length, 0, "rien d'enregistré");
  const row = await createCakeOrder(SELLER, ORDER, { db, now: NOW, addToRounds: noRounds });
  assert.deepEqual([row.priceCents, row.paidCents, row.dueCents, row.payment, row.status], [4000, 2000, 2000, "DEPOSIT", "ORDERED"]);
  assert.equal(row.pickupDate, PICKUP_DAY);
  const full = await createCakeOrder(SELLER, { ...ORDER, payment: "FULL", depositCents: null }, { db, now: NOW, addToRounds: noRounds });
  assert.deepEqual([full.paidCents, full.dueCents], [4000, 0]);
});

test("LOT2-D4 vérification 4 : pendant la prise de commande, le prix s'affiche mais ne se change pas", async () => {
  const { db } = fixture();
  const choices = await listCakeChoices("A", "centre", db);
  assert.deepEqual(choices.map((choice) => [choice.name, choice.sizes.map((size) => [size.servings, size.priceCents])]), [["Fraisier", [[10, 4000]]]], "seule la taille avec un prix boutique");
  // La saisie n'a pas de champ prix : un prix envoyé est refusé par la route, et le service lit le prix boutique.
  const route = readFileSync("src/app/api/shop/cakes/route.ts", "utf8");
  assert.doesNotMatch(route, /priceCents/);
  assert.match(route, /\.strict\(\)/);
  const screen = readFileSync("src/features/shops/seller-cakes.tsx", "utf8");
  assert.match(screen, /data-testid="cake-price" aria-readonly/);
  // Sans prix boutique, pas de commande ; une autre boutique a ses propres prix.
  await assert.rejects(createCakeOrder({ ...SELLER, shopId: "gare" }, ORDER, { db, now: NOW, addToRounds: noRounds }), { status: 400, code: "NO_SHOP_PRICE" });
  await assert.rejects(createCakeOrder(SELLER, { ...ORDER, sizeId: "s8" }, { db, now: NOW, addToRounds: noRounds }), { status: 400, code: "NO_SHOP_PRICE" });
});

test("LOT2-D9 : au moins 48 h avant le retrait, délai réglable par l'administrateur", async () => {
  const tooSoon = new Date(new Date(PICKUP).getTime() - 47 * 3_600_000);
  const { db } = fixture();
  await assert.rejects(createCakeOrder(SELLER, ORDER, { db, now: tooSoon, addToRounds: noRounds }), { status: 400, code: "PICKUP_TOO_SOON" });
  const relaxed = fixture({ cakeOrderLeadHours: 24 });
  await createCakeOrder(SELLER, ORDER, { db: relaxed.db, now: tooSoon, addToRounds: noRounds });
  assert.equal(readCakeLeadHours({}), 48);
  assert.equal(readCakeLeadHours({ cakeOrderLeadHours: 12 }), 12);
  assert.equal(readCakeLeadHours({ cakeOrderLeadHours: "beaucoup" }), 48);
  assert.match(readFileSync("src/app/api/shops/cake-settings/route.ts", "utf8"), /requireCompanyAdmin\("shops:manage"\)/);
});

test("LOT2-D9 vérifications 3 et 4 : le fraisier et son inscription chez le pâtissier le jour prévu, dans l'envoi du matin vers la boutique", async () => {
  const { tables, db } = fixture();
  let roundsFor: string | null = null;
  const row = await createCakeOrder(SELLER, ORDER, { db, now: NOW, addToRounds: async (_companyId, date) => { roundsFor = date; } });
  assert.equal(roundsFor, PICKUP_DAY, "ajouté aux tournées du jour du retrait si elles sont calculées");
  const shipment = tables.order!.find((order) => order.merchantId === "centre")!;
  assert.deepEqual([shipment.origin, shipment.status, (shipment.deliveryDate as Date).toISOString().slice(0, 10)], ["SHIPMENT", "LOCKED", PICKUP_DAY]);
  const line = tables.orderLine!.find((orderLine) => orderLine.cakeOrderId === row.id)!;
  assert.deepEqual([line.productId, line.sizeId, line.inscription, line.quantityOrdered], ["fraisier", "s10", "Joyeux anniversaire Maman", 1]);
  // Deux gâteaux du même produit le même jour : deux lignes distinctes de l'envoi.
  await createCakeOrder(SELLER, { ...ORDER, inscription: "Bravo Léo", customerName: "M. Petit" }, { db, now: NOW, addToRounds: noRounds });
  assert.equal(tables.orderLine!.filter((orderLine) => orderLine.orderId === shipment.id).length, 2);
  const production = await getProductionDay("A", { date: PICKUP_DAY, cutoffAt: NOW, closed: true, lockedAt: NOW }, db as unknown as ProductionDb, "PASTRY");
  const details = production.sheets.flatMap((sheet) => sheet.lines.map((sheetLine) => [sheetLine.name, sheetLine.detail]));
  assert.deepEqual(details.sort(), [["Fraisier", "10 personnes · « Bravo Léo »"], ["Fraisier", "10 personnes · « Joyeux anniversaire Maman »"]]);
  assert.deepEqual(production.totals.flatMap((category) => category.products.map((product) => [product.name, product.quantity])), [["Fraisier", 2]]);
  // Les gâteaux commandés ne se comptent pas à la réception (ils ne vont pas en stock).
  assert.deepEqual((await getReception({ companyId: "A", shopId: "centre" }, PICKUP_DAY, db as unknown as ShopStockDb)).lines, []);
});

test("LOT2-D9 vérification 5 : au retrait, la vendeuse marque la commande « soldée »", async () => {
  const { tables, db } = fixture();
  const row = await createCakeOrder(SELLER, ORDER, { db, now: NOW, addToRounds: noRounds });
  const settled = await settleCakeOrder(SELLER, row.id, { db, now: new Date("2026-11-22T09:30:00.000Z") });
  assert.deepEqual([settled.status, settled.dueCents, settled.paidCents], ["SETTLED", 0, 4000]);
  await assert.rejects(settleCakeOrder(SELLER, row.id, { db }), { status: 409 });
  await assert.rejects(settleCakeOrder({ ...SELLER, shopId: "gare" }, row.id, { db }), { status: 404 }, "une autre boutique ne la voit pas");
  assert.deepEqual(tables.auditLog!.filter((log) => log.entityType === "CakeOrder").map((log) => log.action), ["CREATE", "SETTLE"]);
});

test("RETOURS-2 : allergies / instructions facultatives d'une commande de gâteau, jusqu'au bon et à la fenêtre du pâtissier", async () => {
  const { tables, db } = fixture();
  const row = await createCakeOrder(SELLER, { ...ORDER, note: "  Allergie aux fruits à coque  " }, { db, now: NOW, addToRounds: noRounds });
  assert.equal(row.note, "Allergie aux fruits à coque");
  assert.equal(tables.orderLine!.find((orderLine) => orderLine.cakeOrderId === row.id)!.note, "Allergie aux fruits à coque");
  const without = await createCakeOrder(SELLER, { ...ORDER, customerName: "M. Petit" }, { db, now: NOW, addToRounds: noRounds });
  assert.equal(without.note, null, "facultatif");
  const production = await getProductionDay("A", { date: PICKUP_DAY, cutoffAt: NOW, closed: true, lockedAt: NOW }, db as unknown as ProductionDb, "PASTRY");
  const details = production.sheets.flatMap((sheet) => sheet.lines.map((sheetLine) => sheetLine.detail)).sort();
  assert.deepEqual(details, ["10 personnes · « Joyeux anniversaire Maman »", "10 personnes · « Joyeux anniversaire Maman » · ⚠ Allergie aux fruits à coque"]);
  const recipients = production.details!.fraisier!.recipients;
  assert.deepEqual(recipients.map((recipient) => [recipient.customer?.name, recipient.note]).sort(), [["M. Petit", null], ["Mme Martin", "Allergie aux fruits à coque"]]);
});
